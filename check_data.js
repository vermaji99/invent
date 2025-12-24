const mongoose = require('mongoose');
const Invoice = require('./backend/models/Invoice');
const Expense = require('./backend/models/Expense');
const Purchase = require('./backend/models/Purchase');
const dotenv = require('dotenv');

dotenv.config({ path: './backend/.env' });

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery_shop', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('Connected to MongoDB');

  const invoiceCount = await Invoice.countDocuments();
  const expenseCount = await Expense.countDocuments();
  const purchaseCount = await Purchase.countDocuments();

  console.log(`Invoices: ${invoiceCount}`);
  console.log(`Expenses: ${expenseCount}`);
  console.log(`Purchases: ${purchaseCount}`);

  if (invoiceCount > 0) {
    const firstInvoice = await Invoice.findOne().sort({ createdAt: 1 });
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
    console.log(`First Invoice Date: ${firstInvoice.createdAt}`);
    console.log(`Last Invoice Date: ${lastInvoice.createdAt}`);
  }

  if (expenseCount > 0) {
    const firstExpense = await Expense.findOne().sort({ date: 1 });
    const lastExpense = await Expense.findOne().sort({ date: -1 });
    console.log(`First Expense Date: ${firstExpense.date}`);
    console.log(`Last Expense Date: ${lastExpense.date}`);
  }

  process.exit();
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
