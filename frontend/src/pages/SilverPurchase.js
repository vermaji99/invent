import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiSave, FiUser, FiSmartphone, FiHash, FiPercent, FiDollarSign } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './OldGoldPurchase.css';

const SilverPurchase = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    mobile: '',
    weight: '',
    purity: '925',
    silverRate: '',
    deductionPercent: '0',
    notes: ''
  });

  const [silverPrice, setSilverPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    fetchSilverPrice();
    fetchPurchases();
  }, []);

  const fetchSilverPrice = async () => {
    try {
      const response = await api.get('/api/gold-price');
      setSilverPrice(response.data);
      if (response.data.rateSilver) {
        setFormData(prev => ({ ...prev, silverRate: response.data.rateSilver }));
      }
    } catch (error) {
      console.error('Failed to load silver price');
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await api.get('/api/silver-purchase');
      setPurchases(response.data);
    } catch (error) {
      console.error('Failed to load purchases');
    }
  };

  const calculateFineSilver = () => {
    const weight = parseFloat(formData.weight) || 0;
    const purity = parseFloat(formData.purity) || 100;
    return (weight * purity) / 100;
  };

  const calculateFinalFineSilver = () => {
    const fineSilver = calculateFineSilver();
    const deduction = parseFloat(formData.deductionPercent) || 0;
    return fineSilver - (fineSilver * deduction) / 100;
  };

  const calculateAmount = () => {
    const finalFineSilver = calculateFinalFineSilver();
    const rate = parseFloat(formData.silverRate) || 0;
    return finalFineSilver * rate;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.customerName || !formData.mobile || !formData.weight || !formData.purity || !formData.silverRate) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      await api.post('/api/silver-purchase', formData);
      toast.success('Silver purchase recorded and added to inventory');
      setFormData({
        customerName: '',
        mobile: '',
        weight: '',
        purity: '925',
        silverRate: silverPrice?.rateSilver || '',
        deductionPercent: '0',
        notes: ''
      });
      fetchPurchases();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record purchase');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="old-gold-purchase-page">
      <div className="page-header">
        <h1>Silver Purchase</h1>
        <p>Buy silver from customers and add to inventory as Raw Silver</p>
      </div>

      <div className="purchase-container">
        <div className="card purchase-form-card">
          <h3>New Purchase Entry</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label><FiUser /> Customer Name</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="form-group">
                <label><FiSmartphone /> Mobile Number</label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="10 digit mobile"
                  required
                />
              </div>
              <div className="form-group">
                <label><FiHash /> Weight (g)</label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="0.000"
                  required
                />
              </div>
              <div className="form-group">
                <label><FiPercent /> Purity (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.purity}
                  onChange={(e) => setFormData({ ...formData, purity: e.target.value })}
                  placeholder="925"
                  required
                />
              </div>
              <div className="form-group">
                <label><FiDollarSign /> Silver Rate (₹/g)</label>
                <input
                  type="number"
                  value={formData.silverRate}
                  onChange={(e) => setFormData({ ...formData, silverRate: e.target.value })}
                  placeholder="Current Rate"
                  required
                />
              </div>
              <div className="form-group">
                <label><FiPercent /> Deduction (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.deductionPercent}
                  onChange={(e) => setFormData({ ...formData, deductionPercent: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-group full-width">
              <label>Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details..."
              />
            </div>

            <div className="calculation-summary">
              <div className="summary-item">
                <span>Fine Silver:</span>
                <strong>{calculateFineSilver().toFixed(3)}g</strong>
              </div>
              <div className="summary-item">
                <span>Final Fine Silver:</span>
                <strong>{calculateFinalFineSilver().toFixed(3)}g</strong>
              </div>
              <div className="summary-item highlight">
                <span>Total Amount:</span>
                <strong>{formatCurrency(calculateAmount())}</strong>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              <FiSave /> {loading ? 'Processing...' : 'Record Purchase'}
            </button>
          </form>
        </div>

        <div className="card purchase-history-card">
          <h3>Recent Purchases</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Weight</th>
                  <th>Fine Wt</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p._id}>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>
                      <strong>{p.customerName}</strong>
                      <br />
                      <small>{p.mobile}</small>
                    </td>
                    <td>{p.weight}g</td>
                    <td>{p.finalFineSilver.toFixed(3)}g</td>
                    <td>{formatCurrency(p.amountPaid)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center">No purchases yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SilverPurchase;
