const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const { body, validationResult } = require('express-validator');

// @route   GET /api/payments
// @desc    Get all customer payments
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('customer', 'name phone')
      .populate('invoice', 'invoiceNumber')
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });
    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/payments
// @desc    Create new customer payment (Arrears)
// @access  Private
router.post('/', [
  auth,
  body('customer').notEmpty().withMessage('Customer is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('paymentMode').notEmpty().withMessage('Payment mode is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customer, invoice, amount, paymentMode, notes, paymentDate } = req.body;

    const newPayment = new Payment({
      customer,
      invoice,
      amount,
      paymentMode,
      notes,
      paymentDate: paymentDate || Date.now(),
      createdBy: req.user.id
    });

    await newPayment.save();

    // Update Customer Total Due
    const customerDoc = await Customer.findById(customer);
    if (customerDoc) {
      customerDoc.totalDue -= amount;
      if (customerDoc.totalDue < 0) customerDoc.totalDue = 0; // Prevent negative due? Or allow for advance?
      // Assuming simple arrears for now.
      await customerDoc.save();
    }

    // Update Invoice if linked
    if (invoice) {
      const invoiceDoc = await Invoice.findById(invoice);
      if (invoiceDoc) {
        invoiceDoc.paidAmount += amount;
        invoiceDoc.dueAmount -= amount;
        if (invoiceDoc.dueAmount <= 0) {
           invoiceDoc.dueAmount = 0;
           invoiceDoc.status = 'Paid';
        } else {
           invoiceDoc.status = 'Partial';
        }
        await invoiceDoc.save();
      }
    } else {
        // Auto-settle pending invoices (FIFO)
        const pendingInvoices = await Invoice.find({
            customer: customer,
            status: { $in: ['Pending', 'Partial'] }
        }).sort({ createdAt: 1 });

        let remainingAmount = amount;
        for (const inv of pendingInvoices) {
            if (remainingAmount <= 0) break;

            if (inv.dueAmount <= remainingAmount) {
                const pay = inv.dueAmount;
                inv.paidAmount += pay;
                remainingAmount -= pay;
                inv.dueAmount = 0;
                inv.status = 'Paid';
            } else {
                inv.paidAmount += remainingAmount;
                inv.dueAmount -= remainingAmount;
                remainingAmount = 0;
                inv.status = 'Partial';
            }
            await inv.save();
        }
    }

    // Create Transaction
    await Transaction.create({
      type: 'CREDIT',
      category: 'CUSTOMER_PAYMENT',
      amount,
      paymentMode,
      description: `Payment from ${customerDoc ? customerDoc.name : 'Customer'}`,
      reference: {
        model: 'Payment',
        id: newPayment._id
      },
      date: newPayment.paymentDate,
      performedBy: req.user.id
    });

    const populatedPayment = await Payment.findById(newPayment._id)
      .populate('customer', 'name')
      .populate('invoice', 'invoiceNumber');

    res.status(201).json(populatedPayment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
