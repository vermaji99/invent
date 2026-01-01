const Pledge = require('../models/Pledge');
const { sendEmail, wrapHtml, table } = require('./emailService');

function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

async function runPledgeReminders() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inThreeDays = new Date(startOfToday.getTime() + 3 * 24 * 60 * 60 * 1000);
  const inTwoDays = new Date(startOfToday.getTime() + 2 * 24 * 60 * 60 * 1000);

  const active = await Pledge.find({ status: 'Active' });
  for (const p of active) {
    const due = new Date(p.loan.endDate);
    const principal = Number(p.loan.amountGiven || 0);
    const payable = Number(p.totalPayable || principal);
    let subject = null;
    let when = null;
    if (due.toDateString() === startOfToday.toDateString()) {
      subject = `Pledge Due Today: ${p.receiptNumber}`;
      when = 'Due Today';
    } else if (due.toDateString() === inTwoDays.toDateString() || due.toDateString() === inThreeDays.toDateString()) {
      subject = `Upcoming Pledge Due: ${p.receiptNumber}`;
      when = 'Upcoming';
    } else if (due < startOfToday) {
      subject = `Overdue Pledge Warning: ${p.receiptNumber}`;
      when = 'Overdue';
      if (p.status === 'Active') {
        p.status = 'Overdue';
        await p.save();
      }
    }
    if (!subject) continue;
    const hdrs = ['Receipt', 'Customer', 'Phone', 'Due Date', 'Loan', 'Payable'];
    const rows = [[p.receiptNumber, p.customer.name, p.customer.phone, due.toLocaleDateString('en-IN'), formatINR(principal), formatINR(payable)]];
    const html = wrapHtml(`Pledged Gold Reminder (${when})`, table(hdrs, rows) + '<br/><p>Please visit the shop to complete redemption.</p>');
    await sendEmail({ subject, html, to: [p.customer.email] });
  }
}

module.exports = { runPledgeReminders };
