import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiPrinter, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Pledges.css';

const PledgeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pledge, setPledge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [shopDetails, setShopDetails] = useState(null);
  const printRef = useRef();

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/pledges/${id}`);
      setPledge(res.data);
    } catch (e) {
      toast.error('Failed to load pledge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [id]);
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.get('/api/settings');
        setShopDetails(res.data?.shopDetails || null);
      } catch (e) {}
    }
    fetchSettings();
  }, []);
  useEffect(() => {
    if (params.get('print') === '1' && pledge) {
      setTimeout(() => window.print(), 200);
    }
  }, [params, pledge]);

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

  if (loading) return <div className="loading">Loading...</div>;
  if (!pledge) return <div className="empty-state">Not found</div>;

  return (
    <div className="pledges-page">
      <div className="page-header">
        <div>
          <h1>Pledge Detail</h1>
          <p>Receipt: {pledge.receiptNumber}</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/pledges')}>
          <FiArrowLeft /> Back
        </button>
      </div>

      <div className="pledge-card detail-card">
        <div className="detail-header">
          <div className="customer-info">
            <h3>{pledge.customer?.name}</h3>
            <p className="contact-info">{pledge.customer?.phone} • {pledge.customer?.email}</p>
            <p className="address-info">{pledge.customer?.address}</p>
            <p className="id-info">Government ID: <strong>{pledge.customer?.governmentId}</strong></p>
          </div>
          <div className="status-info">
            <div className={`status-badge ${pledge.status.toLowerCase()}`}>{pledge.status}</div>
            <div className="loan-summary">
              <div className="summary-row">
                <span>Loan Amount:</span>
                <strong>{formatCurrency(pledge.loan?.amountGiven)}</strong>
              </div>
              <div className="summary-row">
                <span>Interest:</span>
                <strong>{formatCurrency(pledge.totalInterest)}</strong>
              </div>
              <div className="summary-row total">
                <span>Total Payable:</span>
                <strong>{formatCurrency(pledge.totalPayable)}</strong>
              </div>
              <div className="summary-row highlight">
                <span>Remaining:</span>
                <strong>{pledge.remainingDays} day(s)</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="detail-sections">
          <div className="detail-section">
            <h4><FiCheckCircle /> Gold Details</h4>
            <div className="section-grid">
              <div className="grid-item">
                <span>Item Name:</span>
                <strong>{pledge.gold?.itemName}</strong>
              </div>
              <div className="grid-item">
                <span>Gross Weight:</span>
                <strong>{pledge.gold?.grossWeight}g</strong>
              </div>
              <div className="grid-item">
                <span>Net Weight:</span>
                <strong>{pledge.gold?.netWeight}g</strong>
              </div>
              <div className="grid-item">
                <span>Purity:</span>
                <strong>{pledge.gold?.purity}</strong>
              </div>
              <div className="grid-item">
                <span>Valuation:</span>
                <strong>{formatCurrency(pledge.gold?.valuationAmount)}</strong>
              </div>
              <div className="grid-item">
                <span>Damage:</span>
                <strong>{pledge.gold?.damageStatus}</strong>
              </div>
            </div>
            {pledge.gold?.itemPhotoUrl && (
              <a href={pledge.gold.itemPhotoUrl} className="view-photo-btn" target="_blank" rel="noreferrer">
                View Item Photo
              </a>
            )}
          </div>

          <div className="detail-section">
            <h4><FiAlertTriangle /> Loan Details</h4>
            <div className="section-grid">
              <div className="grid-item">
                <span>Interest Type:</span>
                <strong>{pledge.loan?.interestPeriod === 'day' ? 'Per Day' : 'Per Month'}</strong>
              </div>
              <div className="grid-item">
                <span>Rate Mode:</span>
                <strong>{pledge.loan?.interestUnit === 'amount' ? '₹' : '%'}</strong>
              </div>
              <div className="grid-item">
                <span>Interest Rate:</span>
                <strong>{pledge.loan?.interestRate}</strong>
              </div>
              <div className="grid-item">
                <span>Start Date:</span>
                <strong>{new Date(pledge.loan?.startDate).toLocaleDateString('en-IN')}</strong>
              </div>
              <div className="grid-item">
                <span>End Date:</span>
                <strong>{new Date(pledge.loan?.endDate).toLocaleDateString('en-IN')}</strong>
              </div>
              {pledge.loan?.lateExtraPerDay > 0 && (
                <div className="grid-item highlight">
                  <span>Late Extra:</span>
                  <strong>₹{pledge.loan.lateExtraPerDay}/day</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pledge-actions-bar">
        <div className="action-group">
          <button className="btn-icon" title="Print" onClick={() => window.print()} disabled={updating}>
            {updating ? <FiAlertTriangle className="spin" /> : <FiPrinter />}
          </button>
          <button className="btn-icon" title="Download" onClick={() => window.print()} disabled={updating}>
            {updating ? <FiAlertTriangle className="spin" /> : <FiDownload />}
          </button>
        </div>
        
        {pledge.status === 'Active' && (
          <button className="btn-primary redeem-btn" onClick={async () => {
            if (updating) return;
            setUpdating(true);
            try {
              await api.patch(`/api/pledges/${pledge._id}/status`, { status: 'Redeemed' });
              toast.success('Marked Redeemed');
              fetchDetail();
            } catch (e) {
              toast.error('Failed to update status');
            } finally {
              setUpdating(false);
            }
          }}>
            <FiCheckCircle /> Redeem Gold
          </button>
        )}
      </div>

      <div className="invoice-print-container" ref={printRef} style={{ display: 'none' }}>
        <div className="invoice-header">
          <div className="shop-info">
            {shopDetails?.logoUrl && <img src={shopDetails.logoUrl} alt="Logo" style={{ height: 60 }} />}
            <h1 className="shop-name">{shopDetails?.name || 'VSKK'}</h1>
            <p className="shop-subtitle">Vaibhav Swarn Kala Kendra</p>
            <p>{shopDetails?.address}</p>
            <p>Phone: {shopDetails?.phone} | Email: {shopDetails?.email}</p>
          </div>
          <div className="invoice-meta">
            <h2>PLEDGE RECEIPT</h2>
            <div className="meta-row"><span>Receipt No:</span><strong>{pledge.receiptNumber}</strong></div>
            <div className="meta-row"><span>Date:</span><strong>{new Date(pledge.createdAt).toLocaleDateString('en-IN')}</strong></div>
          </div>
        </div>
        <div className="invoice-customer-section">
          <div className="customer-details">
            <h3>Customer:</h3>
            <p><strong>{pledge.customer?.name}</strong></p>
            <p>{pledge.customer?.address}</p>
            <p>Phone: {pledge.customer?.phone} | Email: {pledge.customer?.email}</p>
            <p>ID: {pledge.customer?.governmentId}</p>
          </div>
        </div>
        <table className="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Net Weight (g)</th>
              <th>Purity</th>
              <th>Valuation</th>
              <th>Damage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{pledge.gold?.itemName}</td>
              <td>{pledge.gold?.netWeight}</td>
              <td>{pledge.gold?.purity}</td>
              <td>{formatCurrency(pledge.gold?.valuationAmount)}</td>
              <td>{pledge.gold?.damageStatus}</td>
            </tr>
          </tbody>
        </table>
        <div className="invoice-footer-section">
          <div className="terms-section">
            <h4>Terms & Disclaimer:</h4>
            <ul>
              <li>Gold pledged will be returned upon full payment.</li>
              <li>Overdue may incur extra charges as per policy.</li>
              <li>Subject to local jurisdiction.</li>
            </ul>
            <div className="signature-area">
              <p>Authorized Signatory</p>
            </div>
          </div>
          <div className="totals-section">
            <div className="total-row"><span>Loan Amount:</span><span>{formatCurrency(pledge.loan?.amountGiven)}</span></div>
            <div className="total-row"><span>Total Interest:</span><span>{formatCurrency(pledge.totalInterest)}</span></div>
            <div className="grand-total-row"><span>Total Payable:</span><span>₹ {pledge.totalPayable}</span></div>
            <div className="amount-words">Due Date: {new Date(pledge.loan?.endDate).toLocaleDateString('en-IN')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PledgeDetail;
