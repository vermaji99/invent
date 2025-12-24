const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const resetAdminPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery_shop');

    console.log('✅ Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@jewellery.com' });

    if (!admin) {
      console.log('❌ Admin user not found. Creating new admin...');
      
      // Create admin user (password will be hashed by pre-save hook)
      const newAdmin = new User({
        name: 'Admin',
        email: 'admin@jewellery.com',
        password: 'admin123', // Will be hashed automatically
        role: 'admin',
        isActive: true
      });
      await newAdmin.save();
      console.log('✅ Admin user created successfully!');
    } else {
      console.log('✅ Admin user found. Resetting password...');
      
      // Reset password (will be hashed by pre-save hook)
      // Mark password as modified to trigger hashing
      admin.password = 'admin123';
      admin.isActive = true;
      admin.markModified('password'); // Ensure pre-save hook runs
      await admin.save();
      console.log('✅ Admin password reset successfully!');
    }

    // Verify the password
    const verifyAdmin = await User.findOne({ email: 'admin@jewellery.com' });
    const isMatch = await verifyAdmin.comparePassword('admin123');
    
    if (isMatch) {
      console.log('✅ Password verification successful!');
    } else {
      console.log('❌ Password verification failed!');
    }

    console.log('\n📧 Email: admin@jewellery.com');
    console.log('🔑 Password: admin123');
    console.log('⚠️  Please change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetAdminPassword();

