const mongoose = require('mongoose');

const goldPriceSchema = new mongoose.Schema({
  rate24K: {
    type: Number,
    required: true
  },
  rate22K: {
    type: Number,
    required: true
  },
  rate18K: {
    type: Number,
    required: true
  },
  makingChargePercent: {
    type: Number,
    default: 0
  },
  makingChargeFixed: {
    type: Number,
    default: 0
  },
  gstPercent: {
    type: Number,
    default: 3 // Default 3% GST
  },
  source: {
    type: String,
    enum: ['API', 'Manual'],
    default: 'Manual'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  priceChange24K: {
    type: Number,
    default: 0
  },
  priceChange22K: {
    type: Number,
    default: 0
  },
  priceChange18K: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Get latest price
goldPriceSchema.statics.getLatest = async function() {
  return await this.findOne().sort({ createdAt: -1 });
};

module.exports = mongoose.model('GoldPrice', goldPriceSchema);

