const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Expense = require('../models/Expense');
const mongoose = require('mongoose');

// @route   GET /api/reports/profit-loss
// @desc    Get profit & loss report
// @access  Private
router.get('/profit-loss', auth, async (req, res) => {
  try {
    const { startDate, endDate, customer, category } = req.query;
    let matchQuery = {};
    let expenseMatchQuery = {};
    let purchaseMatchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      expenseMatchQuery.date = {};
      purchaseMatchQuery.createdAt = {};
      
      if (startDate) {
        const [sy, sm, sd] = startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        matchQuery.createdAt.$gte = start;
        expenseMatchQuery.date.$gte = start;
        purchaseMatchQuery.createdAt.$gte = start;
      }
      if (endDate) {
        const [ey, em, ed] = endDate.split('-').map(Number);
        const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
        expenseMatchQuery.date.$lte = end;
        purchaseMatchQuery.createdAt.$lte = end;
      }
    }
    
    if (customer) {
      try {
        matchQuery.customer = new mongoose.Types.ObjectId(customer);
      } catch (e) {
        // ignore invalid id
      }
    }

    // 1. Sales Analysis (Revenue & COGS)
    // We need to unwind items to calculate COGS per item
    const salesPipeline = [
      { $match: matchQuery },
      { $unwind: '$items' },
    ];
    if (category) {
      salesPipeline.push(
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
        { $unwind: '$prod' },
        { $match: { 'prod.category': category } }
      );
    }
    salesPipeline.push({
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
            $multiply: [{ $ifNull: ['$items.purchaseRate', 0] }, { $ifNull: ['$items.weight', 0] }] 
          } 
        },
        totalMakingCharges: { $sum: { $ifNull: ['$items.makingCharge', 0] } },
        totalWastage: { $sum: { $ifNull: ['$items.wastage', 0] } },
        totalItemDiscounts: { $sum: { $ifNull: ['$items.discount', 0] } }
      }
    });
    const salesData = await Invoice.aggregate(salesPipeline);

    // Fallback: If aggregation returns no rows, compute via direct iteration
    let agg = salesData[0];
    if (!agg) {
      const invoices = await Invoice.find(matchQuery, { items: 1, _id: 0 }).populate('items.product', 'category');
      let grossSalesFallback = 0;
      let cogsFallback = 0;
      let makingFallback = 0;
      let wastageFallback = 0;
      let itemDiscountsFallback = 0;
      for (const inv of invoices) {
        for (const it of (inv.items || [])) {
          if (category && it.product?.category !== category) continue;
          grossSalesFallback += (it.subtotal || 0) + (it.oldGoldAdjustment || 0) + (it.discount || 0);
          cogsFallback += ((it.purchaseRate || 0) * (it.weight || 0));
          makingFallback += (it.makingCharge || 0);
          wastageFallback += (it.wastage || 0);
          itemDiscountsFallback += (it.discount || 0);
        }
      }
      agg = {
        grossSales: grossSalesFallback,
        cogs: cogsFallback,
        totalMakingCharges: makingFallback,
        totalWastage: wastageFallback,
        totalItemDiscounts: itemDiscountsFallback
      };
    }

    // Global Invoice Discounts
    const invoiceDiscounts = await Invoice.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, totalDiscount: { $sum: '$discount' } } }
    ]);

    const globalDiscount = invoiceDiscounts[0]?.totalDiscount || 0;
    const rawRevenue = agg?.grossSales || 0; // This is Gross (before any discount)
    const costOfGoodsSold = agg?.cogs || 0;
    const itemDiscounts = agg?.totalItemDiscounts || 0;
    
    // Net Revenue = Gross - Discounts
    const totalDiscounts = globalDiscount + itemDiscounts;
    const netSales = rawRevenue - totalDiscounts;
    const grossProfit = netSales - costOfGoodsSold;

    // 2. Expenses
    const expenses = await Expense.aggregate([
      { $match: expenseMatchQuery },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalExpenses = expenses[0]?.total || 0;

    // 3. Total Purchases (Inventory Added) - For reference
    const purchases = await Purchase.aggregate([
      { $match: purchaseMatchQuery },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalPurchases = purchases[0]?.total || 0;

    // 4. Net Profit
    // Net Profit = Gross Profit (from Sales) - Expenses
    // Note: Purchase cost is already accounted for in COGS. 
    // Subtracting totalPurchases again would be double counting (and wrong, as inventory is an asset, not expense until sold)
    const netProfit = grossProfit - totalExpenses;

    res.json({
      sales: {
        revenue: netSales,
        cogs: costOfGoodsSold,
        grossProfit: grossProfit,
        breakdown: {
          makingCharges: agg?.totalMakingCharges || 0,
          wastage: agg?.totalWastage || 0,
          discounts: totalDiscounts
        }
      },
      expenses: totalExpenses,
      purchases: totalPurchases, // Cash flow metric
      netProfit: netProfit,
      profitMargin: netSales > 0 ? ((netProfit / netSales) * 100).toFixed(2) : 0
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/stock-valuation
// @desc    Get stock valuation report
// @access  Private
router.get('/stock-valuation', auth, async (req, res) => {
  try {
    const { huidEnabled } = req.query;
    const pipeline = [];
    if (huidEnabled === 'true') {
      pipeline.push({ $match: { huid: { $exists: true } } });
    } else if (huidEnabled === 'false') {
      pipeline.push({ $match: { $or: [ { huid: { $exists: false } }, { huid: null }, { huid: '' } ] } });
    }
    pipeline.push({
      $group: {
        _id: '$category',
        totalValue: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } },
        totalQuantity: { $sum: '$quantity' },
        totalCost: { $sum: { $multiply: ['$purchasePrice', '$quantity'] } }
      }
    });
    const stock = await Product.aggregate(pipeline);
    const summaryAgg = await Product.aggregate([
      { $group: {
          _id: { enabled: { $cond: [ { $ifNull: ['$huid', false] }, true, false ] } },
          count: { $sum: 1 },
          value: { $sum: { $multiply: ['$sellingPrice', '$quantity'] } }
      } }
    ]);
    const enabledRow = summaryAgg.find(r => r._id.enabled === true);
    const disabledRow = summaryAgg.find(r => r._id.enabled === false);
    {
    }

    const totalValue = stock.reduce((sum, item) => sum + item.totalValue, 0);
    const totalCost = stock.reduce((sum, item) => sum + item.totalCost, 0);

    res.json({
      byCategory: stock,
      totalValue,
      totalCost,
      potentialProfit: totalValue - totalCost,
      huidSummary: {
        enabledCount: enabledRow?.count || 0,
        nonHuidCount: disabledRow?.count || 0,
        enabledValue: enabledRow?.value || 0,
        nonHuidValue: disabledRow?.value || 0
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reports/aging
// @desc    Get aging report for dues
// @access  Private
router.get('/aging', auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({
      status: { $in: ['Partial', 'Pending'] },
      dueAmount: { $gt: 0 }
    }).populate('customer', 'name phone');

    const now = new Date();
    const aging = {
      '0-30': [],
      '31-60': [],
      '61-90': [],
      '90+': []
    };

    invoices.forEach(invoice => {
      const days = Math.floor((now - invoice.createdAt) / (1000 * 60 * 60 * 24));
      const invoiceData = {
        invoice: invoice.invoiceNumber,
        customer: invoice.customer,
        amount: invoice.dueAmount,
        days
      };

      if (days <= 30) aging['0-30'].push(invoiceData);
      else if (days <= 60) aging['31-60'].push(invoiceData);
      else if (days <= 90) aging['61-90'].push(invoiceData);
      else aging['90+'].push(invoiceData);
    });

    res.json(aging);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

