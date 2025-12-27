const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  // Snapshot of product details at time of order
  sku: String,
  purity: String,
  weight: Number,
  // Custom Order Details
  targetWeight: String, // e.g. "10-12g"
  designImage: String, // URL or Path
  specialInstructions: String,
  size: String,
  itemType: String, // e.g. "Ring", "Chain"
  purchaseRate: { type: Number, default: 0 },
  makingCharge: { type: Number, default: 0 },
  wastage: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  oldGoldAdjustment: { type: Number, default: 0 },
  otherCost: { type: Number, default: 0 },
  manualRate: { type: Number, default: 0 }
  ,
  appliedRate: { type: Number, default: 0 } // last used metal rate (₹/g)
});

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  method: {
    type: String,
    enum: ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER'],
    default: 'CASH'
  },
  type: {
    type: String,
    enum: ['ADVANCE', 'PARTIAL', 'FINAL'],
    required: true
  },
  notes: String
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  customerDetails: { // Snapshot for quick access or if customer is deleted/guest
    name: String,
    phone: String,
    email: String
  },
  items: [orderItemSchema],
  
  // Financials
  totalAmount: {
    type: Number,
    required: true
  },
  advanceAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    required: true
  },
  
  // Statuses
  orderStatus: {
    type: String,
    enum: ['PENDING', 'PARTIALLY_PAID', 'READY', 'DELIVERED', 'CANCELLED'],
    default: 'PENDING'
  },
  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'ADVANCE_PAID', 'FULL_PAID'],
    default: 'UNPAID'
  },
  
  // Dates
  expectedDeliveryDate: {
    type: Date,
    required: true
  },
  actualDeliveryDate: Date,
  
  // Payment History
  payments: [paymentSchema],
  
  notes: String,
  
  // Flags
  isDelivered: {
    type: Boolean,
    default: false
  },
  inventoryUpdated: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ expectedDeliveryDate: 1 });
orderSchema.index({ 'customerDetails.phone': 1 });
// orderNumber is already indexed via unique: true

module.exports = mongoose.model('Order', orderSchema);
