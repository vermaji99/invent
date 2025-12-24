const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  type: {
    type: String,
    default: 'general',
    unique: true
  },
  shopDetails: {
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    logoUrl: { type: String, default: '' }
  },
  invoiceSettings: {
    footerText: { type: String, default: 'Thank you for your business!' },
    showGST: { type: Boolean, default: true },
    showTerms: { type: Boolean, default: true },
    termsText: { type: String, default: 'Goods once sold will not be taken back or exchanged.' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
