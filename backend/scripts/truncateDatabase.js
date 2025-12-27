const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
}
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const Expense = require('../models/Expense');
const OldGold = require('../models/OldGold');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const GoldPrice = require('../models/GoldPrice');

async function main() {
  const yes = process.argv.includes('--yes');
  const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
  const keep = (process.argv.find(a => a.startsWith('--keep=')) || '').split('=')[1];
  if (!yes) {
    console.error('Pass --yes to confirm truncation');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery_shop');
  const map = {
    customers: Customer,
    suppliers: Supplier,
    products: Product,
    invoices: Invoice,
    payments: Payment,
    purchases: Purchase,
    supplierPayments: SupplierPayment,
    expenses: Expense,
    oldGold: OldGold,
    orders: Order,
    transactions: Transaction,
    settings: Settings,
    goldPrice: GoldPrice
  };
  let targets = Object.keys(map);
  if (only) {
    targets = only.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (keep) {
    const ks = keep.split(',').map(s => s.trim()).filter(Boolean);
    targets = targets.filter(t => !ks.includes(t));
  }
  for (const key of targets) {
    const Model = map[key];
    if (!Model) continue;
    const res = await Model.deleteMany({});
    console.log(`${key}: ${res.deletedCount}`);
  }
  await mongoose.disconnect();
  console.log('done');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
