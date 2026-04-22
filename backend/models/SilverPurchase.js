const mongoose = require('mongoose');

const silverPurchaseSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  weight: {
    type: Number,
    required: true
  },
  purity: {
    type: Number,
    required: true
  },
  fineSilver: {
    type: Number,
    required: true
  },
  silverRate: {
    type: Number,
    required: true
  },
  deductionPercent: {
    type: Number,
    default: 0
  },
  finalFineSilver: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'silverPurchases'
});

module.exports = mongoose.model('SilverPurchase', silverPurchaseSchema);
