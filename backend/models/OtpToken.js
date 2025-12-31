const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  code: { type: String, required: true },
  purpose: { type: String, enum: ['RESET', 'ACTION'], required: true },
  channel: { type: String, enum: ['email', 'sms'], default: 'email' },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('OtpToken', otpTokenSchema);

