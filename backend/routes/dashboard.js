const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const GoldPrice = require('../models/GoldPrice');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');
const OldGold = require('../models/OldGold');
const SupplierPayment = require('../models/SupplierPayment');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // --- SALES ---
    const todaySales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    const monthlySales = await Invoice.aggregate([
      { $match: { createdAt: { $gte: startOfMonth, $lt: startOfNextMonth } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]);

    // --- PROFIT & LOSS (Today and Month) ---
  async function computeNetProfit(start, end) {
    const matchQuery = {};
    if (start || end) {
      matchQuery.createdAt = {};
      if (start) matchQuery.createdAt.$gte = start;
      if (end) matchQuery.createdAt.$lt = end;
    }
    const salesAgg = await Invoice.aggregate([
      { $match: matchQuery },
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          grossSales: {
            $sum: {
              $add: [
                { $ifNull: ['$items.subtotal', 0] },
                { $ifNull: ['$items.oldGoldAdjustment', 0] },
                { $ifNull: ['$items.discount', 0] }
              ]
            }
          },
          cogs: {
            $sum: {
              $add: [
                { $multiply: [{ $ifNull: ['$items.purchaseRate', 0] }, '$items.weight'] },
                { $ifNull: ['$items.otherCost', 0] }
              ]
            }
          },
          makingCharges: { $sum: '$items.makingCharge' },
          wastage: { $sum: '$items.wastage' },
          itemDiscounts: { $sum: '$items.discount' },
          oldGoldAdj: { $sum: { $ifNull: ['$items.oldGoldAdjustment', 0] } }
        }
      }
    ]);
    let agg = salesAgg[0];
    if (!agg) {
      const invoices = await Invoice.find(matchQuery, { items: 1, _id: 0 });
      agg = {
        grossSales: 0,
        cogs: 0,
        makingCharges: 0,
        wastage: 0,
        itemDiscounts: 0,
        oldGoldAdj: 0
      };
      for (const inv of invoices) {
        for (const it of (inv.items || [])) {
          agg.grossSales += (it.subtotal || 0) + (it.oldGoldAdjustment || 0) + (it.discount || 0);
          agg.cogs += ((it.purchaseRate || 0) * (it.weight || 0)) + (it.otherCost || 0);
          agg.makingCharges += (it.makingCharge || 0);
          agg.wastage += (it.wastage || 0);
          agg.itemDiscounts += (it.discount || 0);
          agg.oldGoldAdj += (it.oldGoldAdjustment || 0);
        }
      }
    }
    // Include Delivered Orders when invoices are missing or incomplete
    const orderMatch = { orderStatus: 'DELIVERED' };
    if (start || end) {
      orderMatch.actualDeliveryDate = {};
      if (start) orderMatch.actualDeliveryDate.$gte = start;
      if (end) orderMatch.actualDeliveryDate.$lt = end;
    }
    const invCount = await Invoice.countDocuments(matchQuery);
    if (invCount === 0) {
      const deliveredOrders = await Order.find(orderMatch).populate('items.product');
      if (deliveredOrders.length > 0) {
        const latestGoldRate = await GoldPrice.getLatest();
        for (const ord of deliveredOrders) {
          for (const it of (ord.items || [])) {
            const qty = Number(it.quantity || 1);
            const wt = Number(it.weight || 0) * qty;
            const subtotal = Number(it.price || 0) * qty;
            agg.grossSales += subtotal;
            // Compute COGS (approx) for orders without invoice
            let purchaseRate = 0;
            if (it.product) {
              const prod = it.product;
              purchaseRate = (Number(prod.purchasePrice || 0) && Number(prod.grossWeight || 0))
                ? (Number(prod.purchasePrice) / Number(prod.grossWeight))
                : 0;
            } else if (latestGoldRate) {
              const purity = (it.purity || '22K').replace(/\s+/g, '');
              const rateKey = purity === '24K' ? 'rate24K' : purity === '18K' ? 'rate18K' : 'rate22K';
              purchaseRate = latestGoldRate[rateKey] || latestGoldRate.rate22K || 0;
            }
            agg.cogs += purchaseRate * wt;
          }
        }
      }
    }
    const invoiceDiscounts = await Invoice.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, totalDiscount: { $sum: '$discount' } } }
    ]);
    const globalDiscount = invoiceDiscounts[0]?.totalDiscount || 0;
    const itemDiscounts = agg.itemDiscounts || 0;
    const totalDiscounts = globalDiscount + itemDiscounts;
      const rawRevenue = agg.grossSales || 0;
      const netSales = rawRevenue - totalDiscounts;
      const grossProfit = netSales - (agg.cogs || 0);
      const expenseDateRange = {};
      if (start) expenseDateRange.$gte = start;
      if (end) expenseDateRange.$lt = end;
      const expenseMatch = (start || end)
        ? { $or: [ { date: expenseDateRange }, { createdAt: expenseDateRange } ] }
        : {};
      const expenseAgg = await Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const txDateRange = {};
      if (start) txDateRange.$gte = start;
      if (end) txDateRange.$lt = end;
      const txMatch = (start || end)
        ? { category: 'EXPENSE', $or: [ { date: txDateRange }, { createdAt: txDateRange } ] }
        : { category: 'EXPENSE' };
      const txExpenseAgg = await Transaction.aggregate([
        { $match: txMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const txTotalExpenses = txExpenseAgg[0]?.total || 0;
      const totalExpenses = (expenseAgg[0]?.total || 0) || txTotalExpenses;
      const netProfit = grossProfit - totalExpenses;
      const salesByCategory = await Invoice.aggregate([
        { $match: matchQuery },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: '$prod' },
        {
          $group: {
            _id: '$prod.category',
            salesAmount: { $sum: '$items.subtotal' },
            cogsAmount: { $sum: { $multiply: [{ $ifNull: ['$items.purchaseRate', 0] }, '$items.weight'] } }
          }
        },
        { $sort: { salesAmount: -1 } }
      ]);
      let expensesByCategory = await Expense.aggregate([
        { $match: expenseMatch },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } }
      ]);
      if ((!expensesByCategory || expensesByCategory.length === 0) && txTotalExpenses > 0) {
        expensesByCategory = [{ _id: 'Expenses', total: txTotalExpenses }];
      }
      return {
        netSales,
        cogs: agg.cogs || 0,
        grossProfit,
        expenses: totalExpenses,
        netProfit,
        detail: {
          revenueBreakdown: {
            makingCharges: agg.makingCharges || 0,
            wastage: agg.wastage || 0,
            discounts: totalDiscounts,
            oldGoldAdjustment: agg.oldGoldAdj || 0
          },
          salesByCategory: salesByCategory.map(s => ({ category: s._id, salesAmount: s.salesAmount, cogsAmount: s.cogsAmount })),
          expensesByCategory: expensesByCategory.map(e => ({ category: e._id, total: e.total }))
        }
      };
    }

    const todayPL = await computeNetProfit(today, tomorrow);
    const monthPL = await computeNetProfit(startOfMonth, startOfNextMonth);

    // --- PROFIT (Improved Logic) ---
    // Note: To fix Profit & Loss correctly (Item 4), we need detailed cost tracking.
    // For now, using the existing logic but we will refine it in the P&L task.
    // We will stick to the requested "Money Flow" focus here.

    // --- MONEY FLOW CALCULATIONS (Using Transaction Ledger) ---
    const transactions = await Transaction.find({});

    let totalCashIn = 0;
    let totalCashOut = 0;
    let bankBalance = 0;
    let onlinePaymentsIn = 0;
    
    // Breakdown
    let salesTotal = 0;
    let customerPaymentsTotal = 0;
    let advancesTotal = 0;
    let purchaseOutflow = 0;
    let expenseOutflow = 0;

    transactions.forEach(txn => {
       const val = txn.amount;
       
       // Cash vs Bank Calculation
       if (txn.paymentMode === 'Cash') {
          if (txn.type === 'CREDIT') {
             totalCashIn += val;
          } else {
             totalCashOut += val;
          }
       } else {
          // Non-Cash (Bank, UPI, Card, etc.)
          if (txn.type === 'CREDIT') {
             bankBalance += val;
             if (['UPI', 'Card', 'Bank Transfer'].includes(txn.paymentMode)) {
                onlinePaymentsIn += val;
             }
          } else {
             bankBalance -= val;
          }
       }
       
       // Category Breakdown
       if (txn.category === 'SALES') salesTotal += val;
       else if (txn.category === 'CUSTOMER_PAYMENT') customerPaymentsTotal += val;
       else if (txn.category === 'PURCHASE' || txn.category === 'SUPPLIER_PAYMENT') purchaseOutflow += val;
       else if (txn.category === 'EXPENSE') expenseOutflow += val;
    });

    const totalCashInShop = totalCashIn - totalCashOut;

    // Old Gold Value (Asset Source)
    const oldGoldStats = await OldGold.aggregate([
        { $group: { _id: null, totalValue: { $sum: '$totalValue' } } }
    ]);
    const oldGoldTotal = oldGoldStats[0]?.totalValue || 0;

    const advAgg = await Order.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.type': 'ADVANCE' } },
      { $group: { _id: null, total: { $sum: '$payments.amount' } } }
    ]);
    advancesTotal = advAgg[0]?.total || 0;



    // --- OTHER STATS ---
    // Purchases outflow fallback: use sum of paid amounts on purchases to ensure visibility
    const purchasePaidAgg = await Purchase.aggregate([
      { $group: { _id: null, totalPaid: { $sum: '$paidAmount' } } }
    ]);
    const purchasePaidTotal = purchasePaidAgg[0]?.totalPaid || 0;
    // If transaction-based outflow is zero or missing, fall back to purchase paid total
    purchaseOutflow = purchaseOutflow || purchasePaidTotal;
    
    // Cash usage breakdown and recent cash debits
    const cashDebits = transactions
      .filter(t => t.paymentMode === 'Cash' && t.type === 'DEBIT')
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const cashUsageMap = {};
    cashDebits.forEach(t => {
      const key = t.category || 'OTHER';
      cashUsageMap[key] = (cashUsageMap[key] || 0) + t.amount;
    });
    const cashUsageBreakdown = Object.keys(cashUsageMap).map(k => ({ category: k, amount: cashUsageMap[k] }));
    const cashUsageRecent = cashDebits.slice(0, 10).map(t => ({
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.date || t.createdAt
    }));
    const cashCredits = transactions
      .filter(t => t.paymentMode === 'Cash' && t.type === 'CREDIT')
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const cashSourceMap = {};
    cashCredits.forEach(t => {
      const key = t.category || 'OTHER';
      cashSourceMap[key] = (cashSourceMap[key] || 0) + t.amount;
    });
    const cashSourceBreakdown = Object.keys(cashSourceMap).map(k => ({ category: k, amount: cashSourceMap[k] }));
    const cashSourceRecent = cashCredits.slice(0, 10).map(t => ({
      amount: t.amount,
      category: t.category,
      description: t.description,
      date: t.date || t.createdAt
    }));
    const stockValue = await Product.aggregate([
      { $match: { isActive: true, $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: '$category',
          totalValue: {
            $sum: {
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                {
                  $multiply: [
                    { $ifNull: ['$purchasePrice', 0] },
                    {
                      $cond: [
                        { $gt: [{ $ifNull: ['$availableWeight', 0] }, 0] },
                        { $ifNull: ['$availableWeight', 0] },
                        {
                          $multiply: [
                            { $ifNull: ['$netWeight', 0] },
                            { $ifNull: ['$quantity', 0] }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  $multiply: [
                    { $ifNull: ['$purchasePrice', 0] },
                    {
                      $multiply: [
                        { $ifNull: ['$netWeight', 0] },
                        { $ifNull: ['$quantity', 0] }
                      ]
                    }
                  ]
                }
              ]
            }
          },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    // Stock net weight totals by category (netWeight * quantity)
    const stockWeightsAgg = await Product.aggregate([
      { $match: { isActive: true, $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: '$category',
          totalNetWeight: { 
            $sum: { 
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                { $ifNull: ['$availableWeight', 0] },
                { $multiply: [{ $ifNull: ['$netWeight', 0] }, { $ifNull: ['$quantity', 0] }] }
              ]
            } 
          }
        }
      }
    ]);
    const stockWeightsByCategory = stockWeightsAgg.map(x => ({ category: x._id, totalNetWeight: x.totalNetWeight }));
    const goldAgg = await Product.aggregate([
      { $match: { isActive: true, category: 'Gold', $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: null,
          totalNetWeight: { 
            $sum: { 
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                { $ifNull: ['$availableWeight', 0] },
                { $multiply: [{ $ifNull: ['$netWeight', 0] }, { $ifNull: ['$quantity', 0] }] }
              ]
            } 
          }
        }
      }
    ]);
    const silverAgg = await Product.aggregate([
      { $match: { isActive: true, category: 'Silver', $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: null,
          totalNetWeight: { 
            $sum: { 
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                { $ifNull: ['$availableWeight', 0] },
                { $multiply: [{ $ifNull: ['$netWeight', 0] }, { $ifNull: ['$quantity', 0] }] }
              ]
            } 
          }
        }
      }
    ]);
    const diamondAgg = await Product.aggregate([
      { $match: { isActive: true, category: 'Diamond', $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: null,
          totalNetWeight: { 
            $sum: { 
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                { $ifNull: ['$availableWeight', 0] },
                { $multiply: [{ $ifNull: ['$netWeight', 0] }, { $ifNull: ['$quantity', 0] }] }
              ]
            } 
          }
        }
      }
    ]);
    const platinumAgg = await Product.aggregate([
      { $match: { isActive: true, category: 'Platinum', $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: null,
          totalNetWeight: { 
            $sum: { 
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                { $ifNull: ['$availableWeight', 0] },
                { $multiply: [{ $ifNull: ['$netWeight', 0] }, { $ifNull: ['$quantity', 0] }] }
              ]
            } 
          }
        }
      }
    ]);
    const otherAgg = await Product.aggregate([
      { $match: { isActive: true, category: 'Other', $or: [ { quantity: { $gt: 0 } }, { availableWeight: { $gt: 0 } } ] } },
      {
        $group: {
          _id: null,
          totalNetWeight: { 
            $sum: { 
              $cond: [
                { $eq: ['$isWeightManaged', true] },
                { $ifNull: ['$availableWeight', 0] },
                { $multiply: [{ $ifNull: ['$netWeight', 0] }, { $ifNull: ['$quantity', 0] }] }
              ]
            } 
          }
        }
      }
    ]);
    const weights = {
      gold: goldAgg[0]?.totalNetWeight || 0,
      silver: silverAgg[0]?.totalNetWeight || 0,
      diamond: diamondAgg[0]?.totalNetWeight || 0,
      platinum: platinumAgg[0]?.totalNetWeight || 0,
      other: otherAgg[0]?.totalNetWeight || 0
    };
    // Old metal weights split (Gold vs Silver) based on category
    const oldMetals = await OldGold.find({}, { weight: 1, category: 1, purity: 1 });
    let oldGoldWeight = 0;
    let oldSilverWeight = 0;
    
    oldMetals.forEach(og => {
      const p = (og.purity || '').toLowerCase();
      const isGold = /\b\d{2}\s*k\b/.test(p) || /\bk\b/.test(p);
      const isSilver = /925/.test(p) || /silver/.test(p);
      if (isGold) {
        oldGoldWeight += og.weight || 0;
      } else if (isSilver) {
        oldSilverWeight += og.weight || 0;
      } else if (og.category === 'Gold') {
        oldGoldWeight += og.weight || 0;
      } else if (og.category === 'Silver') {
        oldSilverWeight += og.weight || 0;
      }
    });

    const pendingDues = await Invoice.aggregate([
      { $match: { status: { $in: ['Partial', 'Pending'] } } },
      { $group: { _id: null, total: { $sum: '$dueAmount' } } }
    ]);

    const lowStock = await Product.find({
      $expr: { $lte: ['$quantity', '$lowStockAlert'] },
      isActive: true
    }).select('name category quantity lowStockAlert');

    const goldPrice = await GoldPrice.getLatest();

    // Sales Trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const salesTrend = await Invoice.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      todaySales: todaySales[0]?.total || 0,
      todaySalesCount: todaySales[0]?.count || 0,
      monthlySales: monthlySales[0]?.total || 0,
      monthlySalesCount: monthlySales[0]?.count || 0,
      
      // Money Flow Stats
      totalCashInShop,
      bankBalance,
      onlinePayments: onlinePaymentsIn,
      
      moneySource: {
        sales: salesTotal,
        oldGold: oldGoldTotal,
        customerPayments: customerPaymentsTotal,
        advances: advancesTotal
      },
      
      moneyUsage: {
        purchases: purchaseOutflow, // Includes supplier payments
        expenses: expenseOutflow
      },
      cashSourceBreakdown,
      cashSourceRecent,
      cashUsageBreakdown,
      cashUsageRecent,

      stockValue,
      totalStockValue: stockValue.reduce((sum, item) => sum + item.totalValue, 0),
      stockWeightsByCategory,
      weights,
      oldMetalWeights: { gold: oldGoldWeight, silver: oldSilverWeight },
      pendingDues: pendingDues[0]?.total || 0,
      lowStock,
      goldPrice,
      salesTrend
      ,
      // Profit/Loss summary
      todayNetProfit: todayPL.netProfit,
      todayRevenue: todayPL.netSales,
      todayCogs: todayPL.cogs,
      todayExpenses: todayPL.expenses,
      todayNetProfitDetail: todayPL.detail,
      monthlyNetProfit: monthPL.netProfit,
      monthlyRevenue: monthPL.netSales,
      monthlyCogs: monthPL.cogs,
      monthlyExpenses: monthPL.expenses,
      monthlyNetProfitDetail: monthPL.detail
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/cash-ledger
// @desc    Detailed cash inflow/outflow ledger with references
// @access  Private
router.get('/cash-ledger', auth, async (req, res) => {
  try {
    const { start, end, limit = 100 } = req.query;
    const match = { paymentMode: 'Cash' };
    const dateQuery = {};
    if (start) dateQuery.$gte = new Date(start);
    if (end) dateQuery.$lte = new Date(end);
    if (Object.keys(dateQuery).length) {
      // Prefer explicit transaction date, fallback to createdAt
      match.$or = [
        { date: dateQuery },
        { createdAt: dateQuery }
      ];
    }
    const txns = await Transaction.find(match).sort({ date: -1, createdAt: -1 }).limit(Number(limit));
    
    let cashIn = 0;
    let cashOut = 0;
    const inflowCat = {};
    const outflowCat = {};
    
    const inflowDetails = [];
    const outflowDetails = [];
    
    const invoiceIds = new Set();
    const orderIds = new Set();
    
    txns.forEach(t => {
      if (t.type === 'CREDIT') cashIn += t.amount;
      else cashOut += t.amount;
      
      const cat = t.category || 'OTHER';
      if (t.type === 'CREDIT') inflowCat[cat] = (inflowCat[cat] || 0) + t.amount;
      else outflowCat[cat] = (outflowCat[cat] || 0) + t.amount;
      
      if (t.reference?.model === 'Invoice' && t.reference?.id) invoiceIds.add(String(t.reference.id));
      if (t.reference?.model === 'Order' && t.reference?.id) orderIds.add(String(t.reference.id));
    });
    
    const invoices = await Invoice.find({ _id: { $in: Array.from(invoiceIds) } }, { invoiceNumber: 1 });
    const orders = await Order.find({ _id: { $in: Array.from(orderIds) } }, { orderNumber: 1 });
    const invoiceMap = new Map(invoices.map(i => [String(i._id), i.invoiceNumber]));
    const orderMap = new Map(orders.map(o => [String(o._id), o.orderNumber]));
    
    txns.forEach(t => {
      const base = {
        amount: t.amount,
        category: t.category || 'OTHER',
        description: t.description || '',
        date: t.date || t.createdAt,
        reference: t.reference || null,
        referenceLabel: null
      };
      if (t.reference?.model === 'Invoice') {
        base.referenceLabel = invoiceMap.get(String(t.reference.id)) || null;
      } else if (t.reference?.model === 'Order') {
        base.referenceLabel = orderMap.get(String(t.reference.id)) || null;
      }
      if (t.type === 'CREDIT') inflowDetails.push(base);
      else outflowDetails.push(base);
    });
    
    res.json({
      totals: {
        cashIn,
        cashOut,
        netCash: cashIn - cashOut
      },
      inflows: {
        byCategory: Object.keys(inflowCat).map(k => ({ category: k, amount: inflowCat[k] })),
        details: inflowDetails
      },
      outflows: {
        byCategory: Object.keys(outflowCat).map(k => ({ category: k, amount: outflowCat[k] })),
        details: outflowDetails
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
