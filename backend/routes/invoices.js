const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const OldGold = require('../models/OldGold');
const { body, validationResult } = require('express-validator');

// @route   GET /api/invoices
// @desc    Get all invoices
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { customer, status, startDate, endDate } = req.query;
    let query = {};

    if (customer) query.customer = customer;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const [ey, em, ed] = endDate.split('-').map(Number);
        const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const invoices = await Invoice.find(query)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .populate('items.product', 'name category')
      .sort({ createdAt: -1 })
      .limit(100);

    // Ensure display status is consistent with dueAmount
    const normalized = invoices.map(inv => {
      const doc = inv.toObject();
      if ((doc.dueAmount || 0) <= 0) {
        doc.status = 'Paid';
        doc.dueAmount = 0;
      }
      return doc;
    });

    res.json(normalized);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/invoices/:id
// @desc    Get single invoice
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('customer')
      .populate('createdBy', 'name')
      .populate('items.product');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Ensure display status is consistent with dueAmount
    const doc = invoice.toObject();
    if ((doc.dueAmount || 0) <= 0) {
      doc.status = 'Paid';
      doc.dueAmount = 0;
    }
    res.json(doc);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/invoices
// @desc    Create new invoice
// @access  Private
router.post('/', [
  auth,
  body('customer').notEmpty().withMessage('Customer is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Generate invoice number
    const count = await Invoice.countDocuments();
    const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

    const { items, customer, paymentMode, paymentDetails, goldRate, notes, exchange, discount } = req.body;

    // Calculate totals
    let subtotal = 0;
    let totalGST = 0;

    // Process items and update stock
    for (let item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(400).json({ message: `Product ${item.product} not found` });
      }

      // Calculate item subtotal
      const itemSubtotal = item.rate * item.weight + item.makingCharge + item.wastage - item.discount - (item.oldGoldAdjustment || 0);
      item.subtotal = itemSubtotal;
      item.purchaseRate = product.purchasePrice || 0; // Capture cost price
      subtotal += itemSubtotal;
      totalGST += item.gst || 0;

      // Update product stock
      if (product.isWeightManaged) {
        const wt = Number(item.weight || 0);
        if (wt <= 0) {
          return res.status(400).json({ message: `Weight required for ${product.name}` });
        }
        if ((product.availableWeight || 0) < wt) {
          return res.status(400).json({ message: `Insufficient weight for ${product.name}` });
        }
        product.availableWeight = (product.availableWeight || 0) - wt;
        product.history = product.history || [];
        product.history.push({
          type: 'SOLD',
          date: new Date(),
          reference: { model: 'Invoice', id: null },
          details: { quantity: item.quantity, weight: wt, rate: item.rate }
        });
        await product.save();
      } else {
        if (product.quantity < item.quantity) {
          return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
        }
        product.quantity -= item.quantity;
        product.history = product.history || [];
        product.history.push({
          type: 'SOLD',
          date: new Date(),
          reference: { model: 'Invoice', id: null },
          details: { quantity: item.quantity, weight: item.weight, rate: item.rate }
        });
        await product.save();
      }
    }

    // Process Exchange
    let exchangeTotal = 0;
    if (exchange && exchange.items) {
       exchangeTotal = exchange.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    }

    const total = subtotal + totalGST - (discount || 0) - exchangeTotal;
    const paidAmount = (paymentDetails?.cash || 0) + (paymentDetails?.upi || 0) + (paymentDetails?.card || 0);
    let dueAmount = total - paidAmount;
    if (dueAmount < 1) dueAmount = 0;

    // Update customer total purchases and recalculate totalDue
    const customerDoc = await Customer.findById(customer);
    if (customerDoc) {
      customerDoc.totalPurchases += total;
      
      // Recalculate totalDue from all invoices to ensure accuracy
      const allInvoices = await Invoice.find({ customer: customer._id });
      customerDoc.totalDue = allInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
      if (customerDoc.totalDue < 0) customerDoc.totalDue = 0;
      
      await customerDoc.save();
    }

    const invoice = new Invoice({
      invoiceNumber,
      customer,
      items,
      subtotal,
      gst: totalGST,
      discount: discount || 0,
      exchange: exchange ? {
        items: exchange.items,
        totalAmount: exchangeTotal
      } : undefined,
      total,
      paymentMode,
      paidAmount,
      dueAmount,
      paymentDetails,
      goldRate,
      status: dueAmount > 0 ? (paidAmount > 0 ? 'Partial' : 'Pending') : 'Paid',
      createdBy: req.user.id,
      notes
    });

    await invoice.save();

    // Log Transactions for incoming payments
    const parts = [
      { key: 'cash', mode: 'Cash' },
      { key: 'upi', mode: 'UPI' },
      { key: 'card', mode: 'Card' }
    ];
    for (const part of parts) {
      const amt = paymentDetails?.[part.key] || 0;
      if (amt > 0) {
        await Transaction.create({
          type: 'CREDIT',
          category: 'SALES',
          amount: amt,
          paymentMode: part.mode,
          description: `Invoice ${invoiceNumber}`,
          reference: { model: 'Invoice', id: invoice._id },
          performedBy: req.user.id
        });
      }
    }

    // Create Old Gold records
    if (exchange && exchange.items) {
      for (const item of exchange.items) {
        await new OldGold({
          customer,
          category: item.category || 'Gold',
          weight: item.weight,
          purity: item.purity,
          rate: item.rate,
          totalValue: item.amount,
          description: item.description || 'Exchange against Invoice',
          status: 'Adjusted',
          adjustedAgainst: {
            invoice: invoice._id,
            amount: item.amount
          },
          createdBy: req.user.id
        }).save();
      }
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('items.product');

    for (const item of items) {
      const prod = await Product.findById(item.product);
      if (prod) {
        prod.history = prod.history || [];
        prod.history.push({
          type: 'SOLD',
          date: new Date(),
          reference: { model: 'Invoice', id: invoice._id },
          details: { quantity: item.quantity, weight: item.weight, rate: item.rate }
        });
        await prod.save();
      }
    }

    res.status(201).json(populatedInvoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/invoices/:id/payment
// @desc    Update invoice payment
// @access  Private
router.put('/:id/payment', auth, async (req, res) => {
  try {
    const { amount, paymentMode } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    invoice.paidAmount += amount;
    invoice.dueAmount -= amount;
    if (invoice.dueAmount < 1) invoice.dueAmount = 0;

    if (invoice.dueAmount <= 0) {
      invoice.status = 'Paid';
      invoice.dueAmount = 0;
    } else {
      invoice.status = 'Partial';
    }

    await invoice.save();

    // Log Transaction for this payment
    if (amount && amount > 0) {
      await Transaction.create({
        type: 'CREDIT',
        category: 'CUSTOMER_PAYMENT',
        amount,
        paymentMode: paymentMode || 'Cash',
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
        reference: { model: 'Invoice', id: invoice._id },
        performedBy: req.user.id
      });
    }

    // Recalculate customer total due from all invoices
    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      const allInvoices = await Invoice.find({ customer: customer._id });
      customer.totalDue = allInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
      if (customer.totalDue < 0) customer.totalDue = 0;
      await customer.save();
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer', 'name phone totalDue')
      .populate('items.product');

    res.json(populatedInvoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/invoices/:id
// @desc    Update invoice
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (req.body.items) {
      invoice.items = req.body.items;
      
      // Recalculate totals
      let subtotal = 0;
      let totalGST = 0;
      
      invoice.items.forEach(item => {
        const itemSubtotal = item.rate * item.weight + item.makingCharge + item.wastage - item.discount - (item.oldGoldAdjustment || 0);
        item.subtotal = itemSubtotal;
        subtotal += itemSubtotal;
        totalGST += item.gst || 0;
      });

      invoice.subtotal = subtotal;
      invoice.gst = totalGST;
      invoice.total = subtotal + totalGST - (invoice.discount || 0);
      invoice.dueAmount = invoice.total - invoice.paidAmount;
      if (invoice.dueAmount < 1) invoice.dueAmount = 0;
      
      if (invoice.dueAmount <= 0) {
        invoice.status = 'Paid';
        invoice.dueAmount = 0;
      } else if (invoice.paidAmount > 0) {
        invoice.status = 'Partial';
      } else {
        invoice.status = 'Pending';
      }
    }

    if (req.body.discount !== undefined) invoice.discount = req.body.discount;
    if (req.body.notes !== undefined) invoice.notes = req.body.notes;

    await invoice.save();

    // Update customer total due
    const customer = await Customer.findById(invoice.customer);
    if (customer) {
      const invoices = await Invoice.find({ customer: customer._id });
      customer.totalDue = invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
      await customer.save();
    }

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('customer')
      .populate('items.product');

    for (const item of populatedInvoice.items) {
      try {
        const prod = await Product.findById(item.product._id);
        if (!prod) continue;
        if (prod.isWeightManaged) {
          await Transaction.create({
            type: 'CREDIT',
            category: 'SALES',
            amount: item.subtotal,
            paymentMode: paymentMode || 'Cash',
            description: `Sold by weight: ${prod.name}`,
            reference: { model: 'Invoice', id: invoice._id },
            performedBy: req.user.id
          });
        }
      } catch (e) {}
    }

    res.status(201).json(populatedInvoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

