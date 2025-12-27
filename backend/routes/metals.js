const express = require('express');
const router = express.Router();
const axios = require('axios');
const GoldPrice = require('../models/GoldPrice');

let metalsLiveCache = { data: null, timestamp: 0 };
const METALS_LIVE_TTL_MS = 6 * 60 * 60 * 1000;

router.get('/live', async (req, res) => {
  try {
    const now = Date.now();
    if (metalsLiveCache.data && now - metalsLiveCache.timestamp < METALS_LIVE_TTL_MS) {
      return res.json(metalsLiveCache.data);
    }

    const apiKey =
      req.query.api_key ||
      req.headers['x-api-key'] ||
      process.env.METALS_DEV_API_KEY ||
      process.env.REACT_APP_METALS_DEV_API_KEY ||
      null;

    if (!apiKey) {
      const latest = await GoldPrice.getLatest();
      const fallback = {
        source: 'fallback',
        currency: 'INR',
        unit: 'g',
        spot: {
          gold: null,
          silver: null,
          platinum: null,
          palladium: null
        },
        gold_rates: latest
          ? {
              '24k': Number((latest.rate24K || 0).toFixed(2)),
              '22k': Number(((latest.rate24K || 0) * 0.916).toFixed(2)),
              '18k': Number(((latest.rate24K || 0) * 0.75).toFixed(2))
            }
          : null
      };
      metalsLiveCache = { data: fallback, timestamp: now };
      return res.json(fallback);
    }

    let response;
    try {
      response = await axios.get('https://api.metals.dev/v1/latest', {
        params: {
          api_key: apiKey,
          currency: 'INR',
          unit: 'g'
        },
        headers: {
          Accept: 'application/json'
        }
      });
    } catch (apiError) {
      const latest = await GoldPrice.getLatest();
      const fallback = {
        source: 'fallback',
        currency: 'INR',
        unit: 'g',
        spot: {
          gold: null,
          silver: null,
          platinum: null,
          palladium: null
        },
        gold_rates: latest
          ? {
              '24k': Number((latest.rate24K || 0).toFixed(2)),
              '22k': Number(((latest.rate24K || 0) * 0.916).toFixed(2)),
              '18k': Number(((latest.rate24K || 0) * 0.75).toFixed(2))
            }
          : null
      };
      metalsLiveCache = { data: fallback, timestamp: now };
      return res.json(fallback);
    }

    const data = response.data || {};
    if (data.status === 'failure') {
      const latest = await GoldPrice.getLatest();
      const fallback = {
        source: 'fallback',
        currency: 'INR',
        unit: 'g',
        spot: {
          gold: null,
          silver: null,
          platinum: null,
          palladium: null
        },
        gold_rates: latest
          ? {
              '24k': Number((latest.rate24K || 0).toFixed(2)),
              '22k': Number(((latest.rate24K || 0) * 0.916).toFixed(2)),
              '18k': Number(((latest.rate24K || 0) * 0.75).toFixed(2))
            }
          : null
      };
      metalsLiveCache = { data: fallback, timestamp: now };
      return res.json(fallback);
    }

    const metals = data.metals || {};
    const gold = metals.gold != null ? Number(Number(metals.gold).toFixed(2)) : null;
    const silver = metals.silver != null ? Number(Number(metals.silver).toFixed(2)) : null;
    const platinum = metals.platinum != null ? Number(Number(metals.platinum).toFixed(2)) : null;
    const palladium = metals.palladium != null ? Number(Number(metals.palladium).toFixed(2)) : null;

    const payload = {
      source: 'live',
      currency: 'INR',
      unit: 'g',
      timestamp: Date.now(),
      spot: {
        gold,
        silver,
        platinum,
        palladium
      },
      gold_rates: gold != null
        ? {
            '24k': gold,
            '22k': Number((gold * 0.916).toFixed(2)),
            '18k': Number((gold * 0.75).toFixed(2))
          }
        : null
    };

    metalsLiveCache = { data: payload, timestamp: now };
    res.json(payload);
  } catch (error) {
    const latest = await GoldPrice.getLatest();
    const fallback = {
      source: 'fallback',
      currency: 'INR',
      unit: 'g',
      spot: {
        gold: null,
        silver: null,
        platinum: null,
        palladium: null
      },
      gold_rates: latest
        ? {
            '24k': Number((latest.rate24K || 0).toFixed(2)),
            '22k': Number(((latest.rate24K || 0) * 0.916).toFixed(2)),
            '18k': Number(((latest.rate24K || 0) * 0.75).toFixed(2))
          }
        : null
    };
    metalsLiveCache = { data: fallback, timestamp: Date.now() };
    res.json(fallback);
  }
});

module.exports = router;
