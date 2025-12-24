const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Product = require('../models/Product');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// @route   GET /api/products
// @desc    Get all products
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, lowStock, huidEnabled } = req.query;
    let query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$lowStockAlert'] };
    }

    if (huidEnabled === 'true') {
      query.huid = { $exists: true };
    } else if (huidEnabled === 'false') {
      query.$or = [
        { huid: { $exists: false } },
        { huid: null },
        { huid: '' }
      ];
    }

    const products = await Product.find(query)
      .populate('supplier', 'name phone')
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('supplier', 'name phone email');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Ensure barcode exists if not present
    if (!product.barcodeBase64) {
      try {
        const barcodeText = product.sku || product._id.toString();
        const barcodeBuffer = await generateBarcode(barcodeText);
        product.barcodeBase64 = barcodeBuffer.toString('base64');
        await product.save();
      } catch (bcError) {
        console.error("Barcode generation failed during update:", bcError);
      }
    }

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

const generateBarcode = require('../utils/generateBarcode');

// @route   POST /api/products/qr-codes
// @desc    Generate QR codes for selected products
// @access  Private
router.post('/qr-codes', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No product ids provided' });
    }
    const products = await Product.find({ _id: { $in: ids }, isActive: true }, { _id: 1, sku: 1, name: 1 });
    const items = [];
    for (const p of products) {
      const text = p.sku || p._id.toString();
      const buf = await generateBarcode.generateQrCode(text);
      items.push({
        id: p._id.toString(),
        sku: p.sku || '',
        name: p.name || '',
        qrBase64: buf.toString('base64')
      });
    }
    res.json({ items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/products
// @desc    Create a new product
// @access  Private (Admin/Manager)
router.post('/', [
  auth,
  upload.array('images', 5), // Max 5 images
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('category').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Other']).withMessage('Invalid category'),
  body('grossWeight').isFloat({ min: 0 }).withMessage('Gross weight must be positive'),
  body('netWeight').isFloat({ min: 0 }).withMessage('Net weight must be positive'),
  body('purity').notEmpty().withMessage('Purity is required'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be positive'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be positive'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
  body('huid').optional().isLength({ min: 6, max: 6 }).matches(/^[A-Za-z0-9]{6}$/).withMessage('Invalid HUID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Handle image uploads
    const imageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];

    const productData = {
      ...req.body,
      images: imageUrls,
      createdBy: req.user.id
    };

    // Auto-generate SKU if not provided
    if (!productData.sku) {
      const count = await Product.countDocuments();
      const prefix = productData.category.substring(0, 3).toUpperCase();
      productData.sku = `${prefix}-${(count + 1).toString().padStart(6, '0')}`;
    }

    // Ensure SKU is unique
    let skuExists = await Product.findOne({ sku: productData.sku });
    if (skuExists) {
      return res.status(400).json({ message: 'SKU already exists' });
    }

    // HUID uniqueness when provided
    if (productData.huid) {
      const dup = await Product.findOne({ huid: productData.huid });
      if (dup) {
        return res.status(400).json({ message: 'HUID already exists' });
      }
      productData.huidEnabled = true;
      if (!productData.history) productData.history = [];
      productData.history.push({
        type: 'HUID_ADDED',
        date: new Date(),
        reference: { model: 'Product', id: null },
        details: { huid: productData.huid }
      });
    }

    const product = new Product(productData);
    await product.save();
    
    // Generate Barcode
    try {
      // Use SKU or ID for barcode
      const barcodeText = product.sku || product._id.toString();
      const barcodeBuffer = await generateBarcode(barcodeText);
      product.barcodeBase64 = barcodeBuffer.toString('base64');
      await product.save();
    } catch (bcError) {
      console.error("Barcode generation failed:", bcError);
      // Continue without barcode, or handle as needed
    }

    res.status(201).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private (Admin, Inventory Manager)
router.put('/:id', [
  auth,
  authorize('admin', 'inventory_manager'),
  upload.array('images', 5)
], async (req, res) => {
  try {
    const newImageUrls = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
    
    let existingImages = [];
    if (req.body.existingImages) {
      existingImages = Array.isArray(req.body.existingImages) 
        ? req.body.existingImages 
        : [req.body.existingImages];
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // HUID validation and uniqueness when provided
    if (req.body.huid) {
      const huid = String(req.body.huid).trim();
      const valid = /^[A-Za-z0-9]{6}$/.test(huid);
      if (!valid) {
        return res.status(400).json({ message: 'Invalid HUID format' });
      }
      const dup = await Product.findOne({ _id: { $ne: product._id }, huid });
      if (dup) {
        return res.status(400).json({ message: 'HUID already exists' });
      }
      const wasEnabled = !!product.huid;
      product.huid = huid;
      product.huidEnabled = true;
      if (!wasEnabled) {
        product.history = product.history || [];
        product.history.push({
          type: 'HUID_ADDED',
          date: new Date(),
          reference: { model: 'Product', id: product._id },
          details: { huid }
        });
      }
    } else if (req.body.huid === '') {
      product.huid = undefined;
      product.huidEnabled = false;
    }

    Object.keys(req.body).forEach(key => {
      if (['huid', 'existingImages'].includes(key)) return;
      product[key] = req.body[key];
    });

    if (req.files.length > 0 || req.body.existingImages) {
      product.images = [...existingImages, ...newImageUrls];
    }

    await product.save();

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Private (Admin, Inventory Manager)
router.delete('/:id', [
  auth,
  authorize('admin', 'inventory_manager')
], async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

