const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const orderController = require('../controllers/orderController');

// Dashboard & Alerts (must be before :id)
router.get('/metrics/dashboard', auth, orderController.getDashboardMetrics);
router.get('/alerts/delivery', auth, orderController.getDeliveryAlerts);

// CRUD
router.post('/', auth, orderController.createOrder);
router.get('/', auth, orderController.getOrders);
router.get('/:id', auth, orderController.getOrderById);

// Actions
router.patch('/:id/status', auth, orderController.updateOrderStatus);
router.post('/:id/pay', auth, orderController.addPayment);
router.post('/:id/deliver', auth, orderController.deliverOrder);
router.patch('/:id/items/:itemId', auth, orderController.updateOrderItem);
router.delete('/:id/items/:itemId', auth, orderController.deleteOrderItem);

module.exports = router;
