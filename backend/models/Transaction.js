const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['CREDIT', 'DEBIT'], // CREDIT = Money In, DEBIT = Money Out
    required: true
  },
  category: {
    type: String,
    enum: ['SALES', 'PURCHASE', 'EXPENSE', 'OLD_GOLD', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'ORDER_ADVANCE', 'OTHER'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Exchange', 'Split'],
    required: true
  },
  description: {
    type: String
  },
  reference: {
    model: {
      type: String,
      enum: ['Invoice', 'Purchase', 'Expense', 'Payment', 'OldGold', 'SupplierPayment', 'Order']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  date: {
    type: Date,
    default: Date.now
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
