const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const Invoice = require('../models/Invoice');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const SupplierPayment = require('../models/SupplierPayment');
const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');

// Load Env
dotenv.config({ path: path.join(__dirname, '..', '.env') });
// Fallback if not found in backend/.env (try root)
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
}

const migrate = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery_shop', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');

    let count = 0;

    // --- Invoices ---
    console.log('Processing Invoices...');
    const invoices = await Invoice.find();
    for (const inv of invoices) {
      if (inv.paidAmount > 0) {
        const exists = await Transaction.findOne({ 'reference.id': inv._id, 'reference.model': 'Invoice', category: 'SALES' });
        if (!exists) {
           await Transaction.create({
             type: 'CREDIT',
             category: 'SALES',
             amount: inv.paidAmount,
             paymentMode: inv.paymentMode === 'Split' ? 'Cash' : inv.paymentMode,
             description: `Migrated Invoice Sale`,
             reference: { model: 'Invoice', id: inv._id },
             date: inv.createdAt,
             performedBy: inv.createdBy // Assuming createdBy exists
           });
           process.stdout.write('.');
           count++;
        }
      }
    }
    console.log('\nInvoices processed.');

    // --- Purchases ---
    console.log('Processing Purchases...');
    const purchases = await Purchase.find();
    for (const pur of purchases) {
      if (pur.paidAmount > 0) {
        const exists = await Transaction.findOne({ 'reference.id': pur._id, 'reference.model': 'Purchase', category: 'PURCHASE' });
        if (!exists) {
           await Transaction.create({
             type: 'DEBIT',
             category: 'PURCHASE',
             amount: pur.paidAmount,
             paymentMode: pur.paymentMode || 'Cash',
             description: `Migrated Purchase`,
             reference: { model: 'Purchase', id: pur._id },
             date: pur.purchaseDate || pur.createdAt,
             performedBy: pur.createdBy
           });
           process.stdout.write('.');
           count++;
        }
      }
    }
    console.log('\nPurchases processed.');

    // --- Expenses ---
    console.log('Processing Expenses...');
    const expenses = await Expense.find();
    for (const exp of expenses) {
      const exists = await Transaction.findOne({ 'reference.id': exp._id, 'reference.model': 'Expense' });
      if (!exists) {
         await Transaction.create({
           type: 'DEBIT',
           category: 'EXPENSE',
           amount: exp.amount,
           paymentMode: exp.paymentMode,
           description: exp.description,
           reference: { model: 'Expense', id: exp._id },
           date: exp.date,
           performedBy: exp.createdBy
         });
         process.stdout.write('.');
         count++;
      }
    }
    console.log('\nExpenses processed.');

    // --- Supplier Payments ---
    console.log('Processing Supplier Payments...');
    const supplierPayments = await SupplierPayment.find();
    for (const sp of supplierPayments) {
      const exists = await Transaction.findOne({ 'reference.id': sp._id, 'reference.model': 'SupplierPayment' });
      if (!exists) {
         await Transaction.create({
           type: 'DEBIT',
           category: 'SUPPLIER_PAYMENT',
           amount: sp.amount,
           paymentMode: sp.paymentMode,
           description: `Migrated Supplier Payment`,
           reference: { model: 'SupplierPayment', id: sp._id },
           date: sp.paymentDate,
           performedBy: sp.createdBy
         });
         process.stdout.write('.');
         count++;
      }
    }
    console.log('\nSupplier Payments processed.');
    
    // --- Customer Payments ---
    console.log('Processing Customer Payments...');
    const payments = await Payment.find();
    for (const pay of payments) {
      const exists = await Transaction.findOne({ 'reference.id': pay._id, 'reference.model': 'Payment' });
      if (!exists) {
         await Transaction.create({
           type: 'CREDIT',
           category: 'CUSTOMER_PAYMENT',
           amount: pay.amount,
           paymentMode: pay.paymentMode,
           description: `Migrated Customer Payment`,
           reference: { model: 'Payment', id: pay._id },
           date: pay.paymentDate,
           performedBy: pay.createdBy
         });
         process.stdout.write('.');
         count++;
      }
    }
    console.log('\nCustomer Payments processed.');

    console.log(`\nMigration complete. Added ${count} transactions.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration Error:', error);
    process.exit(1);
  }
};

migrate();
