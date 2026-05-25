const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }
    
    // Improved connection options for stability on cloud platforms
    const options = {
      serverSelectionTimeoutMS: 5000, // Keep trying to connect for 5 seconds
      socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log("MongoDB Connected 🚀");
  } catch (err) {
    console.error("MongoDB Connection Error:", err.message);
    // Log more details if it's a DNS issue
    if (err.message.includes('ENOTFOUND')) {
      console.error("Check your MongoDB Atlas Network Access (Whitelist IP 0.0.0.0/0)");
    }
    process.exit(1);
  }
};

module.exports = connectDB;

