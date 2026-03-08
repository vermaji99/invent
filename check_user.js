const mongoose = require('mongoose');
const User = require('./backend/models/User');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: './backend/.env' });

const checkUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jewellery_shop');
    console.log('Connected to MongoDB');

    const email = 'shubhamverma66133@gmail.com';
    const user = await User.findOne({ email });

    if (user) {
      console.log('User found:');
      console.log('Name:', user.name);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Is Active:', user.isActive);
      
      const passwordMatch = await bcrypt.compare('Radha09@', user.password);
      console.log('Password match:', passwordMatch);
    } else {
      console.log('User not found with email:', email);
      
      // List all users to see what we have
      const allUsers = await User.find({}, 'name email role isActive');
      console.log('Available users:');
      allUsers.forEach(u => console.log(`- ${u.name} (${u.email}) [${u.role}] Active: ${u.isActive}`));
    }

    process.exit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkUser();
