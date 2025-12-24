const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const { body, validationResult } = require('express-validator');
const generateBarcode = require('../utils/generateBarcode');

// @route   GET /api/purchases
// @desc    Get all purchases
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .populate('supplier', 'name phone')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/purchases
// @desc    Create new purchase
// @access  Private
router.post('/', [
  auth,
  body('supplier').notEmpty().withMessage('Supplier is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const count = await Purchase.countDocuments();
    const purchaseNumber = `PUR-${String(count + 1).padStart(6, '0')}`;

    const { items, supplier, gst, paymentMode, purchaseDate } = req.body;

    let subtotal = 0;
    // Calculate amounts
    items.forEach(item => {
      item.amount = item.rate * item.weight * item.quantity;
      subtotal += item.amount;
    });

    // Create/Update products BEFORE saving purchase so we can link product IDs
    for (let item of items) {
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product) {
          product.quantity += item.quantity;
          product.purchasePrice = item.rate;
          await product.save();
        }
      } else if (item.createProduct) {
        const count = await Product.countDocuments();
        const sku = item.sku || `SKU-${String(count + 1).padStart(6, '0')}`;
        const newProduct = new Product({
          name: item.name,
          category: item.category,
          sku,
          grossWeight: item.weight,
          netWeight: item.weight,
          purity: item.purity,
          purchasePrice: item.rate,
          sellingPrice: item.rate * 1.2,
          quantity: item.quantity,
          supplier: supplier
        });
        try {
          const barcodeBuffer = await generateBarcode(sku);
          newProduct.barcodeBase64 = barcodeBuffer.toString('base64');
          newProduct.barcode = sku;
        } catch (bcError) {
        }
        await newProduct.save();
        item.product = newProduct._id;
      }
    }

    const total = subtotal + (gst || 0);
    const dueAmountRaw = total - (req.body.paidAmount || 0);
    const dueAmount = dueAmountRaw < 1 ? 0 : dueAmountRaw;

    const purchase = new Purchase({
      purchaseNumber,
      supplier,
      items,
      subtotal,
      gst: gst || 0,
      total,
      paidAmount: req.body.paidAmount || 0,
      dueAmount,
      paymentMode: paymentMode || 'Cash',
      purchaseDate: purchaseDate || new Date(),
      createdBy: req.user.id
    });

    await purchase.save();

    // Update supplier outstanding
    const supplierDoc = await Supplier.findById(supplier);
    if (supplierDoc) {
      supplierDoc.totalPurchases += total;
      supplierDoc.outstandingAmount += dueAmount;
      await supplierDoc.save();
    }

    // Create Transaction for immediate payment (cash outflow)
    const paidNow = req.body.paidAmount || 0;
    if (paidNow > 0) {
      const txnMode = (paymentMode === 'Credit' ? 'Cash' : (paymentMode || 'Cash'));
      await Transaction.create({
        type: 'DEBIT',
        category: 'PURCHASE',
        amount: paidNow,
        paymentMode: txnMode,
        description: `Purchase Payment`,
        reference: {
          model: 'Purchase',
          id: purchase._id
        },
        performedBy: req.user.id
      });
    }

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier')
      .populate('items.product');

    for (const it of items) {
      const prod = await Product.findById(it.product);
      if (prod) {
        const type = it.createProduct ? 'PURCHASE' : 'RESTOCK';
        prod.history = prod.history || [];
        prod.history.push({
          type,
          date: new Date(),
          reference: { model: 'Purchase', id: purchase._id },
          details: { quantity: it.quantity, rate: it.rate }
        });
        await prod.save();
      }
    }

    res.status(201).json(populatedPurchase);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/purchases/:id
// @desc    Get single purchase
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier')
      .populate('items.product')
      .populate('createdBy', 'name');

    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    res.json(purchase);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/purchases/:id
// @desc    Update purchase
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const { items, supplier, gst, paymentMode, paidAmount, purchaseDate, notes } = req.body;

    let subtotal = 0;
    if (items) {
      items.forEach(item => {
        item.amount = item.rate * item.weight * item.quantity;
        subtotal += item.amount;
      });
    } else {
      subtotal = purchase.subtotal;
    }

    const totalGST = gst !== undefined ? gst : purchase.gst;
    const total = subtotal + totalGST;
    const oldPaidAmount = purchase.paidAmount;
    const paid = paidAmount !== undefined ? paidAmount : purchase.paidAmount;
    const dueRaw = total - paid;
    const dueAmount = dueRaw < 1 ? 0 : dueRaw;

    const oldTotal = purchase.total;
    const oldDue = purchase.dueAmount;
    const oldSupplierId = purchase.supplier?.toString();

    purchase.items = items || purchase.items;
    purchase.subtotal = subtotal;
    purchase.gst = totalGST;
    purchase.total = total;
    purchase.paidAmount = paid;
    purchase.dueAmount = dueAmount;
    if (paymentMode) purchase.paymentMode = paymentMode;
    if (purchaseDate) purchase.purchaseDate = purchaseDate;
    if (notes !== undefined) purchase.notes = notes;
    if (supplier) purchase.supplier = supplier;

    await purchase.save();

    const newSupplierId = purchase.supplier?.toString();
    if (oldSupplierId && newSupplierId && oldSupplierId === newSupplierId) {
      const supplierDoc = await Supplier.findById(newSupplierId);
      if (supplierDoc) {
        supplierDoc.totalPurchases += (total - oldTotal);
        supplierDoc.outstandingAmount += (dueAmount - oldDue);
        await supplierDoc.save();
      }
    } else {
      if (oldSupplierId) {
        const oldSupplierDoc = await Supplier.findById(oldSupplierId);
        if (oldSupplierDoc) {
          oldSupplierDoc.totalPurchases -= oldTotal;
          oldSupplierDoc.outstandingAmount -= oldDue;
          await oldSupplierDoc.save();
        }
      }
      if (newSupplierId) {
        const newSupplierDoc = await Supplier.findById(newSupplierId);
        if (newSupplierDoc) {
          newSupplierDoc.totalPurchases += total;
          newSupplierDoc.outstandingAmount += dueAmount;
          await newSupplierDoc.save();
        }
      }
    }

    // Create Transaction if payment increased
    if (paid > oldPaidAmount) {
       const diff = paid - oldPaidAmount;
       await Transaction.create({
         type: 'DEBIT',
         category: 'SUPPLIER_PAYMENT',
         amount: diff,
         paymentMode: purchase.paymentMode, // Assuming same mode or updated mode
         description: `Purchase Payment (Update)`,
         reference: {
           model: 'Purchase',
           id: purchase._id
         },
         performedBy: req.user.id
       });
    }

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier')
      .populate('items.product');

    res.json(populatedPurchase);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

