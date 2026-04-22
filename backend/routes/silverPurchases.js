const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const SilverPurchase = require('../models/SilverPurchase');
const Product = require('../models/Product');
const { calculateFineSilver, applyDeduction } = require('../utils/goldCalculations');
const { body, validationResult } = require('express-validator');

router.post('/', [
  auth,
  body('customerName').trim().notEmpty().withMessage('Customer name is required'),
  body('mobile').trim().notEmpty().withMessage('Mobile number is required'),
  body('weight').isFloat({ min: 0.0001 }).withMessage('Weight must be positive'),
  body('purity').isFloat({ min: 1, max: 100 }).withMessage('Purity must be between 1 and 100'),
  body('silverRate').isFloat({ min: 0 }).withMessage('Silver rate is required'),
  body('deductionPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('Invalid deduction percent')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { customerName, mobile, weight, purity, silverRate, deductionPercent, notes } = req.body;

    const fineSilver = calculateFineSilver(weight, purity);
    const finalFineSilver = applyDeduction(fineSilver, deductionPercent || 0);
    const amountPaid = finalFineSilver * silverRate;

    const purchase = new SilverPurchase({
      customerName,
      mobile,
      weight,
      purity,
      fineSilver,
      silverRate,
      deductionPercent: deductionPercent || 0,
      finalFineSilver,
      amountPaid,
      notes,
      createdBy: req.user.id
    });

    await purchase.save();

    const count = await Product.countDocuments();
    const sku = `SLD-${(count + 1).toString().padStart(6, '0')}`;

    const rawSilverProduct = new Product({
      name: "Raw Silver (Old Purchase)",
      category: 'Silver',
      sku,
      grossWeight: 0,
      netWeight: 0,
      quantity: 1,
      purity: `${purity}%`,
      purityPercent: purity,
      fineGold: finalFineSilver,
      availableWeight: finalFineSilver,
      isWeightManaged: true,
      purchasePrice: silverRate,
      sellingPrice: silverRate,
      costPricePerGram: silverRate,
      sourceType: 'old',
      createdBy: req.user.id,
      description: `Purchased from ${customerName} (${mobile}). Original Weight: ${weight}g, Purity: ${purity}%`
    });

    await rawSilverProduct.save();

    res.status(201).json({ purchase, product: rawSilverProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const purchases = await SilverPurchase.find().sort({ createdAt: -1 });
    res.json(purchases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
