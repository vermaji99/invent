const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const GoldPrice = require('../models/GoldPrice');

// Helper to map Payment Mode to Transaction Enum
const mapPaymentMode = (mode) => {
    const map = {
        'CASH': 'Cash',
        'UPI': 'UPI',
        'CARD': 'Card',
        'BANK_TRANSFER': 'Bank Transfer',
        'OTHER': 'Cash' // Default fallback
    };
    return map[mode] || 'Cash';
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    const {
      customerId,
      items,
      advanceAmount,
      expectedDeliveryDate,
      notes,
      paymentMethod
    } = req.body;

    // Validate Customer
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    // Calculate Totals and Validate Products
    let totalAmount = 0;
    const orderItems = [];

    console.log('Processing Order Items:', JSON.stringify(items, null, 2));

    for (const item of items) {
      // Robust check for custom items (handle string 'true' or boolean true)
      const isCustomItem = item.isCustom === true || item.isCustom === 'true';

      if (isCustomItem) {
          // Handle custom item (on-demand)
          const itemTotal = Number(item.price) * Number(item.quantity);
          totalAmount += itemTotal;
          
          orderItems.push({
            isCustom: true,
            name: item.name,
            quantity: Number(item.quantity),
            price: Number(item.price),
            targetWeight: item.targetWeight,
            designImage: item.designImage,
            specialInstructions: item.specialInstructions,
            size: item.size,
            itemType: item.itemType
            // product reference is undefined
          });
      } else {
          // Existing logic for inventory product
          if (!item.product) {
              console.error('Invalid item found:', item);
              return res.status(400).json({ 
                  message: `Invalid item found in order. Item must be either custom (isCustom: true) or have a valid product ID. Item name: ${item.name || 'Unknown'}` 
              });
          }

          const product = await Product.findById(item.product);
          if (!product) {
            return res.status(404).json({ message: `Product not found for ID: ${item.product}` });
          }

          const itemTotal = Number(item.price) * Number(item.quantity);
          totalAmount += itemTotal;

          orderItems.push({
            product: product._id,
            name: product.name,
            quantity: Number(item.quantity),
            price: Number(item.price),
            sku: product.sku,
            purity: product.purity,
            weight: product.grossWeight // Snapshot
          });
      }
    }

    const remainingAmount = totalAmount - (advanceAmount || 0);

    // Create Order
    const order = new Order({
      orderNumber: `ORD-${Date.now()}`,
      customer: customer._id,
      customerDetails: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email
      },
      items: orderItems,
      totalAmount,
      advanceAmount: advanceAmount || 0,
      remainingAmount,
      expectedDeliveryDate,
      notes,
      paymentStatus: advanceAmount >= totalAmount ? 'FULL_PAID' : (advanceAmount > 0 ? 'ADVANCE_PAID' : 'UNPAID'),
      orderStatus: 'PENDING'
    });

    // Handle Advance Payment
    if (advanceAmount > 0) {
      order.payments.push({
        amount: advanceAmount,
        type: 'ADVANCE',
        method: paymentMethod || 'CASH',
        date: new Date()
      });

      // Log Transaction for Advance
      await Transaction.create({
        type: 'CREDIT',
        category: 'ORDER_ADVANCE',
        amount: advanceAmount,
        paymentMode: mapPaymentMode(paymentMethod || 'CASH'),
        description: `Advance for Order ${order.orderNumber}`,
        reference: {
          model: 'Order',
          id: order._id
        },
        performedBy: req.user._id // Assuming auth middleware adds user
      });
    }

    await order.save();

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const { status, search, startDate, endDate } = req.query;
    let query = {};

    if (status) {
      query.orderStatus = status;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.phone': { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate('customer', 'name phone email');

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer')
      .populate('items.product');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.orderStatus = status;
    
    if (status === 'CANCELLED') {
        // Logic for cancellation if needed (e.g. refund flags)
    }

    await order.save();
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add payment to order
// @route   POST /api/orders/:id/pay
// @access  Private
exports.addPayment = async (req, res) => {
  try {
    const { amount, method, notes } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.remainingAmount <= 0) {
        return res.status(400).json({ message: 'Order is already fully paid' });
    }

    order.payments.push({
      amount,
      type: 'PARTIAL', // or FINAL check below
      method,
      notes,
      date: new Date()
    });

    order.remainingAmount -= amount;
    
    // Update payment status
    if (order.remainingAmount <= 0) {
        order.paymentStatus = 'FULL_PAID';
        // If paid more, handle change? For now assume exact or less
        if (order.remainingAmount < 0) order.remainingAmount = 0;
        
        // Mark last payment as FINAL if it cleared balance
        order.payments[order.payments.length - 1].type = 'FINAL';
    } else {
        order.paymentStatus = 'PARTIALLY_PAID';
    }

    // Log Transaction
    await Transaction.create({
        type: 'CREDIT',
        category: 'CUSTOMER_PAYMENT',
        amount: amount,
        paymentMode: mapPaymentMode(method),
        description: `Payment for Order ${order.orderNumber}`,
        reference: {
          model: 'Order',
          id: order._id
        },
        performedBy: req.user._id
    });

    await order.save();
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Deliver order (Convert to Sale/Invoice and Reduce Stock)
// @route   POST /api/orders/:id/deliver
// @access  Private
exports.deliverOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.isDelivered) {
      return res.status(400).json({ message: 'Order already delivered' });
    }

    // 1. Check/Collect remaining payment
    // Optionally force full payment before delivery. 
    // Requirement says: "When order is delivered: Remaining amount can be paid"
    // We assume the frontend handles the payment flow before calling deliver, 
    // OR we can pass payment details in this request to clear balance.
    
    const { finalPayment } = req.body; // { amount, method }
    
    if (finalPayment && finalPayment.amount > 0) {
         order.payments.push({
            amount: finalPayment.amount,
            type: 'FINAL',
            method: finalPayment.method,
            date: new Date()
         });
         order.remainingAmount -= finalPayment.amount;
         
         await Transaction.create({
            type: 'CREDIT',
            category: 'SALES',
            amount: finalPayment.amount,
            paymentMode: mapPaymentMode(finalPayment.method),
            description: `Final Payment for Order ${order.orderNumber}`,
            reference: { model: 'Order', id: order._id },
            performedBy: req.user._id
         });
    }
    
    if (order.remainingAmount > 0) {
        order.paymentStatus = 'PARTIALLY_PAID'; 
        // Allow delivery with due? "Convert order into final sale" usually implies Invoice. 
        // Invoice supports dueAmount. So yes.
    } else {
        order.paymentStatus = 'FULL_PAID';
    }

    // 2. Reduce Inventory Stock
    for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
            product.quantity -= item.quantity;
            // Add history
            product.history.push({
                type: 'SOLD',
                reference: { model: 'Order', id: order._id },
                details: { quantity: item.quantity, orderNumber: order.orderNumber }
            });
            await product.save();
        }
    }

    // 3. Create Invoice (Sale)
    // We map Order to Invoice
    const latestGoldRate = await GoldPrice.getLatest();
    const invoice = new Invoice({
        invoiceNumber: `INV-${Date.now()}`, // Or sequential
        customer: order.customer,
        items: await Promise.all(order.items.map(async (item) => {
            // Derive total weight for line
            let unitWeight = Number(item.weight || 0);
            let purchaseRate = 0; // cost per gram
            let makingCharge = 0;
            let wastage = 0;
            let metalRate = 0;
            const q = Number(item.quantity || 1);
            // Inventory product
            if (item.product) {
                const prod = await Product.findById(item.product);
                if (prod) {
                    // Use product snapshot or current values
                    unitWeight = unitWeight || Number(prod.grossWeight || 0);
                    // Purchase rate per gram from product (fallback to purchasePrice/grossWeight)
                    const perGramCost = (Number(prod.purchasePrice || 0) && Number(prod.grossWeight || 0))
                      ? (Number(prod.purchasePrice) / Number(prod.grossWeight))
                      : 0;
                    purchaseRate = Number(item.purchaseRate || perGramCost || 0);
                    const totalWeight = unitWeight * q;
                    const autoMaking = (Number(prod.makingChargePerGram || 0) * totalWeight) + Number(prod.makingChargeFixed || 0);
                    // Determine per-gram metal rate (₹/g): prefer manualRate, then appliedRate, then latest
                    if (prod.category === 'Gold') {
                        const purity = (item.purity || prod.purity || '22K').replace(/\s+/g, '');
                        const rateKey = purity === '24K' ? 'rate24K' : purity === '18K' ? 'rate18K' : 'rate22K';
                        const latestRate = latestGoldRate ? (latestGoldRate[rateKey] || latestGoldRate.rate22K || 0) : 0;
                        metalRate = Number(item.manualRate) > 0 
                          ? Number(item.manualRate) 
                          : (Number(item.appliedRate) > 0 ? Number(item.appliedRate) : latestRate);
                    } else {
                        metalRate = Number(item.appliedRate || 0);
                    }
                    const baseMetalVal = metalRate * totalWeight;
                    const autoWastage = baseMetalVal * (Number(prod.wastagePercent || 0) / 100);
                    makingCharge = Number(item.makingCharge ?? autoMaking ?? 0);
                    wastage = Number(item.wastage ?? autoWastage ?? 0);
                    // Build invoice line for inventory product
                    const otherCost = Number(item.otherCost || 0);
                    const discount = Number(item.discount || 0);
                    const oldGoldAdjustment = Number(item.oldGoldAdjustment || 0);
                    return {
                        product: item.product,
                        quantity: q,
                        weight: totalWeight,
                        rate: Math.round(metalRate),
                        purchaseRate,
                        makingCharge,
                        wastage,
                        otherCost,
                        discount,
                        oldGoldAdjustment,
                        subtotal: Math.round(baseMetalVal + makingCharge + wastage + otherCost - discount - oldGoldAdjustment)
                    };
                }
            } else {
                // Custom item: approximate purchase rate from gold price and purity if known
                // Weight fallback: parse targetWeight if provided
                if (!unitWeight && item.targetWeight) {
                    const parsed = parseFloat(String(item.targetWeight).replace(/[^\d\.]/g, ''));
                    if (!isNaN(parsed)) unitWeight = parsed;
                }
                if (latestGoldRate) {
                    const purity = (item.purity || '22K').replace(/\s+/g, '');
                    const rateKey = purity === '24K' ? 'rate24K' : purity === '18K' ? 'rate18K' : 'rate22K';
                    purchaseRate = Number(item.purchaseRate || latestGoldRate[rateKey] || latestGoldRate.rate22K || 0);
                }
                makingCharge = Number(item.makingCharge || 0);
                wastage = Number(item.wastage || 0);
                // Determine per-gram metal rate for custom
                const rateKey = (item.purity || '22K').replace(/\s+/g, '') === '24K' ? 'rate24K' 
                  : ((item.purity || '22K').replace(/\s+/g, '') === '18K' ? 'rate18K' : 'rate22K');
                const latestRate = latestGoldRate ? (latestGoldRate[rateKey] || latestGoldRate.rate22K || 0) : 0;
                metalRate = Number(item.manualRate) > 0 
                  ? Number(item.manualRate) 
                  : (Number(item.appliedRate) > 0 ? Number(item.appliedRate) : latestRate);
                const totalWeight = unitWeight * q;
                const baseMetalVal = metalRate * totalWeight;
                const otherCost = Number(item.otherCost || 0);
                const discount = Number(item.discount || 0);
                const oldGoldAdjustment = Number(item.oldGoldAdjustment || 0);
                return {
                    product: item.product,
                    quantity: q,
                    weight: totalWeight,
                    rate: Math.round(metalRate),
                    purchaseRate,
                    makingCharge,
                    wastage,
                    otherCost,
                    discount,
                    oldGoldAdjustment,
                    subtotal: Math.round(baseMetalVal + makingCharge + wastage + otherCost - discount - oldGoldAdjustment)
                };
            }
        })),
        subtotal: order.totalAmount,
        total: order.totalAmount,
        paymentMode: mapPaymentMode(order.payments[0]?.method) || 'Cash',
        paidAmount: order.totalAmount - order.remainingAmount,
        dueAmount: order.remainingAmount > 0 ? order.remainingAmount : 0,
        status: (order.remainingAmount > 0) ? ((order.totalAmount - order.remainingAmount) > 0 ? 'Partial' : 'Pending') : 'Paid',
        createdBy: req.user._id
    });
    
    if (invoice.items && invoice.items.length) {
        const computedSubtotal = invoice.items.reduce((sum, it) => sum + Number(it.subtotal || 0), 0);
        invoice.subtotal = computedSubtotal;
        invoice.gst = invoice.gst || 0;
        invoice.total = computedSubtotal + Number(invoice.gst || 0) - Number(invoice.discount || 0);
    }
    
    await invoice.save();

    // 4. Update Order Status
    order.isDelivered = true;
    order.orderStatus = 'DELIVERED';
    order.actualDeliveryDate = new Date();
    order.inventoryUpdated = true;
    
    await order.save();

    res.json({ message: 'Order delivered and converted to sale', order, invoice });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get dashboard metrics for orders
// @route   GET /api/orders/metrics/dashboard
// @access  Private
exports.getDashboardMetrics = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Orders Today
        const ordersToday = await Order.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });

        // Orders This Month
        const ordersMonth = await Order.countDocuments({
            createdAt: { $gte: startOfMonth }
        });

        // Total Advance Collected (All time or month? "Total Advance Collected" implies all pending orders usually, or strictly cash flow)
        // Let's do Total Advance from Orders that are NOT cancelled
        const ordersWithAdvance = await Order.find({ 
            advanceAmount: { $gt: 0 },
            orderStatus: { $ne: 'CANCELLED' }
        });
        const totalAdvance = ordersWithAdvance.reduce((acc, ord) => acc + ord.advanceAmount, 0);

        // Pending Balance Amount
        const pendingOrders = await Order.find({ 
            orderStatus: { $nin: ['DELIVERED', 'CANCELLED'] }
        });
        const pendingBalance = pendingOrders.reduce((acc, ord) => acc + ord.remainingAmount, 0);

        // Orders Near Delivery (Next 24h)
        const next24h = new Date();
        next24h.setHours(next24h.getHours() + 24);
        
        const nearDelivery = await Order.countDocuments({
            orderStatus: { $nin: ['DELIVERED', 'CANCELLED'] },
            expectedDeliveryDate: { $lte: next24h, $gte: new Date() }
        });

        const overdue = await Order.countDocuments({
            orderStatus: { $nin: ['DELIVERED', 'CANCELLED'] },
            expectedDeliveryDate: { $lt: new Date() }
        });

        // Status Counts for Chart
        const statusCounts = await Order.aggregate([
            { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
        ]);

        res.json({
            ordersToday,
            ordersMonth,
            totalAdvance,
            pendingBalance,
            nearDelivery,
            overdue,
            statusCounts
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get delivery alerts
// @route   GET /api/orders/alerts/delivery
// @access  Private
exports.getDeliveryAlerts = async (req, res) => {
    try {
        const next24h = new Date();
        next24h.setHours(next24h.getHours() + 24);

        // Find orders due within 24 hours OR overdue
        // And not delivered/cancelled
        const alerts = await Order.find({
            orderStatus: { $nin: ['DELIVERED', 'CANCELLED'] },
            expectedDeliveryDate: { $lte: next24h }
        }).sort({ expectedDeliveryDate: 1 }).populate('customer', 'name phone');

        res.json(alerts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete a single item from an order and recalculate totals
// @route   DELETE /api/orders/:id/items/:itemId
// @access  Private
exports.deleteOrderItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.isDelivered) {
      return res.status(400).json({ message: 'Cannot modify items of a delivered order' });
    }
    const idx = order.items.findIndex(it => it._id?.toString() === itemId);
    if (idx === -1) {
      return res.status(404).json({ message: 'Item not found in order' });
    }
    if (order.items.length <= 1) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }
    order.items.splice(idx, 1);
    const subtotal = order.items.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
    order.totalAmount = subtotal;
    // Do NOT double-count advance: it's already recorded in payments with type 'ADVANCE'
    const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    order.remainingAmount = Math.max(0, subtotal - totalPaid);
    if (order.remainingAmount <= 0) {
      order.paymentStatus = 'FULL_PAID';
      order.remainingAmount = 0;
    } else if (totalPaid > 0) {
      order.paymentStatus = 'ADVANCE_PAID';
    } else {
      order.paymentStatus = 'UNPAID';
    }
    await order.save();
    const populated = await Order.findById(order._id)
      .populate('customer')
      .populate('items.product');
    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a single item in an order and recalculate totals
// @route   PATCH /api/orders/:id/items/:itemId
// @access  Private
exports.updateOrderItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { 
      quantity, 
      price, 
      name, 
      targetWeight, 
      size, 
      itemType, 
      specialInstructions, 
      designImage, 
      weight, 
      recalculate,
      manualRate,
      purchaseRate,
      makingCharge,
      wastage,
      discount,
      oldGoldAdjustment,
      otherCost
    } = req.body;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.isDelivered) {
      return res.status(400).json({ message: 'Cannot modify items of a delivered order' });
    }
    const item = order.items.find(it => it._id?.toString() === itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found in order' });
    }
    if (quantity !== undefined) item.quantity = Number(quantity);
    if (weight !== undefined) item.weight = Number(weight);
    if (price !== undefined) item.price = Number(price);
    if (purchaseRate !== undefined) item.purchaseRate = Number(purchaseRate);
    if (makingCharge !== undefined) item.makingCharge = Number(makingCharge);
    if (wastage !== undefined) item.wastage = Number(wastage);
    if (discount !== undefined) item.discount = Number(discount);
    if (oldGoldAdjustment !== undefined) item.oldGoldAdjustment = Number(oldGoldAdjustment);
    if (otherCost !== undefined) item.otherCost = Number(otherCost);
    if (manualRate !== undefined) item.manualRate = Number(manualRate);
    if ((recalculate || weight !== undefined) && item.product) {
      try {
        const product = await Product.findById(item.product);
        const latestPrice = await GoldPrice.getLatest();
        if (product && latestPrice && product.category === 'Gold') {
          const purity = (item.purity || product.purity || '22K').replace(/\s+/g, '');
          const rateKey = purity === '24K' ? 'rate24K' : purity === '18K' ? 'rate18K' : 'rate22K';
          const metalRate = Number(manualRate) > 0 ? Number(manualRate) : (latestPrice[rateKey] || latestPrice.rate22K);
          const wt = Number(item.weight || product.grossWeight || 0);
          const baseMetal = metalRate * wt;
          const autoWastage = baseMetal * (Number(product.wastagePercent || 0) / 100);
          const autoMaking = (Number(product.makingChargePerGram || 0) * wt) + Number(product.makingChargeFixed || 0);
          const finalPrice = Math.round(baseMetal + (item.wastage ?? autoWastage) + (item.makingCharge ?? autoMaking));
          item.price = finalPrice;
          item.appliedRate = metalRate;
        }
      } catch (err) {
        console.error('Recalculation failed:', err);
      }
    }
    // Optional auto price recalculation for custom items
    if (item.isCustom && (recalculate || weight !== undefined)) {
      try {
        const latestPrice = await GoldPrice.getLatest();
        const purity = (item.purity || '22K').replace(/\s+/g, '');
        const rateKey = purity === '24K' ? 'rate24K' : purity === '18K' ? 'rate18K' : 'rate22K';
        const metalRate = Number(manualRate) > 0 
          ? Number(manualRate) 
          : (latestPrice ? (latestPrice[rateKey] || latestPrice.rate22K || 0) : 0);
        let unitWeight = Number(item.weight || 0);
        if (!unitWeight && item.targetWeight) {
          const parsed = parseFloat(String(item.targetWeight).replace(/[^\d\.]/g, ''));
          if (!isNaN(parsed)) unitWeight = parsed;
        }
        const q = Number(item.quantity || 1);
        const baseMetalUnit = metalRate * unitWeight;
        const perUnitMaking = Number(item.makingCharge || 0) / q;
        const perUnitWastage = Number(item.wastage || 0) / q;
        const perUnitOther = Number(item.otherCost || 0) / q;
        const perUnitDiscount = Number(item.discount || 0) / q;
        const perUnitOldGold = Number(item.oldGoldAdjustment || 0) / q;
        const finalUnitPrice = Math.round(baseMetalUnit + perUnitMaking + perUnitWastage + perUnitOther - perUnitDiscount - perUnitOldGold);
        item.price = finalUnitPrice;
        item.appliedRate = metalRate;
      } catch (err) {
        console.error('Custom item recalculation failed:', err);
      }
    }
    if (item.isCustom) {
      if (name !== undefined) item.name = name;
      if (targetWeight !== undefined) item.targetWeight = targetWeight;
      if (size !== undefined) item.size = size;
      if (itemType !== undefined) item.itemType = itemType;
      if (specialInstructions !== undefined) item.specialInstructions = specialInstructions;
      if (designImage !== undefined) item.designImage = designImage;
    }
    const subtotal = order.items.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);
    order.totalAmount = subtotal;
    const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    order.remainingAmount = Math.max(0, subtotal - totalPaid);
    if (order.remainingAmount <= 0) {
      order.paymentStatus = 'FULL_PAID';
      order.remainingAmount = 0;
    } else if (totalPaid > 0) {
      order.paymentStatus = 'ADVANCE_PAID';
    } else {
      order.paymentStatus = 'UNPAID';
    }
    await order.save();
    const populated = await Order.findById(order._id)
      .populate('customer')
      .populate('items.product');
    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
