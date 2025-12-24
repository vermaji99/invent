const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const Payment = require('../models/Payment');
const { body, validationResult } = require('express-validator');

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { search, highValue } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (highValue === 'true') {
      query.isHighValue = true;
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    
    // Recalculate totalDue for each customer from invoices
    for (let customer of customers) {
      const invoices = await Invoice.find({ customer: customer._id });
      const calculatedDue = invoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
      
      // Update if different (to keep data accurate)
      if (customer.totalDue !== calculatedDue) {
        customer.totalDue = calculatedDue;
        await customer.save();
      }
    }
    
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/customers/:id
// @desc    Get single customer with purchase history
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const invoices = await Invoice.find({ customer: req.params.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('items.product', 'name category');

    const payments = await Payment.find({ customer: req.params.id })
      .sort({ paymentDate: -1 })
      .limit(20);

    // Recalculate totalDue from all invoices
    const allInvoices = await Invoice.find({ customer: customer._id });
    const calculatedDue = allInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
    
    if (customer.totalDue !== calculatedDue) {
      customer.totalDue = calculatedDue;
      await customer.save();
    }

    const totalPurchases = await Invoice.aggregate([
      { $match: { customer: customer._id } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    res.json({
      customer,
      invoices,
      payments,
      stats: {
        totalPurchases: totalPurchases[0]?.total || 0,
        invoiceCount: totalPurchases[0]?.count || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/customers
// @desc    Create new customer
// @access  Private
router.post('/', [
  auth,
  body('name').notEmpty().withMessage('Name is required'),
  body('phone').notEmpty().withMessage('Phone is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if customer with same phone already exists
    const existingCustomer = await Customer.findOne({ phone: req.body.phone });
    if (existingCustomer) {
      return res.status(400).json({ message: 'Customer with this phone number already exists' });
    }

    const customer = new Customer(req.body);
    await customer.save();

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Customer with this phone number already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/customers/:id/clear-arrears
// @desc    Clear customer arrears
// @access  Private
router.put('/:id/clear-arrears', auth, async (req, res) => {
  try {
    const { amount, paymentMode } = req.body;
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const clearAmount = amount ? parseFloat(amount) : customer.totalDue;
    
    if (clearAmount <= 0) {
      return res.status(400).json({ message: 'No arrears to clear' });
    }

    if (clearAmount > customer.totalDue) {
      return res.status(400).json({ message: 'Amount exceeds total due' });
    }

    customer.totalDue -= clearAmount;
    if (customer.totalDue < 0) customer.totalDue = 0;
    await customer.save();

    // Update all pending invoices
    const pendingInvoices = await Invoice.find({ 
      customer: customer._id, 
      status: { $in: ['Pending', 'Partial'] } 
    }).sort({ createdAt: 1 });

    let remainingAmount = clearAmount;
    for (const invoice of pendingInvoices) {
      if (remainingAmount <= 0) break;
      
      if (invoice.dueAmount <= remainingAmount) {
        const originalDue = invoice.dueAmount;
        invoice.paidAmount += originalDue;
        invoice.dueAmount = 0;
        invoice.status = 'Paid';
        remainingAmount -= originalDue;
      } else {
        invoice.paidAmount += remainingAmount;
        invoice.dueAmount -= remainingAmount;
        if (invoice.dueAmount < 1) invoice.dueAmount = 0; // normalize very small remainders
        invoice.status = 'Partial';
        remainingAmount = 0;
      }
      await invoice.save();
    }

    // Log Transaction
    await Transaction.create({
      type: 'CREDIT',
      category: 'CUSTOMER_PAYMENT',
      amount: clearAmount,
      paymentMode: paymentMode || 'Cash', 
      description: `Arrears Cleared for ${customer.name}`,
      reference: {
        model: 'Customer',
        id: customer._id
      },
      performedBy: req.user.id
    });

    res.json({ 
      customer,
      clearedAmount: clearAmount,
      remainingDue: customer.totalDue
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private (Admin only)
router.delete('/:id', [auth], async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

