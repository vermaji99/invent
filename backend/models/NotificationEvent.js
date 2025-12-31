const mongoose = require('mongoose');

const notificationEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  targetModel: { type: String, required: true },
  targetId: { type: String, required: true },
  recipients: [{ type: String }],
  status: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
  error: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('NotificationEvent', notificationEventSchema);

