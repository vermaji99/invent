const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const GoldPrice = require('../models/GoldPrice');
const axios = require('axios');
const { body, validationResult } = require('express-validator');

// Simple in-memory cache to avoid hitting the external API too often
let liveMetalsCache = {
  data: null,
  timestamp: 0
};
const LIVE_METALS_TTL_MS = 60 * 1000; // 1 minute
let metalsLiveCache = {
  data: null,
  timestamp: 0
};
const METALS_LIVE_TTL_MS = 6 * 60 * 60 * 1000;

// @route   GET /api/gold-price
// @desc    Get latest saved gold price (used for billing / INR rates)
// @access  Public
router.get('/', async (req, res) => {
  try {
    let goldPrice = await GoldPrice.getLatest();

    if (!goldPrice) {
      // Create default if none exists
      goldPrice = new GoldPrice({
        rate24K: 6000,
        rate22K: 5500,
        rate18K: 4500,
        gstPercent: 3,
        source: 'Manual'
      });
      await goldPrice.save();
    }

    res.json(goldPrice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/gold-price/live
// @desc    Get live metal prices from external API (gold, silver, etc.)
// @access  Public (no auth required)
router.get('/live', async (req, res) => {
  try {
    const now = Date.now();

    // Serve from cache if still fresh
    if (liveMetalsCache.data && now - liveMetalsCache.timestamp < LIVE_METALS_TTL_MS) {
      return res.json({
        ...liveMetalsCache.data,
        cached: true
      });
    }

    // Accept API key from env, query, or header for flexibility
    const apiKey =
      req.query.api_key ||
      req.headers['x-api-key'] ||
      process.env.METALS_DEV_API_KEY ||
      process.env.REACT_APP_METALS_DEV_API_KEY;

    if (!apiKey) {
      const latest = await GoldPrice.getLatest();
      const fallbackPayload = {
        status: 'success',
        currency: 'INR',
        unit: 'g',
        timestamp: Date.now(),
        metals: {
          gold: null,
          silver: null,
          platinum: null,
          palladium: null
        },
        inrRates: latest
          ? {
              rate24K: latest.rate24K,
              rate22K: latest.rate22K,
              rate18K: latest.rate18K
            }
          : null,
        cached: true
      };
      return res.json(fallbackPayload);
    }

    // Metals.Dev expects an `api_key` query parameter
    let response;
    try {
        response = await axios.get('https://api.metals.dev/v1/latest', {
          params: {
            api_key: apiKey,
            currency: 'USD',
            unit: 'g'
          }
        });
    } catch (apiError) {
        console.error('Metals API Error:', apiError.message);
        const latest = await GoldPrice.getLatest();
        const fallbackPayload = {
          status: 'success',
          currency: 'INR',
          unit: 'g',
          timestamp: Date.now(),
          metals: {
            gold: null,
            silver: null,
            platinum: null,
            palladium: null
          },
          inrRates: latest
            ? {
                rate24K: latest.rate24K,
                rate22K: latest.rate22K,
                rate18K: latest.rate18K
              }
            : null,
          cached: true
        };
        return res.json(fallbackPayload);
    }

    const data = response.data || {};

    if (data.status === 'failure') {
      // Surface upstream error clearly to the client
      return res.status(502).json({
        message: 'Live metals API returned an error',
        providerStatus: data.status,
        providerErrorCode: data.error_code,
        providerErrorMessage: data.error_message
      });
    }
    const metals = data.metals || {};

    // Optional INR per gram conversion for 24K / 22K / 18K using live FX from Metals.Dev
    // We use the currencies.INR field where USD per 1 INR is given, so INR = USD / currencies.INR
    let inrRates = null;
    const usdPerInr = data.currencies?.INR ? parseFloat(data.currencies.INR) : null;

    if (metals.gold && usdPerInr) {
      // We requested unit=g, so metals.gold is USD per gram directly
      const goldUsdPerGram = metals.gold;
      const inrPerUsd = 1 / usdPerInr;
      const goldInrPerGram24K = goldUsdPerGram * inrPerUsd;

      inrRates = {
        rate24K: goldInrPerGram24K,
        rate22K: goldInrPerGram24K * (22 / 24),
        rate18K: goldInrPerGram24K * (18 / 24)
      };
    }

    // Convert spot metals to INR/g if FX available
    let metalsInINR = null;
    if (usdPerInr) {
      const inrPerUsd = 1 / usdPerInr;
      metalsInINR = {
        gold: (metals.gold ?? null) != null ? metals.gold * inrPerUsd : null,
        silver: (metals.silver ?? null) != null ? metals.silver * inrPerUsd : null,
        platinum: (metals.platinum ?? null) != null ? metals.platinum * inrPerUsd : null,
        palladium: (metals.palladium ?? null) != null ? metals.palladium * inrPerUsd : null
      };
    }

    const payload = {
      status: data.status || 'success',
      currency: metalsInINR ? 'INR' : (data.currency || 'USD'),
      unit: data.unit || 'g',
      timestamp: data.timestamps?.metal || Date.now(),
      metals: metalsInINR || {
        gold: metals.gold ?? null,
        silver: metals.silver ?? null,
        platinum: metals.platinum ?? null,
        palladium: metals.palladium ?? null
      },
      inrRates
    };

    liveMetalsCache = {
      data: payload,
      timestamp: now
    };

    res.json(payload);
  } catch (error) {
    console.error('Error fetching live metal prices:', error.message);
    res.status(500).json({
      message: 'Failed to fetch live metal prices',
      error: error.response?.data || error.message
    });
  }
});

// @route   POST /api/gold-price
// @desc    Update gold price (manual)
// @access  Private (Admin, Accountant)
router.post('/', [
  auth,
  authorize('admin', 'accountant'),
  body('rate24K').isNumeric().withMessage('24K rate must be a number'),
  body('rate22K').isNumeric().withMessage('22K rate must be a number'),
  body('rate18K').isNumeric().withMessage('18K rate must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const previousPrice = await GoldPrice.getLatest();

    const goldPrice = new GoldPrice({
      rate24K: req.body.rate24K,
      rate22K: req.body.rate22K,
      rate18K: req.body.rate18K,
      makingChargePercent: req.body.makingChargePercent || 0,
      makingChargeFixed: req.body.makingChargeFixed || 0,
      gstPercent: req.body.gstPercent || 3,
      source: 'Manual',
      updatedBy: req.user.id,
      priceChange24K: previousPrice ? req.body.rate24K - previousPrice.rate24K : 0,
      priceChange22K: previousPrice ? req.body.rate22K - previousPrice.rate22K : 0,
      priceChange18K: previousPrice ? req.body.rate18K - previousPrice.rate18K : 0
    });

    await goldPrice.save();
    res.status(201).json(goldPrice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/gold-price/fetch
// @desc    Fetch gold price from API
// @access  Private (Admin, Accountant)
router.post('/fetch', [
  auth,
  authorize('admin', 'accountant')
], async (req, res) => {
  try {
    // This is a placeholder - you'll need to integrate with a real gold price API
    // Example: https://www.goldapi.io/ or similar
    // For now, returning a mock response

    const mockPrice = {
      rate24K: 6200,
      rate22K: 5700,
      rate18K: 4700
    };

    const previousPrice = await GoldPrice.getLatest();

    const goldPrice = new GoldPrice({
      ...mockPrice,
      makingChargePercent: previousPrice?.makingChargePercent || 0,
      makingChargeFixed: previousPrice?.makingChargeFixed || 0,
      gstPercent: previousPrice?.gstPercent || 3,
      source: 'API',
      updatedBy: req.user.id,
      priceChange24K: previousPrice ? mockPrice.rate24K - previousPrice.rate24K : 0,
      priceChange22K: previousPrice ? mockPrice.rate22K - previousPrice.rate22K : 0,
      priceChange18K: previousPrice ? mockPrice.rate18K - previousPrice.rate18K : 0
    });

    await goldPrice.save();
    res.json(goldPrice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
