const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const connectDB = require('./config/db');

const app = express();

// Middleware
const allowedOrigins = [
  'https://invent-frontend-uv28.onrender.com',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(null, true); // Allow all for now to debug, or you can restrict it
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors()); // Enable pre-flight for all routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/old-gold-exchange', require('./routes/oldGold'));
app.use('/api/old-gold', require('./routes/oldGoldPurchases'));
app.use('/api/silver-purchase', require('./routes/silverPurchases'));
app.use('/api/gold-price', require('./routes/goldPrice'));
app.use('/api/metals', require('./routes/metals'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/sub-categories', require('./routes/subCategories'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/supplier-payments', require('./routes/supplierPayments'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/admin/otp', require('./routes/adminOtp'));
app.use('/api/pledges', require('./routes/pledges'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('Routes loaded: /api/orders, /api/upload, /api/gold-price and more...');
});

const { initScheduler } = require('./services/scheduler');

// Initialize services
initScheduler();
