const cron = require('node-cron');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const AlertState = require('../models/AlertState');
const { sendEmail, wrapHtml, table } = require('./emailService');
const { runPledgeReminders } = require('./pledgeReminderService');

async function runLowStockScan() {
  const items = await Product.find({ isActive: true }, { name: 1, quantity: 1, lowStockAlert: 1, _id: 1 });
  for (const p of items) {
    const min = Number(p.lowStockAlert || 0);
    const qty = Number(p.quantity || 0);
    if (min > 0 && qty <= min) {
      const state = await AlertState.findOne({ productId: p._id });
      const resolved = state && state.resolvedAt && qty > (state.lastAlertQuantity ?? qty);
      const already = state && !state.resolvedAt && state.lastAlertQuantity === qty;
      if (already) continue;
      const headers = ['Product', 'Product ID', 'Current Stock', 'Minimum Level', 'Date & Time'];
      const rows = [[p.name, String(p._id), String(qty), String(min), new Date().toLocaleString()]];
      const html = wrapHtml('Low Stock Alert', table(headers, rows));
      const r = await sendEmail({ subject: 'Low Stock Alert', html, to: [process.env.ADMIN_EMAIL] });
      if (!state) {
        await AlertState.create({ productId: p._id, lastAlertQuantity: qty });
      } else {
        state.lastAlertQuantity = qty;
        state.resolvedAt = null;
        await state.save();
      }
    } else {
      const state = await AlertState.findOne({ productId: p._id });
      if (state && !state.resolvedAt) {
        state.resolvedAt = new Date();
        await state.save();
      }
    }
  }
}

function periodStartEnd(period) {
  const now = new Date();
  let start, end;
  if (period === 'weekly') {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return { start, end };
}

async function runPeriodReport(period) {
  const { start, end } = periodStartEnd(period);
  const invoices = await Invoice.find({ createdAt: { $gte: start, $lt: end } });
  let totalSales = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  const itemMap = new Map();
  for (const inv of invoices) {
    totalRevenue += Number(inv.total || 0);
    for (const it of inv.items || []) {
      totalSales += Number(it.quantity || 0);
      const cost = Number(it.purchaseRate || 0) * Number(it.weight || 0);
      totalCost += cost;
      const key = String(it.product || it.name || 'Unknown');
      const prev = itemMap.get(key) || { qty: 0, value: 0 };
      prev.qty += Number(it.quantity || 0);
      prev.value += Number(it.subtotal || 0);
      itemMap.set(key, prev);
    }
  }
  const profitLoss = totalRevenue - totalCost;
  const itemsSoldRows = Array.from(itemMap.entries()).map(([k, v]) => [k, String(v.qty), String(v.value)]);
  const lowStockProducts = await Product.find({ isActive: true, $expr: { $lte: ['$quantity', '$lowStockAlert'] } }, { name: 1, quantity: 1, lowStockAlert: 1 });
  const inventory = await Product.find({ isActive: true }, { name: 1, quantity: 1 });
  const fast = itemsSoldRows.slice().sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 10);
  const slow = itemsSoldRows.slice().sort((a, b) => Number(a[1]) - Number(b[1])).slice(0, 10);
  const summaryHeaders = ['Metric', 'Value'];
  const summaryRows = [
    ['Total sales (qty)', String(totalSales)],
    ['Total revenue', String(totalRevenue)],
    ['Total profit/loss', String(profitLoss)]
  ];
  const html = wrapHtml(`${period === 'weekly' ? 'Weekly' : 'Monthly'} Stock Report`,
    table(summaryHeaders, summaryRows) +
    '<br/>' +
    table(['Item', 'Quantity Sold', 'Value'], itemsSoldRows) +
    '<br/>' +
    table(['Item', 'Quantity'], inventory.map(p => [p.name, String(p.quantity)])) +
    '<br/>' +
    table(['Fast-moving', 'Qty', 'Value'], fast) +
    '<br/>' +
    table(['Slow-moving', 'Qty', 'Value'], slow) +
    '<br/>' +
    table(['Product', 'Qty', 'Min'], lowStockProducts.map(p => [p.name, String(p.quantity), String(p.lowStockAlert)]))
  );
  await sendEmail({ subject: `${period === 'weekly' ? 'Weekly' : 'Monthly'} Stock Report`, html, to: [process.env.ADMIN_EMAIL] });
}

async function runDeadlineScan() {
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const orders = await Order.find({
    isDelivered: false,
    expectedDeliveryDate: { $gte: now, $lte: inTwoDays }
  }, { orderNumber: 1, expectedDeliveryDate: 1, customerDetails: 1 });
  if (orders.length === 0) return;
  const rows = orders.map(o => {
    const due = new Date(o.expectedDeliveryDate);
    const remainingMs = due.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
    return [String(o.orderNumber), String(o.customerDetails?.name || 'N/A'), due.toLocaleString(), `${remainingDays} day(s)`];
  });
  const html = wrapHtml('Upcoming Deadlines (2 days)', table(['Order/Task ID', 'Customer', 'Due Date', 'Remaining'], rows));
  await sendEmail({ subject: 'Deadline Alert', html, to: [process.env.ADMIN_EMAIL] });
}

function initScheduler() {
  cron.schedule('*/30 * * * *', runLowStockScan);
  cron.schedule('0 8 * * 1', () => runPeriodReport('weekly'));
  cron.schedule('0 8 1 * *', () => runPeriodReport('monthly'));
  cron.schedule('0 9 * * *', runDeadlineScan);
  cron.schedule('15 9 * * *', runPledgeReminders);
}

module.exports = {
  initScheduler,
  runLowStockScan,
  runPeriodReport,
  runDeadlineScan
};
