const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Other'],
    required: true
  },
  sku: {
    type: String,
    unique: true,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  grossWeight: {
    type: Number,
    required: true
  },
  netWeight: {
    type: Number,
    required: true
  },
  stoneWeight: {
    type: Number,
    default: 0
  },
  purity: {
    type: String,
    required: true // e.g., "22K", "18K", "925"
  },
  makingChargePerGram: {
    type: Number,
    default: 0
  },
  makingChargeFixed: {
    type: Number,
    default: 0
  },
  wastagePercent: {
    type: Number,
    default: 0
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  sellingPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  images: [{
    type: String
  }],
  huid: {
    type: String,
    trim: true
  },
  huidEnabled: {
    type: Boolean,
    default: false
  },
  hallmark: {
    type: String,
    trim: true
  },
  certification: {
    lab: { type: String, trim: true },
    certNo: { type: String, trim: true },
    remarks: { type: String, trim: true }
  },
  history: [{
    type: {
      type: String,
      enum: ['PURCHASE', 'RESTOCK', 'SOLD', 'RETURN', 'HUID_ADDED']
    },
    date: { type: Date, default: Date.now },
    reference: {
      model: { type: String, trim: true },
      id: { type: mongoose.Schema.Types.ObjectId }
    },
    details: {}
  }],
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lowStockAlert: {
    type: Number,
    default: 5
  },
  barcodeBase64: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster searches
productSchema.index({ category: 1 });
productSchema.index({ name: 'text' });
productSchema.index(
  { huid: 1 },
  { unique: true, partialFilterExpression: { huid: { $exists: true } } }
);

module.exports = mongoose.model('Product', productSchema);

