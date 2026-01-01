const mongoose = require('mongoose');
const { Schema } = mongoose;

const CustomerSchema = new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  address: { type: String, required: true, trim: true },
  governmentId: { type: String, required: true, trim: true },
  idProofUrl: { type: String, required: true }
}, { _id: false });

const GoldSchema = new Schema({
  itemName: { type: String, required: true, trim: true },
  grossWeight: { type: Number, required: true, min: 0 },
  netWeight: { type: Number, required: true, min: 0 },
  purity: { type: String, enum: ['22K', '24K', '18K'], required: true },
  valuationAmount: { type: Number, required: true, min: 0 },
  itemPhotoUrl: { type: String },
  damageStatus: { type: String, enum: ['Normal', 'Slight Damage', 'Heavy Damage'], default: 'Normal' }
}, { _id: false });

const LoanSchema = new Schema({
  amountGiven: { type: Number, required: true, min: 0 },
  interestPeriod: { type: String, enum: ['day', 'month'], required: true },
  interestUnit: { type: String, enum: ['amount', 'percent'], required: true },
  interestRate: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  lateExtraPerDay: { type: Number, default: 0, min: 0 }
}, { _id: false });

const PledgeSchema = new Schema({
  receiptNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ['Active', 'Redeemed', 'Overdue', 'Auction'], default: 'Active' },
  customer: { type: CustomerSchema, required: true },
  gold: { type: GoldSchema, required: true },
  loan: { type: LoanSchema, required: true },
  // Computed snapshot (kept in sync on write; recomputed for reads in controller)
  totalInterest: { type: Number, default: 0 },
  totalPayable: { type: Number, default: 0 },
  notes: { type: String },
}, { timestamps: true });

PledgeSchema.index({ 'customer.name': 'text', 'customer.phone': 'text', 'receiptNumber': 'text' });

module.exports = mongoose.model('Pledge', PledgeSchema);

