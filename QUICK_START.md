# Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Setup MongoDB

Make sure MongoDB is running on your system:

**Windows:**
```bash
# If MongoDB is installed as a service, it should start automatically
# Or run manually:
mongod
```

**macOS/Linux:**
```bash
# Start MongoDB service
sudo systemctl start mongod
# or
mongod
```

### Step 3: Configure Environment Variables

**Backend (.env file in backend/):**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/jewellery_shop
JWT_SECRET=your_super_secret_jwt_key_change_this
NODE_ENV=development
```

**Frontend (.env file in frontend/ - optional):**
```env
REACT_APP_API_URL=http://localhost:5000
```

### Step 4: Initialize Admin User

```bash
cd backend
node scripts/initAdmin.js
```

This will create a default admin user:
- Email: `admin@jewellery.com`
- Password: `admin123`

### Step 5: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Step 6: Login

1. Open browser: `http://localhost:3000`
2. Login with:
   - Email: `admin@jewellery.com`
   - Password: `admin123`

## 📝 First Steps After Login

1. **Update Gold Prices**: Go to Settings and set current gold rates
2. **Add Suppliers**: Go to Suppliers and add your suppliers
3. **Add Products**: Go to Inventory and add your jewellery products
4. **Add Customers**: Go to Customers and add your customer database
5. **Start Billing**: Go to Billing and create your first invoice!

## 🎨 Features Overview

- **Dashboard**: Real-time business overview with charts
- **Inventory**: Manage products, stock, and categories
- **Billing**: Create invoices with automatic calculations
- **Customers**: CRM with purchase history and dues tracking
- **Suppliers**: Manage suppliers and purchases
- **Reports**: Profit & Loss, Stock Valuation, Aging Reports
- **Settings**: Configure gold prices and system settings

## 🔧 Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running
- Check the MONGODB_URI in backend/.env
- Verify MongoDB is accessible on the specified port

### Port Already in Use
- Change PORT in backend/.env
- Or kill the process using the port:
  ```bash
  # Windows
  netstat -ano | findstr :5000
  taskkill /PID <PID> /F
  
  # macOS/Linux
  lsof -ti:5000 | xargs kill
  ```

### CORS Errors
- Make sure backend is running on port 5000
- Check REACT_APP_API_URL in frontend/.env

### Login Not Working
- Run the initAdmin script to create admin user
- Check MongoDB connection
- Verify JWT_SECRET is set in backend/.env

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore all features in the application
- Customize gold price API integration
- Add more users with different roles

## 💡 Tips

- Use the search bar in the sidebar for quick navigation
- Gold prices update automatically every minute
- Low stock alerts appear on the dashboard
- All invoices are automatically saved
- Customer dues are tracked automatically

---

**Happy Managing! 💎**

