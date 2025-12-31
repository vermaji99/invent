const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { body, validationResult } = require('express-validator');
const { sendEmail, wrapHtml, table } = require('../services/emailService');
const ResetLinkToken = require('../models/ResetLinkToken');
const crypto = require('crypto');

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
    let code;
    let expiresAt;
    if (recent && recent.createdAt > new Date(Date.now() - 2 * 60 * 1000)) {
      code = recent.code;
      expiresAt = recent.expiresAt;
    } else {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const ttlMinutes = Number(process.env.OTP_TTL_MIN || 10);
      expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
      await OtpToken.create({ userId: user._id, code, purpose, channel, expiresAt });
    }
    const html = wrapHtml('Admin OTP', table(['Email', 'OTP', 'Expires'], [[email, code, expiresAt.toLocaleString()]]));
    Promise.resolve(sendEmail({ subject: 'Admin OTP', html, to: [email] })).catch(() => {});
    res.json({ message: 'OTP generated. Check your email for the code.' });
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
    const token = crypto.randomBytes(32).toString('hex');
    const ttlMinutes = Number(process.env.OTP_TTL_MIN || 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    await ResetLinkToken.create({ userId: user._id, token, expiresAt });
    const frontend = process.env.FRONTEND_URL || '';
    const resetUrl = frontend ? `${frontend}/reset-password?token=${token}` : `${req.protocol}://${req.get('host')}/api/admin/otp/reset-with-link?token=${token}`;
    const html = wrapHtml('Reset Password Link', `<p>Click the link below to reset your password. This link expires in ${ttlMinutes} minutes.</p><p><a href="${resetUrl}" target="_blank">${resetUrl}</a></p>`);
    await sendEmail({ subject: 'Reset Password Link', html, to: [email] });
    res.json({ message: 'OTP verified. Reset link sent to your email.' });
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
 
// Reset via link token
router.post('/reset-with-link', [
  body('token').isLength({ min: 32 }),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { token, newPassword } = req.body;
    const doc = await ResetLinkToken.findOne({ token, used: false });
    if (!doc) return res.status(400).json({ message: 'Invalid token' });
    if (doc.expiresAt < new Date()) return res.status(400).json({ message: 'Token expired' });
    const user = await User.findById(doc.userId);
    if (!user || user.role !== 'admin' || !user.isActive) return res.status(404).json({ message: 'Admin not found' });
    user.password = newPassword;
    await user.save();
    doc.used = true;
    await doc.save();
    res.json({ message: 'Password updated via link' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});
