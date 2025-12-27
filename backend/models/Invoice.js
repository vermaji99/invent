const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  quantity: {
    type: Number,
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  purchaseRate: { // Cost price at time of sale
    type: Number,
    default: 0
  },
  makingCharge: {
    type: Number,
    default: 0
  },
  wastage: {
    type: Number,
    default: 0
  },
  otherCost: {
    type: Number,
    default: 0
  },
  gst: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  oldGoldAdjustment: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    required: true
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  gst: {
    type: Number,
    default: 0
  },
  exchange: {
    items: [{
      description: String,
      weight: Number,
      purity: Number,
      rate: Number,
      amount: Number
    }],
    totalAmount: { type: Number, default: 0 }
  },
  total: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Split', 'Credit'],
    required: true
  },
  paidAmount: {
    type: Number,
    required: true
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  paymentDetails: {
    cash: Number,
    upi: Number,
    card: Number
  },
  goldRate: {
    rate24K: Number,
    rate22K: Number,
    rate18K: Number
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Partial', 'Pending'],
    default: 'Paid'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster searches
invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);

