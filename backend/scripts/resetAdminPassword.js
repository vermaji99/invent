const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const resetAdminPassword = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery_shop');

    console.log('✅ Connected to MongoDB');

    const email = 'shubhamverma66133@gmail.com';
    const password = 'Radha09@';

    // Find user
    let user = await User.findOne({ email });

    if (!user) {
      console.log(`❌ User ${email} not found. Creating new admin...`);
      
      user = new User({
        name: 'Shubham Verma',
        email: email,
        password: password,
        role: 'admin',
        isActive: true
      });
      await user.save();
      console.log('✅ User created successfully!');
    } else {
      console.log(`✅ User ${email} found. Resetting password and activating...`);
      
      user.password = password;
      user.isActive = true;
      user.role = 'admin'; // Ensure it's admin
      user.markModified('password');
      await user.save();
      console.log('✅ Password reset successfully!');
    }

    // Verify
    const verifyUser = await User.findOne({ email });
    const isMatch = await verifyUser.comparePassword(password);
    
    if (isMatch) {
      console.log('✅ Password verification successful!');
    } else {
      console.log('❌ Password verification failed!');
    }

    console.log(`\n📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetAdminPassword();

