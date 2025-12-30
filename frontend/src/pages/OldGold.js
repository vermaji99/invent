import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiX, FiDollarSign } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './OldGold.css';

const OldGold = () => {
  const [oldGoldRecords, setOldGoldRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [goldPrice, setGoldPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [formData, setFormData] = useState({
    customer: '',
    category: 'Gold',
    weight: '',
    purity: '22K',
    rate: '',
    purityTested: false,
    testNotes: '',
    notes: ''
  });

  useEffect(() => {
    fetchOldGold();
    fetchGoldPrice();
  }, []);

  useEffect(() => {
    if (customerSearch.length >= 2) {
      fetchCustomers();
    } else {
      setCustomers([]);
    }
  }, [customerSearch]);

  const fetchOldGold = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/old-gold');
      setOldGoldRecords(response.data);
    } catch (error) {
      toast.error('Failed to load old gold records');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const params = { search: customerSearch };
      const response = await api.get('/api/customers', { params });
      setCustomers(response.data);
    } catch (error) {
      // Silent fail
    }
  };

  const fetchGoldPrice = async () => {
    try {
      const response = await api.get('/api/gold-price');
      setGoldPrice(response.data);
      // Auto-fill rate based on purity
      if (formData.purity === '22K' && response.data.rate22K) {
        setFormData({ ...formData, rate: response.data.rate22K });
      } else if (formData.purity === '24K' && response.data.rate24K) {
        setFormData({ ...formData, rate: response.data.rate24K });
      } else if (formData.purity === '18K' && response.data.rate18K) {
        setFormData({ ...formData, rate: response.data.rate18K });
      }
    } catch (error) {
      // Silent fail
    }
  };

  const fetchCustomerInvoices = async (customerId) => {
    try {
      const response = await api.get('/api/invoices', { params: { customer: customerId } });
      setInvoices(response.data.filter(inv => inv.dueAmount > 0 || inv.status !== 'Paid'));
    } catch (error) {
      toast.error('Failed to load invoices');
    }
  };

  const handlePurityChange = (purity) => {
    let rate = '';
    if (goldPrice) {
      if (purity === '22K') rate = goldPrice.rate22K || '';
      else if (purity === '24K') rate = goldPrice.rate24K || '';
      else if (purity === '18K') rate = goldPrice.rate18K || '';
    }
    setFormData({ ...formData, purity, rate });
  };

  const calculateTotalValue = () => {
    const weight = parseFloat(formData.weight) || 0;
    const rate = parseFloat(formData.rate) || 0;
    return weight * rate;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.customer) {
      toast.error('Please select a customer');
      return;
    }

    if (!formData.weight || !formData.rate) {
      toast.error('Please enter weight and rate');
      return;
    }

    try {
      const oldGoldData = {
        customer: formData.customer,
        weight: parseFloat(formData.weight),
        purity: formData.purity,
        rate: parseFloat(formData.rate),
        purityTested: formData.purityTested,
        testNotes: formData.testNotes,
        notes: formData.notes
      };

      await api.post('/api/old-gold', oldGoldData);
      toast.success('Old gold record created successfully');
      setShowModal(false);
      resetForm();
      fetchOldGold();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create record');
    }
  };

  const handleAdjust = async (invoiceId, amount) => {
    if (!selectedRecord) return;

    try {
      await api.put(`/api/old-gold/${selectedRecord._id}/adjust`, {
        invoiceId,
        amount: parseFloat(amount)
      });

      // Update invoice with old gold adjustment
      const invoice = await api.get(`/api/invoices/${invoiceId}`);
      const updatedItems = invoice.data.items.map(item => ({
        ...item,
        oldGoldAdjustment: item.oldGoldAdjustment || 0
      }));
      
      // Find the first item and add adjustment
      if (updatedItems.length > 0) {
        updatedItems[0].oldGoldAdjustment = (updatedItems[0].oldGoldAdjustment || 0) + parseFloat(amount);
      }

      await api.put(`/api/invoices/${invoiceId}`, {
        items: updatedItems
      });

      toast.success('Old gold adjusted against invoice successfully');
      setShowAdjustModal(false);
      setSelectedRecord(null);
      fetchOldGold();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to adjust old gold');
    }
  };

  const resetForm = () => {
    setFormData({
      customer: '',
      weight: '',
      purity: '22K',
      rate: '',
      purityTested: false,
      testNotes: '',
      notes: ''
    });
    setCustomerSearch('');
    setCustomers([]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN');
  };

  const totalValue = calculateTotalValue();

  const filteredRecords = oldGoldRecords.filter(record => {
    if (categoryFilter === 'All') return true;
    return (record.category || 'Gold') === categoryFilter;
  });

  return (
    <div className="oldgold-page">
      <div className="page-header">
        <div>
          <h1>Old Metal / Exchange</h1>
          <p>Manage old gold, silver, and other metal transactions</p>
        </div>
        <div className="header-actions">
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="category-filter"
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '10px',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              background: 'rgba(30, 30, 30, 0.8)',
              color: 'var(--gold-primary)',
              marginRight: '1rem',
              cursor: 'pointer'
            }}
          >
            <option value="All">All Categories</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Platinum">Platinum</option>
            <option value="Other">Other</option>
          </select>
          <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); fetchGoldPrice(); }}>
            <FiPlus /> New Record
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading records...</div>
      ) : (
        <div className="oldgold-list">
          {filteredRecords.length === 0 ? (
            <div className="empty-state">
              <p>No records found.</p>
            </div>
          ) : (
            filteredRecords.map((record) => (
              <div key={record._id} className="oldgold-card">
                <div className="oldgold-header">
                  <div>
                    <h3>{record.customer?.name}</h3>
                    <p>{record.customer?.phone}</p>
                    <p className="oldgold-date">{formatDate(record.createdAt)}</p>
                  </div>
                  <div className="oldgold-value">
                    {formatCurrency(record.totalValue)}
                  </div>
                </div>
                <div className="oldgold-details">
                  <div className="detail">
                    <span>Category:</span>
                    <span>{record.category || 'Gold'}</span>
                  </div>
                  <div className="detail">
                    <span>Weight:</span>
                    <span>{record.weight}g</span>
                  </div>
                  <div className="detail">
                    <span>Purity:</span>
                    <span>{record.purity}</span>
                  </div>
                  <div className="detail">
                    <span>Rate:</span>
                    <span>{formatCurrency(record.rate)}/g</span>
                  </div>
                  <div className="detail">
                    <span>Status:</span>
                    <span className={`status-badge ${record.status.toLowerCase()}`}>
                      {record.status}
                    </span>
                  </div>
                  {record.purityTested && (
                    <div className="detail">
                      <span>Purity Tested:</span>
                      <span>Yes</span>
                    </div>
                  )}
                </div>
                {record.status === 'Pending' && (
                  <div className="oldgold-actions">
                    <button
                      onClick={() => {
                        setSelectedRecord(record);
                        fetchCustomerInvoices(record.customer._id);
                        setShowAdjustModal(true);
                      }}
                      className="btn-adjust"
                    >
                      <FiDollarSign /> Adjust Against Invoice
                    </button>
                  </div>
                )}
                {record.adjustedAgainst?.invoice && (
                  <div className="adjusted-info">
                    <p>Adjusted against Invoice: {record.adjustedAgainst.invoice?.invoiceNumber || 'N/A'}</p>
                    <p>Amount: {formatCurrency(record.adjustedAgainst.amount)}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* New Record Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content oldgold-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Old Gold Record</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Customer *</label>
                <div className="customer-search-box">
                  <FiSearch />
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      if (e.target.value.length < 2) {
                        setCustomers([]);
                        setFormData({ ...formData, customer: '' });
                      }
                    }}
                  />
                </div>
                {customers.length > 0 && (
                  <div className="customer-dropdown">
                    {customers.map(customer => (
                      <div
                        key={customer._id}
                        className="customer-option"
                        onClick={() => {
                          setFormData({ ...formData, customer: customer._id });
                          setCustomerSearch(customer.name);
                          setCustomers([]);
                        }}
                      >
                        <strong>{customer.name}</strong>
                        <p>{customer.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
                {formData.customer && (
                  <p className="selected-customer">
                    Selected: {customers.find(c => c._id === formData.customer)?.name || 'Customer'}
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Weight (g) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    required
                    placeholder="Weight in grams"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Purity *</label>
                <input 
                  type="text" 
                  value={formData.purity}
                  onChange={(e) => handlePurityChange(e.target.value)}
                  placeholder="e.g. 22K, 925, 18K"
                  required
                />
              </div>

              <div className="form-group">
                <label>Rate (₹/g) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                  placeholder="Rate per gram"
                />
                {goldPrice && (
                  <small>Current {formData.purity} rate: {formatCurrency(goldPrice[`rate${formData.purity.replace('K', 'K')}`] || 0)}/g</small>
                )}
              </div>

              <div className="total-value-display">
                <strong>Total Value: {formatCurrency(totalValue)}</strong>
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.purityTested}
                    onChange={(e) => setFormData({ ...formData, purityTested: e.target.checked })}
                  />
                  Purity Tested
                </label>
              </div>

              {formData.purityTested && (
                <div className="form-group">
                  <label>Test Notes</label>
                  <textarea
                    value={formData.testNotes}
                    onChange={(e) => setFormData({ ...formData, testNotes: e.target.value })}
                    rows="3"
                    placeholder="Purity test details..."
                  />
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Against Invoice Modal */}
      {showAdjustModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => { setShowAdjustModal(false); setSelectedRecord(null); setInvoices([]); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Old Gold Against Invoice</h2>
              <button className="modal-close" onClick={() => { setShowAdjustModal(false); setSelectedRecord(null); setInvoices([]); }}>
                <FiX />
              </button>
            </div>
            <div className="adjust-info">
              <p><strong>Old Gold Value:</strong> {formatCurrency(selectedRecord.totalValue)}</p>
              <p><strong>Customer:</strong> {selectedRecord.customer?.name}</p>
            </div>
            {invoices.length === 0 ? (
              <p>No pending invoices found for this customer.</p>
            ) : (
              <div className="invoices-list">
                {invoices.map(invoice => (
                  <div key={invoice._id} className="invoice-option">
                    <div>
                      <strong>{invoice.invoiceNumber}</strong>
                      <p>Total: {formatCurrency(invoice.total)} | Due: {formatCurrency(invoice.dueAmount)}</p>
                      <p>Date: {formatDate(invoice.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => {
                        const adjustAmount = Math.min(selectedRecord.totalValue, invoice.dueAmount);
                        handleAdjust(invoice._id, adjustAmount);
                      }}
                      className="btn-adjust-invoice"
                    >
                      Adjust {formatCurrency(Math.min(selectedRecord.totalValue, invoice.dueAmount))}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OldGold;
