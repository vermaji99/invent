const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const OldGoldPurchase = require('../models/OldGoldPurchase');
const Product = require('../models/Product');
const { calculateFineGold, applyDeduction } = require('../utils/goldCalculations');
const { body, validationResult } = require('express-validator');

// @route   POST /api/old-gold
// @desc    Purchase old gold from customer and add to inventory
// @access  Private
router.post('/', [
  auth,
  body('customerName').trim().notEmpty().withMessage('Customer name is required'),
  body('mobile').trim().notEmpty().withMessage('Mobile number is required'),
  body('weight').isFloat({ min: 0.0001 }).withMessage('Weight must be positive'),
  body('purity').isFloat({ min: 1, max: 100 }).withMessage('Purity must be between 1 and 100'),
  body('goldRate').isFloat({ min: 0 }).withMessage('Gold rate is required'),
  body('deductionPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('Invalid deduction percent')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customerName, mobile, weight, purity, goldRate, deductionPercent, notes } = req.body;

    const fineGold = calculateFineGold(weight, purity);
    const finalFineGold = applyDeduction(fineGold, deductionPercent || 0);
    const amountPaid = finalFineGold * goldRate;

    // 1. Save Old Gold Purchase Record
    const purchase = new OldGoldPurchase({
      customerName,
      mobile,
      weight,
      purity,
      fineGold,
      goldRate,
      deductionPercent: deductionPercent || 0,
      finalFineGold,
      amountPaid,
      notes,
      createdBy: req.user.id
    });

    await purchase.save();

    // 2. Add to Inventory as Raw Gold
    // Find or create a "Raw Gold (Old Purchase)" product or create a new entry for each purchase
    // For traceability, creating a new entry per purchase might be better, or adding to a common SKU.
    // The requirement says "Create new inventory entry".
    
    const count = await Product.countDocuments();
    const sku = `OLD-${(count + 1).toString().padStart(6, '0')}`;

    const rawGoldProduct = new Product({
      name: "Raw Gold (Old Purchase)",
      category: 'Gold',
      sku,
      grossWeight: 0,
      netWeight: 0,
      quantity: 1,
      purity: '100% (Fine)',
      purityPercent: 100,
      fineGold: finalFineGold,
      availableWeight: finalFineGold,
      isWeightManaged: true,
      purchasePrice: goldRate, // Cost price is the rate we bought it at
      sellingPrice: goldRate, // Default selling price same as buy price
      costPricePerGram: goldRate,
      sourceType: 'old',
      createdBy: req.user.id,
      description: `Purchased from ${customerName} (${mobile}). Original Weight: ${weight}g, Purity: ${purity}%`
    });

    await rawGoldProduct.save();

    res.status(201).json({ purchase, product: rawGoldProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/old-gold
// @desc    Get all old gold purchases
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const purchases = await OldGoldPurchase.find().sort({ createdAt: -1 });
    res.json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
