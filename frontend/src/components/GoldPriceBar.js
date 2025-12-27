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
      setLiveMetals(response.data);
    } catch (error) {
      // Silent fallback: don't surface error to UI
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

        {liveMetals?.source === 'live' && (
          <div className="live-metals">
            <div className="live-metals-header">
              <span>Live Spot Prices</span>
              <span className="live-metals-unit">
                {liveMetals.currency} / {liveMetals.unit?.toUpperCase?.() || 'G'}
              </span>
            </div>
            <div className="live-metals-grid">
              {liveMetals.spot?.gold != null && (
                <div className="live-metal-item">
                  <span className="live-metal-label">Gold</span>
                  <span className="live-metal-value">
                    {formatNumber(liveMetals.spot.gold)}
                  </span>
                </div>
              )}
              {liveMetals.spot?.silver != null && (
                <div className="live-metal-item">
                  <span className="live-metal-label">Silver</span>
                  <span className="live-metal-value">
                    {formatNumber(liveMetals.spot.silver)}
                  </span>
                </div>
              )}
              {liveMetals.spot?.platinum != null && (
                <div className="live-metal-item">
                  <span className="live-metal-label">Platinum</span>
                  <span className="live-metal-value">
                    {formatNumber(liveMetals.spot.platinum)}
                  </span>
                </div>
              )}
              {liveMetals.spot?.palladium != null && (
                <div className="live-metal-item">
                  <span className="live-metal-label">Palladium</span>
                  <span className="live-metal-value">
                    {formatNumber(liveMetals.spot.palladium)}
                  </span>
                </div>
              )}
            </div>
            <span className="live-metals-timestamp">Live</span>
          </div>
        )}

      </div>
    </div>
  );
};

export default GoldPriceBar;
