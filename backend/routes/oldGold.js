const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const OldGold = require('../models/OldGold');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const { body, validationResult } = require('express-validator');

// @route   GET /api/old-gold
// @desc    Get all old gold records
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, customer } = req.query;
    let query = {};

    if (status) query.status = status;
    if (customer) query.customer = customer;

    const oldGold = await OldGold.find(query)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .populate('adjustedAgainst.invoice')
      .sort({ createdAt: -1 });

    res.json(oldGold);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/old-gold
// @desc    Create old gold record
// @access  Private
router.post('/', [
  auth,
  body('customer').notEmpty().withMessage('Customer is required'),
  body('weight').isNumeric().withMessage('Weight must be a number'),
  body('purity').notEmpty().withMessage('Purity is required'),
  body('rate').isNumeric().withMessage('Rate must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { weight, purity, rate, purityTested, testNotes, paymentMode } = req.body;
    const totalValue = weight * rate;

    const oldGold = new OldGold({
      customer: req.body.customer,
      weight,
      purity,
      rate,
      totalValue,
      purityTested: purityTested || false,
      testNotes,
      createdBy: req.user.id
    });

    await oldGold.save();

    // Record money outflow for buying old gold
    await Transaction.create({
      type: 'DEBIT',
      category: 'OLD_GOLD',
      amount: totalValue,
      paymentMode: paymentMode || 'Cash',
      description: `Old Gold Buy (${weight}g @ ${rate})`,
      reference: { model: 'OldGold', id: oldGold._id },
      date: oldGold.createdAt,
      performedBy: req.user.id
    });

    const populated = await OldGold.findById(oldGold._id)
      .populate('customer', 'name phone');

    res.status(201).json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/old-gold/:id/adjust
// @desc    Adjust old gold against invoice
// @access  Private
router.put('/:id/adjust', [
  auth,
  body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const oldGold = await OldGold.findById(req.params.id);
    if (!oldGold) {
      return res.status(404).json({ message: 'Old gold record not found' });
    }

    if (oldGold.status === 'Adjusted') {
      return res.status(400).json({ message: 'Already adjusted' });
    }

    oldGold.status = 'Adjusted';
    oldGold.adjustedAgainst = {
      invoice: req.body.invoiceId,
      amount: req.body.amount
    };

    await oldGold.save();

    res.json(oldGold);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

