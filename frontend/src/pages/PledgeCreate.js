import React, { useState } from 'react';
import { FiSave, FiUpload, FiArrowLeft } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Pledges.css';
import { useNavigate } from 'react-router-dom';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
};

const PledgeCreate = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '', governmentId: '', idProofUrl: '' });
  const [gold, setGold] = useState({ itemName: 'Chain', grossWeight: '', netWeight: '', purity: '22K', valuationAmount: '', itemPhotoUrl: '', damageStatus: 'Normal' });
  const [loan, setLoan] = useState({ amountGiven: '', interestPeriod: 'month', interestUnit: 'percent', interestRate: '', startDate: '', endDate: '', lateExtraPerDay: 0 });

  const [snapshot, setSnapshot] = useState({ totalInterest: 0, totalPayable: 0, remainingDays: 0 });

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data?.url || res.data?.path || res.data;
  };

  const recalc = async () => {
    try {
      if (!loan.startDate || !loan.endDate) return;
      const payload = { loan };
      const res = await api.get('/api/pledges', { params: { preview: '1' } }); // placeholder, compute locally
      const start = new Date(loan.startDate);
      const end = new Date(loan.endDate);
      const now = new Date();
      const dayMs = 24 * 60 * 60 * 1000;
      const days = Math.max(0, Math.ceil((Math.min(now, end).getTime() - start.getTime()) / dayMs));
      let baseInterest = 0;
      if (loan.interestUnit === 'amount') {
        baseInterest = days * Number(loan.interestRate || 0);
      } else {
        const principal = Number(loan.amountGiven || 0);
        const rate = Number(loan.interestRate || 0);
        if (loan.interestPeriod === 'day') {
          baseInterest = principal * (rate / 100) * days;
        } else {
          const months = Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
          baseInterest = principal * (rate / 100) * months;
        }
      }
      const overdueDays = now > end ? Math.ceil((now.getTime() - end.getTime()) / dayMs) : 0;
      const totalInterest = Math.round(baseInterest + Number(loan.lateExtraPerDay || 0) * overdueDays);
      const totalPayable = Math.round(Number(loan.amountGiven || 0) + totalInterest);
      const remainingDays = now < end ? Math.ceil((end.getTime() - now.getTime()) / dayMs) : 0;
      setSnapshot({ totalInterest, totalPayable, remainingDays });
    } catch (e) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customer.name || !customer.phone || !customer.email || !customer.address || !customer.governmentId) {
      toast.error('Fill all mandatory customer fields');
      return;
    }
    if (!gold.itemName || !gold.grossWeight || !gold.netWeight || !gold.purity || !gold.valuationAmount) {
      toast.error('Fill all gold details');
      return;
    }
    if (!loan.amountGiven || !loan.interestRate || !loan.startDate || !loan.endDate) {
      toast.error('Fill loan details');
      return;
    }
    try {
      setIsSubmitting(true);
      const payload = { customer, gold, loan };
      const res = await api.post('/api/pledges', payload);
      toast.success('Pledge created');
      navigate(`/pledges/${res.data._id}`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create pledge');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pledges-page">
      <div className="page-header">
        <div>
          <h1>New Pledge</h1>
          <p>Create a pledged gold record</p>
        </div>
        <button className="btn" onClick={() => navigate('/pledges')}>
          <FiArrowLeft /> Back
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <h3 className="section-title">Customer Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Full Name *</label>
            <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Mobile Number *</label>
            <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email ID *</label>
            <input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Address *</label>
            <input value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Aadhaar / Govt. ID *</label>
            <input value={customer.governmentId} onChange={e => setCustomer({ ...customer, governmentId: e.target.value })} />
          </div>
          <div className="form-group">
            <label>ID Proof Photo *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await uploadFile(f);
                setCustomer({ ...customer, idProofUrl: url });
              }} />
              {customer.idProofUrl && <a href={customer.idProofUrl} target="_blank" rel="noreferrer">View</a>}
            </div>
          </div>
        </div>

        <h3 className="section-title">Gold Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Item Name *</label>
            <select value={gold.itemName} onChange={e => setGold({ ...gold, itemName: e.target.value })}>
              <option>Chain</option>
              <option>Ring</option>
              <option>Bangle</option>
              <option>Necklace</option>
              <option>Bracelet</option>
            </select>
          </div>
          <div className="form-group">
            <label>Gross Weight (g) *</label>
            <input type="number" step="0.01" value={gold.grossWeight} onChange={e => setGold({ ...gold, grossWeight: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Net Weight (g) *</label>
            <input type="number" step="0.01" value={gold.netWeight} onChange={e => setGold({ ...gold, netWeight: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Purity *</label>
            <select value={gold.purity} onChange={e => setGold({ ...gold, purity: e.target.value })}>
              <option>22K</option>
              <option>24K</option>
              <option>18K</option>
            </select>
          </div>
          <div className="form-group">
            <label>Valuation Amount *</label>
            <input type="number" step="0.01" value={gold.valuationAmount} onChange={e => setGold({ ...gold, valuationAmount: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Gold Item Photo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="file" accept="image/*" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await uploadFile(f);
                setGold({ ...gold, itemPhotoUrl: url });
              }} />
              {gold.itemPhotoUrl && <a href={gold.itemPhotoUrl} target="_blank" rel="noreferrer">View</a>}
            </div>
          </div>
          <div className="form-group">
            <label>Damage Status</label>
            <select value={gold.damageStatus} onChange={e => setGold({ ...gold, damageStatus: e.target.value })}>
              <option>Normal</option>
              <option>Slight Damage</option>
              <option>Heavy Damage</option>
            </select>
          </div>
        </div>

        <h3 className="section-title">Loan Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Loan Amount *</label>
            <input type="number" step="1" value={loan.amountGiven} onChange={e => { const v = { ...loan, amountGiven: e.target.value }; setLoan(v); recalc(); }} />
          </div>
          <div className="form-group">
            <label>Interest Type *</label>
            <select value={loan.interestPeriod} onChange={e => { const v = { ...loan, interestPeriod: e.target.value }; setLoan(v); recalc(); }}>
              <option value="day">Per Day</option>
              <option value="month">Per Month</option>
            </select>
          </div>
          <div className="form-group">
            <label>Rate Mode *</label>
            <select value={loan.interestUnit} onChange={e => { const v = { ...loan, interestUnit: e.target.value }; setLoan(v); recalc(); }}>
              <option value="amount">₹</option>
              <option value="percent">%</option>
            </select>
          </div>
          <div className="form-group">
            <label>Interest Rate *</label>
            <input type="number" step="0.01" value={loan.interestRate} onChange={e => { const v = { ...loan, interestRate: e.target.value }; setLoan(v); recalc(); }} />
          </div>
          <div className="form-group">
            <label>Start Date *</label>
            <input type="date" value={loan.startDate} onChange={e => { const v = { ...loan, startDate: e.target.value }; setLoan(v); recalc(); }} />
          </div>
          <div className="form-group">
            <label>End Date *</label>
            <input type="date" value={loan.endDate} onChange={e => { const v = { ...loan, endDate: e.target.value }; setLoan(v); recalc(); }} />
          </div>
          <div className="form-group">
            <label>Late-Day Extra (₹/day)</label>
            <input type="number" step="1" value={loan.lateExtraPerDay} onChange={e => { const v = { ...loan, lateExtraPerDay: e.target.value }; setLoan(v); recalc(); }} />
          </div>
        </div>

        <div className="pledge-card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div><strong>Total Interest:</strong> {formatCurrency(snapshot.totalInterest)}</div>
              <div><strong>Total Payable:</strong> {formatCurrency(snapshot.totalPayable)}</div>
            </div>
            <div>
              <div><strong>Remaining Days:</strong> {snapshot.remainingDays}</div>
            </div>
          </div>
        </div>

        <div className="pledge-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => navigate('/pledges')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : (<><FiSave /> Save Pledge</>)}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PledgeCreate;

