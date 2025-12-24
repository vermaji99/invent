const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const generateBarcode = require('../utils/generateBarcode');

// Load env vars
dotenv.config();

const generateMissingBarcodes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    const products = await Product.find({
      $or: [
        { barcodeBase64: { $exists: false } },
        { barcodeBase64: '' },
        { barcodeBase64: null }
      ]
    });

    console.log(`Found ${products.length} products missing barcodes.`);

    for (const product of products) {
      try {
        const barcodeText = product.sku || product._id.toString();
        const barcodeBuffer = await generateBarcode(barcodeText);
        product.barcodeBase64 = barcodeBuffer.toString('base64');
        await product.save();
        console.log(`Generated barcode for ${product.name} (${product.sku})`);
      } catch (err) {
        console.error(`Failed to generate barcode for ${product.name}:`, err.message);
      }
    }

    console.log('All missing barcodes generated.');
    process.exit();
  } catch (err) {
    console.error('Script failed:', err);
    process.exit(1);
  }
};

generateMissingBarcodes();
