const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  preferredJewelleryType: {
    type: String,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Other', ''],
    default: ''
  },
  birthday: {
    type: Date
  },
  anniversary: {
    type: Date
  },
  isHighValue: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster searches
customerSchema.index({ phone: 1 });
customerSchema.index({ name: 'text' });

module.exports = mongoose.model('Customer', customerSchema);

