const mongoose = require('mongoose');

const oldGoldSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  purity: {
    type: String,
    required: true // e.g., "22K", "18K"
  },
  rate: {
    type: Number,
    required: true
  },
  totalValue: {
    type: Number,
    required: true
  },
  purityTested: {
    type: Boolean,
    default: false
  },
  testNotes: {
    type: String
  },
  status: {
    type: String,
    enum: ['Pending', 'Adjusted', 'Sold'],
    default: 'Pending'
  },
  adjustedAgainst: {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    amount: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OldGold', oldGoldSchema);

