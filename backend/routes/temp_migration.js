// @route   POST /api/dashboard/migrate-transactions
// @desc    Migrate existing data to Transaction model
// @access  Private
router.post('/migrate-transactions', auth, async (req, res) => {
  try {
    // 1. Clear existing transactions to avoid duplicates (Optional: skip if you want additive)
    // await Transaction.deleteMany({}); 
    // BETTER: Check existence before adding.

    let count = 0;

    // --- Invoices ---
    const invoices = await Invoice.find();
    for (const inv of invoices) {
      if (inv.paidAmount > 0) {
        const exists = await Transaction.findOne({ 'reference.id': inv._id, 'reference.model': 'Invoice', category: 'SALES' });
        if (!exists) {
           await Transaction.create({
             type: 'CREDIT',
             category: 'SALES',
             amount: inv.paidAmount,
             paymentMode: inv.paymentMode === 'Split' ? 'Cash' : inv.paymentMode, // Fallback for split
             description: `Migrated Invoice Sale`,
             reference: { model: 'Invoice', id: inv._id },
             date: inv.createdAt,
             performedBy: req.user.id
           });
           count++;
        }
      }
    }

    // --- Purchases ---
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
             performedBy: req.user.id
           });
           count++;
        }
      }
    }

    // --- Expenses ---
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
           performedBy: req.user.id
         });
         count++;
      }
    }

    // --- Supplier Payments ---
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
           performedBy: req.user.id
         });
         count++;
      }
    }
    
    // --- Customer Payments ---
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
           performedBy: req.user.id
         });
         count++;
      }
    }

    res.json({ message: `Migration complete. Added ${count} transactions.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during migration' });
  }
});
