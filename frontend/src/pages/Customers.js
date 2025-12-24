import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiUser, FiDollarSign, FiRefreshCw, FiClock } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Customers.css';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showClearArrearsModal, setShowClearArrearsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState({ invoices: [], payments: [] });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [clearAmount, setClearAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [showArrearsOnly, setShowArrearsOnly] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: { street: '', city: '', state: '', pincode: '' },
    creditLimit: ''
  });

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const filteredCustomers = customers.filter(customer => {
    if (showArrearsOnly) {
      return customer.totalDue > 0;
    }
    return true;
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = search ? { search } : {};
      const response = await api.get('/api/customers', { params });
      setCustomers(response.data);
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = async (customer) => {
    try {
      setSelectedCustomer(customer);
      const res = await api.get(`/api/customers/${customer._id}`);
      setHistoryData({
        invoices: res.data.invoices || [],
        payments: res.data.payments || []
      });
      setShowHistoryModal(true);
    } catch (error) {
      toast.error('Failed to load history');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await api.put(`/api/customers/${editingCustomer._id}`, formData);
        toast.success('Customer updated successfully');
      } else {
        // Check for duplicate phone
        const checkResponse = await api.get('/api/customers', { 
          params: { search: formData.phone } 
        });
        const existing = checkResponse.data.find(c => c.phone === formData.phone);
        if (existing) {
          toast.error('Customer with this phone number already exists');
          return;
        }
        await api.post('/api/customers', formData);
        toast.success('Customer created successfully');
      }
      setShowModal(false);
      setEditingCustomer(null);
      resetForm();
      fetchCustomers();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Customer with this phone already exists');
      } else {
        toast.error(error.response?.data?.message || 'Operation failed');
      }
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || { street: '', city: '', state: '', pincode: '' },
      creditLimit: customer.creditLimit || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await api.delete(`/api/customers/${id}`);
        toast.success('Customer deleted successfully');
        fetchCustomers();
      } catch (error) {
        toast.error('Failed to delete customer');
      }
    }
  };

  const handleClearArrears = async () => {
    if (!selectedCustomer) return;
    
    const amount = parseFloat(clearAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > selectedCustomer.totalDue) {
      toast.error('Amount cannot exceed total due');
      return;
    }

    try {
      const response = await api.put(`/api/customers/${selectedCustomer._id}/clear-arrears`, {
        amount: amount,
        paymentMode: paymentMode
      });
      
      toast.success(`Arrears of ${formatCurrency(amount)} cleared successfully`);
      setShowClearArrearsModal(false);
      setSelectedCustomer(null);
      setClearAmount('');
      setPaymentMode('Cash');
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to clear arrears');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: { street: '', city: '', state: '', pincode: '' },
      creditLimit: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <div>
          <h1>Customer Management</h1>
          <p>Manage your customers and their information</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={fetchCustomers} title="Refresh">
            <FiRefreshCw /> Refresh
          </button>
          <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); setEditingCustomer(null); }}>
            <FiPlus /> Add Customer
          </button>
        </div>
      </div>

      <div className="search-box-container">
        <div className="search-box">
          <FiSearch />
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="arrears-filter">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showArrearsOnly} 
              onChange={(e) => setShowArrearsOnly(e.target.checked)} 
            />
            Show Only with Arrears
          </label>
        </div>
        <div className="arrears-info-banner">
          <p>💡 <strong>Arrears Info:</strong> Customer ki arrears automatically update hoti hai jab invoice payment receive hoti hai.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading customers...</div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map((customer) => (
            <div key={customer._id} className="customer-card">
              <div className="customer-avatar">
                <FiUser />
              </div>
              <div className="customer-info">
                <h3>{customer.name}</h3>
                <p className="customer-phone">{customer.phone}</p>
                {customer.email && <p className="customer-email">{customer.email}</p>}
                {customer.address?.city && (
                  <p className="customer-email" style={{ fontSize: '0.85rem' }}>
                    {customer.address.city}, {customer.address.state}
                  </p>
                )}
                <div className="customer-stats">
                  <div className="stat">
                    <span className="stat-label">Total Purchases</span>
                    <span className="stat-value">{formatCurrency(customer.totalPurchases || 0)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Pending Dues (Arrears)</span>
                    <span className={`stat-value ${customer.totalDue > 0 ? 'due' : 'no-due'}`}>
                      {formatCurrency(customer.totalDue || 0)}
                    </span>
                    {customer.creditLimit > 0 && customer.totalDue > customer.creditLimit && (
                      <small style={{ color: '#ef4444', display: 'block', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        ⚠️ Exceeds Limit ({formatCurrency(customer.creditLimit)})
                      </small>
                    )}
                  </div>
                </div>
              </div>
              <div className="customer-actions">
                <button onClick={() => handleViewHistory(customer)} className="btn-icon-text" title="View History">
                  <FiClock /> History
                </button>
                {customer.totalDue > 0 && (
                  <button 
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setClearAmount(customer.totalDue.toString());
                      setShowClearArrearsModal(true);
                    }}
                    className="btn-clear-arrears"
                    title="Clear Arrears"
                  >
                    <FiDollarSign /> Clear
                  </button>
                )}
                <button onClick={() => handleEdit(customer)} title="Edit">
                  <FiEdit />
                </button>
                <button onClick={() => handleDelete(customer._id)} className="btn-danger" title="Delete">
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {customers.length === 0 && !loading && (
        <div className="empty-state">
          <FiUser size={48} />
          <h3>No customers found</h3>
          <p>Start by adding your first customer</p>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingCustomer(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Street Address</label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Credit Limit (₹)</label>
                <input
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setShowModal(false); setEditingCustomer(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClearArrearsModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => { setShowClearArrearsModal(false); setSelectedCustomer(null); setClearAmount(''); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Clear Arrears - {selectedCustomer.name}</h2>
            <div className="form-group">
              <label>Total Due: <span className="due">{formatCurrency(selectedCustomer.totalDue)}</span></label>
            </div>
            <div className="form-group">
              <label>Amount to Pay *</label>
              <input
                type="number"
                value={clearAmount}
                onChange={(e) => setClearAmount(e.target.value)}
                max={selectedCustomer.totalDue}
                placeholder="Enter amount"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => { setShowClearArrearsModal(false); setSelectedCustomer(null); }}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleClearArrears}>
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
      {showHistoryModal && selectedCustomer && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>History: {selectedCustomer.name}</h2>
              <button className="close-btn" onClick={() => setShowHistoryModal(false)}>&times;</button>
            </div>
            
            <div className="history-sections" style={{ display: 'flex', gap: '2rem', maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="history-section" style={{ flex: 1 }}>
                <h3>Recent Invoices</h3>
                {historyData.invoices.length > 0 ? (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Inv #</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.invoices.map(inv => (
                        <tr key={inv._id}>
                          <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                          <td>{inv.invoiceNumber}</td>
                          <td>{formatCurrency(inv.total)}</td>
                          <td>
                            <span className={`status-badge ${inv.status?.toLowerCase() || 'paid'}`}>
                              {inv.status || 'Paid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data">No invoices found.</p>
                )}
              </div>

              <div className="history-section" style={{ flex: 1 }}>
                <h3>Payment History</h3>
                {historyData.payments.length > 0 ? (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.payments.map(pay => (
                        <tr key={pay._id}>
                          <td>{new Date(pay.paymentDate).toLocaleDateString()}</td>
                          <td style={{ color: 'green', fontWeight: 'bold' }}>{formatCurrency(pay.amount)}</td>
                          <td>{pay.paymentMode}</td>
                          <td>{pay.referenceNumber || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="no-data">No payments found.</p>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
