const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Settings = require('../models/Settings');

// @route   GET /api/settings
// @desc    Get all settings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne({ type: 'general' });
    
    if (!settings) {
      // Create default settings if not exists
      settings = new Settings({ type: 'general' });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/settings
// @desc    Update settings
// @access  Private
router.put('/', auth, async (req, res) => {
  try {
    const { shopDetails, invoiceSettings } = req.body;
    
    let settings = await Settings.findOne({ type: 'general' });
    
    if (!settings) {
      settings = new Settings({ type: 'general' });
    }
    
    if (shopDetails) settings.shopDetails = { ...settings.shopDetails, ...shopDetails };
    if (invoiceSettings) settings.invoiceSettings = { ...settings.invoiceSettings, ...invoiceSettings };
    
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
