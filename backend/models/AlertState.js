const mongoose = require('mongoose');

const alertStateSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  lastAlertQuantity: { type: Number, default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('AlertState', alertStateSchema);

