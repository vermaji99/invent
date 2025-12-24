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

    const interval = setInterval(() => {
      fetchGoldPrice();
      fetchLiveMetals();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const fetchGoldPrice = async () => {
    try {
      const response = await api.get('/api/gold-price');
      setGoldPrice(response.data);
    } catch (error) {
      console.error('Error fetching gold price:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveMetals = async () => {
    try {
      setLiveError(null);
      const frontendApiKey = process.env.REACT_APP_METALS_DEV_API_KEY;
      const url = frontendApiKey
        ? `/api/gold-price/live?api_key=${frontendApiKey}`
        : '/api/gold-price/live';

      const response = await api.get(url);
      setLiveMetals(response.data);
    } catch (error) {
      console.error('Error fetching live metal prices:', error);
      setLiveError('Live feed unavailable');
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
    liveMetals?.inrRates?.rate24K ?? goldPrice.rate24K;
  const effective22K =
    liveMetals?.inrRates?.rate22K ?? goldPrice.rate22K;
  const effective18K =
    liveMetals?.inrRates?.rate18K ?? goldPrice.rate18K;

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
              <span className="live-metals-unit">
                {liveMetals.currency} / {liveMetals.unit?.toUpperCase?.() || 'TOZ'}
              </span>
            </div>
            <div className="live-metals-grid">
              <div className="live-metal-item">
                <span className="live-metal-label">Gold</span>
                <span className="live-metal-value">
                  {formatNumber(liveMetals.metals?.gold)}
                </span>
              </div>
              <div className="live-metal-item">
                <span className="live-metal-label">Silver</span>
                <span className="live-metal-value">
                  {formatNumber(liveMetals.metals?.silver)}
                </span>
              </div>
              <div className="live-metal-item">
                <span className="live-metal-label">Platinum</span>
                <span className="live-metal-value">
                  {formatNumber(liveMetals.metals?.platinum)}
                </span>
              </div>
              <div className="live-metal-item">
                <span className="live-metal-label">Palladium</span>
                <span className="live-metal-value">
                  {formatNumber(liveMetals.metals?.palladium)}
                </span>
              </div>
            </div>
            <span className="live-metals-timestamp">
              Live as of:{' '}
              {formatTime(
                liveMetals.timestamp
                  ? new Date(liveMetals.timestamp)
                  : new Date()
              )}
            </span>
          </div>
        )}

        {liveError && !liveMetals && (
          <div className="live-metals-error">{liveError}</div>
        )}
      </div>
    </div>
  );
};

export default GoldPriceBar;

