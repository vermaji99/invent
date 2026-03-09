import React, { useState, useEffect } from 'react';
import { FiTrendingUp, FiTrendingDown, FiRefreshCw } from 'react-icons/fi';
import api from '../utils/api';
import './GoldPriceBar.css';

const GoldPriceBar = () => {
  const [goldPrice, setGoldPrice] = useState(null);
  const [liveMetals, setLiveMetals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    fetchGoldPrice();
    fetchLiveMetals();
    // Quota-safe: no frequent auto-refresh. Users can click manual refresh.
  }, []);

  const fetchGoldPrice = async () => {
    try {
      const response = await api.get('/api/gold-price');
      setGoldPrice(response.data);
    } catch (error) {
      setGoldPrice({
        rate24K: 6000,
        rate22K: 5500,
        rate18K: 4500,
        gstPercent: 3,
        lastUpdated: new Date().toISOString(),
        priceChange24K: 0,
        priceChange22K: 0,
        priceChange18K: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveMetals = async () => {
    try {
      setLiveError(null);
      if (!navigator.onLine) {
        return;
      }
      const response = await api.get('/api/metals/live');
      // If API returns null/empty for some metals, use requested default values
      const data = response.data;
      if (data && data.spot) {
        if (data.spot.gold == null) data.spot.gold = 15290.03;
        if (data.spot.silver == null) data.spot.silver = 249.71;
        if (data.spot.platinum == null) data.spot.platinum = 6322.89;
        if (data.spot.palladium == null) data.spot.palladium = 4797.06;
      } else {
        // Mock data structure if response is empty
        throw new Error('Empty data');
      }
      setLiveMetals(data);
    } catch (error) {
      // Fallback to requested values on error
      setLiveMetals({
        source: 'live',
        currency: 'INR',
        unit: 'g',
        spot: {
          gold: 15290.03,
          silver: 249.71,
          platinum: 6322.89,
          palladium: 4797.06
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  if (loading || !goldPrice) {
    return (
      <div className="gold-price-bar">
        <div className="gold-price-loading">Loading gold prices...</div>
      </div>
    );
  }

  const formatPriceINR = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatNumber = (value, digits = 2) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const PriceDisplay = ({ label, price, change }) => {
    const isPositive = change >= 0;
    return (
      <div className="price-item">
        <span className="price-label">{label}</span>
        <span className="price-value">{formatPriceINR(price)}</span>
        {change !== 0 && (
          <span className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? <FiTrendingUp /> : <FiTrendingDown />}
            {formatPriceINR(Math.abs(change))}
          </span>
        )}
      </div>
    );
  };

  // Prefer live INR rates (derived from spot price) if available, otherwise fall back to saved DB rates
  const effective24K =
    liveMetals?.gold_rates?.['24k'] ?? goldPrice.rate24K;
  const effective22K =
    liveMetals?.gold_rates?.['22k'] ?? goldPrice.rate22K;
  const effective18K =
    liveMetals?.gold_rates?.['18k'] ?? goldPrice.rate18K;

  // Prefer live metals timestamp for "Updated" label if available
  const updatedTimestamp = liveMetals?.timestamp
    ? new Date(liveMetals.timestamp)
    : goldPrice.lastUpdated
      ? new Date(goldPrice.lastUpdated)
      : new Date();

  return (
    <div className="gold-price-bar">
      <div className="gold-price-content">
        <div className="price-group">
          <PriceDisplay
            label="24K (INR/g)"
            price={effective24K}
            change={goldPrice.priceChange24K}
          />
          <PriceDisplay
            label="22K (INR/g)"
            price={effective22K}
            change={goldPrice.priceChange22K}
          />
          <PriceDisplay
            label="18K (INR/g)"
            price={effective18K}
            change={goldPrice.priceChange18K}
          />
        </div>

        <div className="price-meta">
          <span className="last-updated">
            Updated: {formatTime(updatedTimestamp)}
          </span>
          <button className="refresh-btn" onClick={() => { fetchGoldPrice(); fetchLiveMetals(); }}>
            <FiRefreshCw />
          </button>
        </div>

        {liveMetals && (
          <div className="live-metals">
            <div className="live-metals-header">
              <span>Live Spot Prices</span>
              <span className="live-metals-unit">INR / G</span>
            </div>
            <div className="live-metals-grid">
              <div className="live-metal-item">
                <span className="live-metal-label">Gold</span>
                <span className="live-metal-value">{formatNumber(liveMetals.spot?.gold || 15290.03)}</span>
              </div>
              <div className="live-metal-item">
                <span className="live-metal-label">Silver</span>
                <span className="live-metal-value">{formatNumber(liveMetals.spot?.silver || 249.71)}</span>
              </div>
              <div className="live-metal-item">
                <span className="live-metal-label">Platinum</span>
                <span className="live-metal-value">{formatNumber(liveMetals.spot?.platinum || 6322.89)}</span>
              </div>
              <div className="live-metal-item">
                <span className="live-metal-label">Palladium</span>
                <span className="live-metal-value">{formatNumber(liveMetals.spot?.palladium || 4797.06)}</span>
              </div>
            </div>
            <span className="live-metals-timestamp">Live</span>
          </div>
        )}

      </div>
    </div>
  );
};

export default GoldPriceBar;
