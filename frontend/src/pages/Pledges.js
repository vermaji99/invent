import React, { useEffect, useState } from 'react';
import { FiPlus, FiSearch, FiEye, FiPrinter, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Pledges.css';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

const Pledges = () => {
  const [pledges, setPledges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const navigate = useNavigate();

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/pledges', { params: { search, status } });
      setPledges(res.data);
    } catch (e) {
      toast.error('Failed to load pledges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [search, status]);

  return (
    <div className="pledges-page">
      <div className="page-header">
        <div>
          <h1>Pledged Gold Management</h1>
          <p>Track pledged gold, interest, and redemption</p>
        </div>
        <div className="pledges-toolbar">
          <div className="customer-search-box">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by name, phone, or receipt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="Active">Active</option>
            <option value="Redeemed">Redeemed</option>
            <option value="Overdue">Overdue</option>
          </select>
          <button className="btn-primary" onClick={() => navigate('/pledges/create')}>
            <FiPlus /> New Pledge
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading pledges...</div>
      ) : pledges.length === 0 ? (
        <div className="empty-state">No records found.</div>
      ) : (
        pledges.map(p => (
          <div className="pledge-card" key={p._id}>
            <div className="pledge-meta">
              <div>
                <h3>{p.customer?.name}</h3>
                <p>{p.customer?.phone} • {p.customer?.email}</p>
                <small>Receipt: {p.receiptNumber}</small>
              </div>
              <div>
                <div className={`status-badge ${p.status.toLowerCase()}`}>{p.status}</div>
                <div style={{ marginTop: 6, textAlign: 'right' }}>
                  <div><strong>Loan:</strong> {formatCurrency(p.loan?.amountGiven)}</div>
                  <div><strong>Payable:</strong> {formatCurrency(p.totalPayable)}</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div>Item: {p.gold?.itemName} • Net: {p.gold?.netWeight}g • Purity: {p.gold?.purity}</div>
                <small>Due: {new Date(p.loan?.endDate).toLocaleDateString('en-IN')} • Remaining: {p.remainingDays} day(s)</small>
              </div>
              <div className="pledge-actions">
                <button className="btn-icon" title="View" onClick={() => navigate(`/pledges/${p._id}`)} disabled={actionLoadingId === p._id}>
                  {actionLoadingId === p._id ? <FiAlertTriangle className="spin" /> : <FiEye />}
                </button>
                <button className="btn-icon" title="Print" onClick={() => navigate(`/pledges/${p._id}?print=1`)} disabled={actionLoadingId === p._id}>
                  {actionLoadingId === p._id ? <FiAlertTriangle className="spin" /> : <FiPrinter />}
                </button>
                {p.status === 'Active' && (
                  <button className="btn-primary" onClick={async () => {
                    if (actionLoadingId) return;
                    setActionLoadingId(p._id);
                    try {
                      await api.patch(`/api/pledges/${p._id}/status`, { status: 'Redeemed' });
                      toast.success('Marked Redeemed');
                      fetchList();
                    } catch (e) {
                      toast.error('Failed to update status');
                    } finally {
                      setActionLoadingId(null);
                    }
                  }}>
                    <FiCheckCircle /> Redeem
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default Pledges;

