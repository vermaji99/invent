const mongoose = require('mongoose');

const oldGoldPurchaseSchema = new mongoose.Schema({
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
  fineGold: {
    type: Number,
    required: true
  },
  goldRate: {
    type: Number,
    required: true
  },
  deductionPercent: {
    type: Number,
    default: 0
  },
  finalFineGold: {
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
  collection: 'oldGoldPurchases'
});

module.exports = mongoose.model('OldGoldPurchase', oldGoldPurchaseSchema);
