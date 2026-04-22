const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const OldGoldPurchase = require('../models/OldGoldPurchase');
const User = require('../models/User');
const { calculateFineGold, applyDeduction } = require('../utils/goldCalculations');

dotenv.config();

const demoProducts = [
  {
    name: "Gold Haar Set",
    category: "Gold",
    grossWeight: 25,
    netWeight: 22,
    purity: "22K",
    purityPercent: 91.6,
    costPricePerGram: 5000,
    sellingPricePerGram: 6200,
    quantity: 2,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Haar+Set",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Gold Ring (Floral Design)",
    category: "Gold",
    grossWeight: 6,
    netWeight: 5.5,
    purity: "18K",
    purityPercent: 75,
    costPricePerGram: 4800,
    sellingPricePerGram: 6000,
    quantity: 5,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Gold+Ring",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Gold Chain (Heavy)",
    category: "Gold",
    grossWeight: 15,
    netWeight: 14,
    purity: "22K",
    purityPercent: 91.6,
    costPricePerGram: 5100,
    sellingPricePerGram: 6300,
    quantity: 3,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Gold+Chain",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Gold Bangle (Pair)",
    category: "Gold",
    grossWeight: 32,
    netWeight: 30,
    purity: "22K",
    purityPercent: 91.6,
    costPricePerGram: 5050,
    sellingPricePerGram: 6250,
    quantity: 1,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Gold+Bangle",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Silver Anklet (Pair)",
    category: "Silver",
    grossWeight: 45,
    netWeight: 45,
    purity: "Sterling 925",
    purityPercent: 92.5,
    costPricePerGram: 70,
    sellingPricePerGram: 95,
    quantity: 10,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Silver+Anklet",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Silver Puja Thali Set",
    category: "Silver",
    grossWeight: 250,
    netWeight: 250,
    purity: "Fine 999",
    purityPercent: 99.9,
    costPricePerGram: 75,
    sellingPricePerGram: 110,
    quantity: 2,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Silver+Thali",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Diamond Stud Earrings",
    category: "Gold",
    grossWeight: 4.2,
    netWeight: 3.8,
    purity: "18K",
    purityPercent: 75,
    costPricePerGram: 5500,
    sellingPricePerGram: 7500,
    quantity: 4,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Diamond+Studs",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Gold Mangalsutra",
    category: "Gold",
    grossWeight: 12,
    netWeight: 10,
    purity: "22K",
    purityPercent: 91.6,
    costPricePerGram: 5100,
    sellingPricePerGram: 6400,
    quantity: 3,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Mangalsutra",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Gold Nose Pin",
    category: "Gold",
    grossWeight: 1.2,
    netWeight: 1.0,
    purity: "22K",
    purityPercent: 91.6,
    costPricePerGram: 5200,
    sellingPricePerGram: 6500,
    quantity: 12,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Nose+Pin",
    isWeightManaged: false,
    isActive: true
  },
  {
    name: "Silver Coin (50g)",
    category: "Silver",
    grossWeight: 50,
    netWeight: 50,
    purity: "Fine 999",
    purityPercent: 99.9,
    costPricePerGram: 80,
    sellingPricePerGram: 120,
    quantity: 20,
    sourceType: "new",
    image: "https://via.placeholder.com/300?text=Silver+Coin",
    isWeightManaged: false,
    isActive: true
  }
];

const demoOldGoldPurchases = [
  {
    customerName: "Ramesh Gupta",
    mobile: "9876543210",
    weight: 20,
    purity: 82,
    deductionPercent: 2,
    goldRate: 6000,
    notes: "Old family necklace for exchange"
  },
  {
    customerName: "Anita Sharma",
    mobile: "9123456789",
    weight: 12.5,
    purity: 75,
    deductionPercent: 1.5,
    goldRate: 6000,
    notes: "Broken gold rings"
  },
  {
    customerName: "Sanjay Verma",
    mobile: "9988776655",
    weight: 8.2,
    purity: 91.6,
    deductionPercent: 0,
    goldRate: 6050,
    notes: "Gold coin purchase"
  },
  {
    customerName: "Priya Singh",
    mobile: "9876123450",
    weight: 15.4,
    purity: 85,
    deductionPercent: 2.5,
    goldRate: 6100,
    notes: "Old gold bangles"
  },
  {
    customerName: "Vikram Malhotra",
    mobile: "9999888877",
    weight: 30.0,
    purity: 90,
    deductionPercent: 1.0,
    goldRate: 6000,
    notes: "Old gold chain and pendant"
  }
];

const seedDemoData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for seeding...");

    // Get an admin user to associate data with
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log("No admin user found! Creating a temporary admin...");
      adminUser = await User.create({
        name: 'Demo Admin',
        email: 'admin@demo.com',
        password: 'password123',
        role: 'admin',
        isActive: true
      });
    }

    const clearExisting = process.argv.includes('--clear');
    if (clearExisting) {
      console.log("Clearing existing demo products and old gold purchases...");
      // Delete products created by the demo admin or that match our demo names
      await Product.deleteMany({
        $or: [
          { sourceType: 'old' },
          { name: { $in: demoProducts.map(p => p.name) } }
        ]
      });
      await OldGoldPurchase.deleteMany({});
    }

    console.log("Seeding demo products...");
    for (const p of demoProducts) {
      const fineGold = calculateFineGold(p.netWeight, p.purityPercent);
      const count = await Product.countDocuments();
      const sku = `${p.category.substring(0, 3).toUpperCase()}-${(count + 1).toString().padStart(6, '0')}`;
      
      // Calculate total prices for schema compatibility
      const purchasePrice = p.netWeight * p.costPricePerGram;
      const sellingPrice = p.netWeight * p.sellingPricePerGram;

      await Product.create({
        ...p,
        sku,
        fineGold,
        purchasePrice,
        sellingPrice,
        availableWeight: p.isWeightManaged ? p.netWeight : 0,
        createdBy: adminUser._id,
        images: [p.image]
      });
    }

    console.log("Seeding old gold purchases and raw inventory...");
    for (const og of demoOldGoldPurchases) {
      const fineGold = calculateFineGold(og.weight, og.purity);
      const finalFineGold = applyDeduction(fineGold, og.deductionPercent);
      const amountPaid = finalFineGold * og.goldRate;

      // 1. Save Old Gold Purchase Record
      const purchase = await OldGoldPurchase.create({
        ...og,
        fineGold,
        finalFineGold,
        amountPaid,
        createdBy: adminUser._id
      });

      // 2. Add to Inventory as Raw Gold
      const count = await Product.countDocuments();
      const sku = `OLD-${(count + 1).toString().padStart(6, '0')}`;

      await Product.create({
        name: "Raw Gold (Old Purchase)",
        category: 'Gold',
        sku,
        grossWeight: og.weight,
        netWeight: og.weight,
        quantity: 1,
        purity: `${og.purity}% (Old)`,
        purityPercent: og.purity,
        fineGold: finalFineGold,
        availableWeight: finalFineGold,
        isWeightManaged: true,
        purchasePrice: amountPaid,
        sellingPrice: amountPaid,
        costPricePerGram: og.goldRate,
        sourceType: 'old',
        createdBy: adminUser._id,
        description: `Purchased from ${og.customerName} (${og.mobile}). Original Weight: ${og.weight}g, Purity: ${og.purity}%`
      });
    }

    console.log("Demo data seeded successfully! 🚀");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seedDemoData();
