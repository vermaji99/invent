const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const SupplierPayment = require('../models/SupplierPayment');
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Transaction = require('../models/Transaction');
const { body, validationResult } = require('express-validator');

// @route   GET /api/supplier-payments
// @desc    Get all supplier payments
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const payments = await SupplierPayment.find()
      .populate('supplier', 'name phone')
      .populate('purchase', 'purchaseNumber')
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/supplier-payments
// @desc    Create new supplier payment
// @access  Private
router.post('/', [
  auth,
  body('supplier').notEmpty().withMessage('Supplier is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('paymentMode').notEmpty().withMessage('Payment mode is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { supplier, purchase, amount, paymentMode, notes, paymentDate } = req.body;

    const newPayment = new SupplierPayment({
      supplier,
      purchase,
      amount,
      paymentMode,
      notes,
      paymentDate: paymentDate || Date.now(),
      createdBy: req.user.id
    });

    await newPayment.save();

    // Update Supplier Outstanding
    const supplierDoc = await Supplier.findById(supplier);
    if (supplierDoc) {
      supplierDoc.outstandingAmount -= amount;
      await supplierDoc.save();
    }

    // Update Purchase if linked
    if (purchase) {
      const purchaseDoc = await Purchase.findById(purchase);
      if (purchaseDoc) {
        purchaseDoc.paidAmount += amount;
        purchaseDoc.dueAmount -= amount;
        if (purchaseDoc.dueAmount < 0) purchaseDoc.dueAmount = 0; // Prevent negative due
        await purchaseDoc.save();
      }
    } else {
        // Auto-settle pending purchases (FIFO)
        const pendingPurchases = await Purchase.find({
            supplier: supplier,
            dueAmount: { $gt: 0 }
        }).sort({ createdAt: 1 });

        let remainingAmount = amount;
        for (const pur of pendingPurchases) {
            if (remainingAmount <= 0) break;

            if (pur.dueAmount <= remainingAmount) {
                const pay = pur.dueAmount;
                pur.paidAmount += pay;
                remainingAmount -= pay;
                pur.dueAmount = 0;
                // Update product costs? Not needed for payment.
            } else {
                pur.paidAmount += remainingAmount;
                pur.dueAmount -= remainingAmount;
                remainingAmount = 0;
            }
            await pur.save();
        }
    }

    // Create Transaction
    await Transaction.create({
      type: 'DEBIT',
      category: 'SUPPLIER_PAYMENT',
      amount,
      paymentMode,
      description: `Payment to ${supplierDoc ? supplierDoc.name : 'Supplier'}`,
      reference: {
        model: 'SupplierPayment',
        id: newPayment._id
      },
      date: newPayment.paymentDate,
      performedBy: req.user.id
    });

    const populatedPayment = await SupplierPayment.findById(newPayment._id)
      .populate('supplier', 'name')
      .populate('purchase', 'purchaseNumber');

    res.status(201).json(populatedPayment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
