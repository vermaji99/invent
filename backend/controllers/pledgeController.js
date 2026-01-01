const { validationResult } = require('express-validator');
const Pledge = require('../models/Pledge');
const { computeInterestSnapshot } = require('../services/pledgeInterestService');
const Transaction = require('../models/Transaction');

function generateReceiptNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const t = String(now.getTime()).slice(-6);
  return `PLD-${y}${m}${d}-${t}`;
}

async function createPledge(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const payload = req.body;
    const receiptNumber = generateReceiptNumber();
    const snapshot = computeInterestSnapshot(payload.loan);
    const pledge = await Pledge.create({
      receiptNumber,
      status: 'Active',
      customer: payload.customer,
      gold: payload.gold,
      loan: payload.loan,
      totalInterest: snapshot.totalInterest,
      totalPayable: snapshot.totalPayable,
      notes: payload.notes || ''
    });
    try {
      await Transaction.create({
        type: 'DEBIT',
        category: 'EXPENSE',
        amount: Number(payload.loan?.amountGiven || 0),
        paymentMode: 'Cash',
        description: `Pledge Outflow ${receiptNumber}`,
        date: new Date(),
        performedBy: req.user.id
      });
    } catch (e) {}
    res.status(201).json(pledge);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

async function listPledges(req, res) {
  try {
    const { search, status } = req.query;
    const q = {};
    if (status) q.status = status;
    if (search) {
      q.$or = [
        { receiptNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }
    const pledges = await Pledge.find(q).sort({ createdAt: -1 });
    const enriched = pledges.map(p => {
      const s = computeInterestSnapshot(p.loan);
      return { ...p.toObject(), totalInterest: s.totalInterest, totalPayable: s.totalPayable, overdueDays: s.overdueDays, remainingDays: s.remainingDays };
    });
    res.json(enriched);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getPledgeById(req, res) {
  try {
    const pledge = await Pledge.findById(req.params.id);
    if (!pledge) return res.status(404).json({ message: 'Not found' });
    const s = computeInterestSnapshot(pledge.loan);
    const obj = pledge.toObject();
    obj.totalInterest = s.totalInterest;
    obj.totalPayable = s.totalPayable;
    obj.overdueDays = s.overdueDays;
    obj.remainingDays = s.remainingDays;
    obj.isOverdue = s.overdueDays > 0 && pledge.status === 'Active';
    res.json(obj);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    const allowed = ['Active', 'Redeemed', 'Overdue', 'Auction'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    if (status === 'Auction' && process.env.PLEDGE_AUCTION_ENABLED !== 'true') {
      return res.status(400).json({ message: 'Auction is disabled by policy' });
    }
    const pledge = await Pledge.findById(req.params.id);
    if (!pledge) return res.status(404).json({ message: 'Not found' });
    pledge.status = status;
    // snapshot refresh
    const s = computeInterestSnapshot(pledge.loan);
    pledge.totalInterest = s.totalInterest;
    pledge.totalPayable = s.totalPayable;
    await pledge.save();
    if (status === 'Redeemed') {
      try {
        await Transaction.create({
          type: 'CREDIT',
          category: 'CUSTOMER_PAYMENT',
          amount: Number(pledge.totalPayable || pledge.loan?.amountGiven || 0),
          paymentMode: 'Cash',
          description: `Pledge Redemption ${pledge.receiptNumber}`,
          date: new Date(),
          performedBy: req.user.id
        });
      } catch (e) {}
    }
    res.json(pledge);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deletePledge(req, res) {
  try {
    const pledge = await Pledge.findById(req.params.id);
    if (!pledge) return res.status(404).json({ message: 'Not found' });
    if (pledge.status === 'Active') {
      return res.status(400).json({ message: 'Cannot delete active pledge' });
    }
    await pledge.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMetrics(req, res) {
  try {
    const active = await Pledge.find({ status: 'Active' });
    const overdue = await Pledge.countDocuments({ status: 'Overdue' });
    const totalActiveAmount = active.reduce((sum, p) => sum + (p.loan?.amountGiven || 0), 0);
    res.json({ totalActiveAmount, overdue });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createPledge,
  listPledges,
  getPledgeById,
  updateStatus,
  deletePledge,
  getMetrics
};
