const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');

// @route   POST /api/expenses
// @desc    Add new expense
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { category, amount, description, paymentMode, date } = req.body;

    const newExpense = new Expense({
      category,
      amount,
      description,
      paymentMode,
      date: date || Date.now(),
      createdBy: req.user.id
    });

    const expense = await newExpense.save();

    // Create Transaction Record
    await Transaction.create({
      type: 'DEBIT',
      category: 'EXPENSE',
      amount,
      paymentMode,
      description: `Expense: ${category} - ${description}`,
      reference: {
        model: 'Expense',
        id: expense._id
      },
      date: expense.date,
      performedBy: req.user.id
    });

    res.json(expense);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/expenses
// @desc    Get all expenses
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ msg: 'Expense not found' });
    }

    await expense.remove();

    // Remove associated transaction
    await Transaction.findOneAndRemove({
      'reference.id': expense._id,
      'reference.model': 'Expense'
    });

    res.json({ msg: 'Expense removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
