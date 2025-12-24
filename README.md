# 💎 Jewellery Shop Management System

A comprehensive MERN stack application for managing jewellery shop operations including inventory, billing, customers, suppliers, and more.

## Features

### 🎯 Core Features

1. **Dashboard**
   - Live gold price display (24K, 22K, 18K)
   - Today's and monthly sales
   - Profit/Loss tracking
   - Total stock value by category
   - Pending dues
   - Low stock alerts
   - Sales trend charts

2. **Live Gold Price Module**
   - Auto-fetch from API (configurable)
   - Manual override option
   - Separate rates for 24K, 22K, 18K
   - Making charge settings
   - GST configuration
   - Floating price bar with color-coded changes

3. **Product/Inventory Management**
   - Categories: Gold, Silver, Diamond, Platinum, Other
   - Product fields: Name, SKU, Weight, Purity, Prices, Stock
   - Auto stock deduction on billing
   - Low stock alerts
   - Product search and filtering

4. **Billing & Invoice System**
   - Customer selection
   - Product selection with auto-calculations
   - Live gold rate application
   - Making charge + GST calculation
   - Discount support
   - Old gold exchange adjustment
   - Multiple payment modes (Cash, UPI, Card, Split, Credit)
   - Invoice generation

5. **Customer Management (CRM)**
   - Customer profiles with contact info
   - Purchase history
   - Credit limit management
   - Outstanding dues tracking
   - High-value customer tagging

6. **Arrears/Udhaar (Credit Management)**
   - Customer ledger
   - Payment history
   - Outstanding balance tracking
   - Aging reports (30/60/90 days)

7. **Purchase & Supplier Management**
   - Supplier details
   - Purchase invoices
   - Outstanding payments tracking
   - Supplier ledger

8. **Old Gold Exchange**
   - Accept old gold records
   - Purity testing entry
   - Weight and rate tracking
   - Adjustment against new purchases

9. **Reports & Analytics**
   - Daily/Monthly Profit & Loss
   - Category-wise stock valuation
   - Product-wise margins
   - Tax reports
   - Aging reports
   - Interactive charts and graphs

10. **User Roles & Security**
    - Role-based access (Admin, Salesman, Accountant, Inventory Manager)
    - JWT authentication
    - Secure API endpoints

## Tech Stack

- **Frontend**: React 18, React Router, Recharts, React Icons
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Styling**: CSS3 with Dark + Gold theme

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or connection string)
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd init
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/jewellery_shop
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
GOLD_PRICE_API_KEY=your_gold_price_api_key_here
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the frontend directory (optional):

```env
REACT_APP_API_URL=http://localhost:5000
```

### 4. Initialize Database

Start MongoDB and run the backend server. The first admin user can be created through the registration endpoint or manually in MongoDB.

Default admin credentials (create manually or use registration):
- Email: admin@jewellery.com
- Password: admin123

## Running the Application

### Start MongoDB

Make sure MongoDB is running on your system:

```bash
# Windows
mongod

# macOS/Linux
sudo systemctl start mongod
# or
mongod
```

### Start Backend Server

```bash
cd backend
npm run dev
# or
npm start
```

The backend will run on `http://localhost:5000`

### Start Frontend Development Server

```bash
cd frontend
npm start
```

The frontend will run on `http://localhost:3000`

## Default Login

After setting up the database, you can create the first admin user:

1. Use the registration endpoint (requires authentication - you may need to create first user manually in MongoDB)
2. Or manually insert in MongoDB:

```javascript
// In MongoDB shell or Compass
use jewellery_shop
db.users.insertOne({
  name: "Admin",
  email: "admin@jewellery.com",
  password: "$2a$10$...", // bcrypt hash of "admin123"
  role: "admin",
  isActive: true
})
```

To generate password hash, you can use:
```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('admin123', 10).then(hash => console.log(hash));
```

## Project Structure

```
init/
├── backend/
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── middleware/     # Auth middleware
│   ├── server.js       # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── context/    # React context
│   │   ├── utils/      # Utility functions
│   │   └── App.js
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user (Admin only)
- `GET /api/auth/me` - Get current user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `GET /api/customers/:id` - Get customer with history

### Invoices
- `GET /api/invoices` - Get all invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get single invoice
- `PUT /api/invoices/:id/payment` - Update payment

### Gold Price
- `GET /api/gold-price` - Get latest gold price
- `POST /api/gold-price` - Update gold price (manual)
- `POST /api/gold-price/fetch` - Fetch from API

### Reports
- `GET /api/reports/profit-loss` - Profit & Loss report
- `GET /api/reports/stock-valuation` - Stock valuation
- `GET /api/reports/aging` - Aging report

## Features in Detail

### Dark + Gold Theme
The application uses a beautiful dark theme with gold accents, perfect for a jewellery shop management system.

### Responsive Design
The UI is fully responsive and works on desktop, tablet, and mobile devices.

### Real-time Updates
Gold prices update automatically, and dashboard statistics refresh in real-time.

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Secure API endpoints
- Input validation

## Future Enhancements

- [ ] Barcode/RFID support
- [ ] Multi-branch management
- [ ] Cloud sync
- [ ] Offline mode
- [ ] Mobile app
- [ ] WhatsApp invoice sharing
- [ ] AI demand forecasting
- [ ] Advanced analytics

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository.

---

**Note**: Make sure to change the JWT_SECRET and other sensitive values in production!

