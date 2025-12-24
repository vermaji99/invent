const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

// @route   GET /api/transactions
// @desc    Get all transactions with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate, type, category, paymentMode } = req.query;

    let query = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (type) query.type = type;
    if (category) query.category = category;
    if (paymentMode) query.paymentMode = paymentMode;

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate('performedBy', 'name');

    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
