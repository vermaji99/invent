const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { body, validationResult } = require('express-validator');
const { sendEmail, wrapHtml, table } = require('../services/emailService');

router.post('/request', [
  body('email').isEmail(),
  body('purpose').isIn(['RESET', 'ACTION']),
  body('channel').optional().isIn(['email', 'sms'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, purpose, channel = 'email' } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin', isActive: true });
    if (!user) return res.status(404).json({ message: 'Admin not found' });
    const recent = await OtpToken.findOne({ userId: user._id, purpose, used: false }).sort({ createdAt: -1 });
    if (recent && recent.createdAt > new Date(Date.now() - 2 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many requests' });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlMinutes = Number(process.env.OTP_TTL_MIN || 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await OtpToken.create({ userId: user._id, code, purpose, channel, expiresAt });
    const html = wrapHtml('Admin OTP', table(['Email', 'OTP', 'Expires'], [[email, code, expiresAt.toLocaleString()]]));
    const r = await sendEmail({ subject: 'Admin OTP', html, to: [email] });
    if (!r.ok) return res.status(500).json({ message: 'Failed to send OTP' });
    res.json({ message: 'OTP sent' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/verify', [
  body('email').isEmail(),
  body('code').isLength({ min: 6, max: 6 }).matches(/^\d{6}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin', isActive: true });
    if (!user) return res.status(404).json({ message: 'Admin not found' });
    const otp = await OtpToken.findOne({ userId: user._id, code, used: false }).sort({ createdAt: -1 });
    if (!otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (otp.expiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });
    otp.used = true;
    await otp.save();
    res.json({ message: 'OTP verified' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', [
  body('email').isEmail(),
  body('code').isLength({ min: 6, max: 6 }).matches(/^\d{6}$/),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'admin', isActive: true });
    if (!user) return res.status(404).json({ message: 'Admin not found' });
    const otp = await OtpToken.findOne({ userId: user._id, code, used: false }).sort({ createdAt: -1 });
    if (!otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (otp.expiresAt < new Date()) return res.status(400).json({ message: 'OTP expired' });
    otp.used = true;
    await otp.save();
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

