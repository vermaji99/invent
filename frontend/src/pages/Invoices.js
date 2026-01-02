import React, { useState, useEffect, useRef } from 'react';
import { FiEye, FiDownload, FiX, FiPrinter, FiDollarSign, FiRefreshCw, FiFilter, FiCheckSquare, FiSquare, FiCalendar } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Invoices.css';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const printRef = useRef();
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterPreset, setFilterPreset] = useState('LAST_7_DAYS');
  const [filterStartDateDD, setFilterStartDateDD] = useState('');
  const [filterEndDateDD, setFilterEndDateDD] = useState('');
  const [printBatch, setPrintBatch] = useState([]);
  const batchPrintRef = useRef();

  useEffect(() => {
    applyPreset('LAST_7_DAYS', true);
  }, []);

  const fetchInvoices = async (params) => {
    try {
      const response = await api.get('/api/invoices', { params });
      setInvoices(response.data);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoiceDetails = async (invoiceId) => {
    const response = await api.get(`/api/invoices/${invoiceId}`);
    setSelectedInvoice(response.data);
    return response.data;
  };

  const toYMD = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const ymdToDDMMYYYY = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${d}-${m}-${y}`;
  };
  const ddmmToYMD = (ddmm) => {
    if (!ddmm) return '';
    const parts = ddmm.split('-');
    if (parts.length !== 3) return '';
    const [dd, mm, yyyy] = parts;
    if (!dd || !mm || !yyyy) return '';
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  };

  const applyPreset = async (preset, initial = false) => {
    let start = '';
    let end = '';
    const now = new Date();
    if (preset === 'TODAY') {
      start = toYMD(now);
      end = toYMD(now);
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = toYMD(y);
      end = toYMD(y);
    } else if (preset === 'LAST_7_DAYS') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      start = toYMD(s);
      end = toYMD(now);
    } else if (preset === 'THIS_MONTH') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      start = toYMD(s);
      end = toYMD(e);
    } else if (preset === 'LAST_MONTH') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      start = toYMD(s);
      end = toYMD(e);
    } else if (preset === 'CUSTOM') {
      start = ddmmToYMD(filterStartDateDD) || '';
      end = ddmmToYMD(filterEndDateDD) || '';
    }
    setFilterPreset(preset);
    setFilterStartDateDD(ymdToDDMMYYYY(start));
    setFilterEndDateDD(ymdToDDMMYYYY(end));
    setLoading(true);
    await fetchInvoices({ startDate: start || undefined, endDate: end || undefined });
    if (!initial) {
      toast.success('Invoices filtered');
    }
  };

  const handleApplyCustom = async () => {
    setFilterPreset('CUSTOM');
    if (!filterStartDateDD || !filterEndDateDD) {
      toast.error('Select both start and end dates');
      return;
    }
    setLoading(true);
    const sYMD = ddmmToYMD(filterStartDateDD);
    const eYMD = ddmmToYMD(filterEndDateDD);
    await fetchInvoices({ startDate: sYMD, endDate: eYMD });
    toast.success('Invoices filtered');
  };

  const handleResetFilter = async () => {
    setFilterPreset('LAST_7_DAYS');
    setFilterStartDateDD('');
    setFilterEndDateDD('');
    setLoading(true);
    await fetchInvoices({});
    toast.success('Filter reset');
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllVisible = () => {
    const next = new Set(selectedIds);
    invoices.forEach(inv => next.add(inv._id));
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const fetchBatchDetails = async (ids) => {
    const results = [];
    for (const id of ids) {
      try {
        const res = await api.get(`/api/invoices/${id}`);
        results.push(res.data);
      } catch (e) {}
    }
    return results;
  };

  const handlePrintSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one invoice');
      return;
    }
    const ids = Array.from(selectedIds);
    const details = await fetchBatchDetails(ids);
    if (details.length === 0) {
      toast.error('No invoices loaded for printing');
      return;
    }
    setPrintBatch(details);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleViewInvoice = async (invoiceId) => {
    if (actionLoadingId) return;
    try {
      setActionLoadingId(invoiceId);
      await fetchInvoiceDetails(invoiceId);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load invoice details');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenPayment = async (invoiceId) => {
    if (actionLoadingId) return;
    try {
      setActionLoadingId(invoiceId);
      await fetchInvoiceDetails(invoiceId);
      setPaymentAmount('');
      setPaymentMode('Cash');
      setShowPaymentModal(true);
    } catch (error) {
      toast.error('Failed to load invoice details');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    if (actionLoadingId) return;
    try {
      setActionLoadingId(invoice._id);
      await fetchInvoiceDetails(invoice._id);
      
      // Wait for state to update, then trigger print
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (error) {
      toast.error('Failed to load invoice for download');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAddPayment = async () => {
    if (isAddingPayment) return;
    if (!selectedInvoice) return;

    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > selectedInvoice.dueAmount) {
      toast.error('Payment amount cannot exceed due amount');
      return;
    }

    try {
      setIsAddingPayment(true);
      const response = await api.put(`/api/invoices/${selectedInvoice._id}/payment`, {
        amount: amount,
        paymentMode: paymentMode
      });

      toast.success(`Payment of ${formatCurrency(amount)} added successfully. Customer arrears updated!`);
      
      // Refresh the invoice list
      await fetchInvoices();
      
      // Update selected invoice with fresh data
      const freshInvoice = await api.get(`/api/invoices/${selectedInvoice._id}`);
      setSelectedInvoice(freshInvoice.data);
      
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentMode('Cash');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add payment');
    } finally {
      setIsAddingPayment(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="invoices-page">
      <div className="page-header">
        <h1>Invoices</h1>
        <p>View and manage all invoices</p>
      </div>

      <div className="invoices-toolbar">
        <div className="filters">
          <div className="group">
            <label className="label"><FiFilter /> Preset</label>
            <select value={filterPreset} onChange={(e) => applyPreset(e.target.value)}>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>
          <div className="group">
            <span className="label">Custom Range</span>
          </div>
          <div className="group">
            <label className="label"><FiCalendar /> From</label>
            <input
              type="text"
              placeholder="dd-mm-yyyy"
              value={filterStartDateDD}
              onChange={(e) => setFilterStartDateDD(e.target.value)}
            />
          </div>
          <div className="group">
            <label className="label">To</label>
            <input
              type="text"
              placeholder="dd-mm-yyyy"
              value={filterEndDateDD}
              onChange={(e) => setFilterEndDateDD(e.target.value)}
            />
          </div>
          <div className="group actions">
            <button className="btn-primary" onClick={handleApplyCustom} disabled={loading}>Apply</button>
            <button onClick={handleResetFilter} disabled={loading}>Reset</button>
          </div>
        </div>
        <div className="batch-actions">
          <div className="count">Selected: {selectedIds.size}</div>
          <button onClick={selectAllVisible} disabled={loading || invoices.length === 0}><FiCheckSquare /> Select All</button>
          <button onClick={clearSelection} disabled={selectedIds.size === 0}><FiSquare /> Clear</button>
          <button className="btn-primary" onClick={handlePrintSelected} disabled={selectedIds.size === 0}><FiPrinter /> Print Selected</button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading invoices...</div>
      ) : (
          <div className="invoices-grid">
            {invoices.length === 0 ? (
              <div className="no-data">No invoices found</div>
            ) : (
              invoices.map((invoice) => (
                <div
                  className={`invoice-card ${selectedIds.has(invoice._id) ? 'selected' : ''}`}
                  key={invoice._id}
                  onClick={() => toggleSelect(invoice._id)}
                  role="checkbox"
                  aria-checked={selectedIds.has(invoice._id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleSelect(invoice._id);
                    }
                  }}
                >
                  <div className="card-header">
                    <span className="invoice-number">{invoice.invoiceNumber}</span>
                    <span className={`status-badge ${(invoice.dueAmount <= 0 ? 'Paid' : invoice.status).toLowerCase()}`}>
                      {invoice.dueAmount <= 0 ? 'Paid' : invoice.status}
                    </span>
                    <label className="select-checkbox">
                      <input
                        type="checkbox"
                        title="Select invoice"
                        checked={selectedIds.has(invoice._id)}
                        onChange={() => toggleSelect(invoice._id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                  </div>
                  <div className="card-meta">
                    <span>{invoice.customer?.name || 'N/A'}</span>
                    <span>{formatDate(invoice.createdAt)}</span>
                  </div>
                  <div className="card-totals">
                    <div>
                      <span>Total</span>
                      <span>{formatCurrency(invoice.total)}</span>
                    </div>
                    <div>
                      <span>Paid</span>
                      <span>{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    <div className={invoice.dueAmount > 0 ? 'due' : ''}>
                      <span>Due</span>
                      <span>{formatCurrency(invoice.dueAmount)}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    {invoice.dueAmount > 0 && (
                      <button
                        className="btn-icon btn-payment"
                        title="Add Payment"
                        onClick={(e) => { e.stopPropagation(); handleOpenPayment(invoice._id); }}
                        disabled={actionLoadingId === invoice._id}
                      >
                        {actionLoadingId === invoice._id ? <FiRefreshCw className="spin" /> : <FiDollarSign />}
                      </button>
                    )}
                    <button
                      className="btn-icon"
                      title="View Invoice"
                      onClick={(e) => { e.stopPropagation(); handleViewInvoice(invoice._id); }}
                      disabled={actionLoadingId === invoice._id}
                    >
                      {actionLoadingId === invoice._id ? <FiRefreshCw className="spin" /> : <FiEye />}
                    </button>
                    <button
                      className="btn-icon"
                      title="Download/Print Invoice"
                      onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(invoice); }}
                      disabled={actionLoadingId === invoice._id}
                    >
                      {actionLoadingId === invoice._id ? <FiRefreshCw className="spin" /> : <FiDownload />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => { setShowViewModal(false); setSelectedInvoice(null); }}>
          <div className="modal-content invoice-view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Invoice Details</h2>
              <div className="modal-header-actions">
                <button 
                  className="btn-icon" 
                  onClick={() => window.print()}
                  title="Print"
                >
                  <FiPrinter />
                </button>
                <button 
                  className="modal-close" 
                  onClick={() => { setShowViewModal(false); setSelectedInvoice(null); }}
                >
                  <FiX />
                </button>
              </div>
            </div>
            
            <div className="invoice-details">
              <div className="invoice-header-section">
                <div>
                  <h1 className="shop-name">VSKK</h1>
                  <p className="shop-subtitle">Vaibhav Swarn Kala Kendra</p>
                  <p className="invoice-label">INVOICE</p>
                </div>
                <div className="invoice-meta">
                  <p><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber}</p>
                  <p><strong>Date:</strong> {formatDate(selectedInvoice.createdAt)}</p>
                  <p><strong>Status:</strong> <span className={`status-badge ${(selectedInvoice.dueAmount <= 0 ? 'Paid' : selectedInvoice.status).toLowerCase()}`}>{selectedInvoice.dueAmount <= 0 ? 'Paid' : selectedInvoice.status}</span></p>
                </div>
              </div>

              <div className="invoice-customer-section">
                <div>
                  <h3>Bill To:</h3>
                  <p><strong>{selectedInvoice.customer?.name || 'N/A'}</strong></p>
                  <p>{selectedInvoice.customer?.phone || ''}</p>
                  {selectedInvoice.customer?.email && <p>{selectedInvoice.customer.email}</p>}
                  {selectedInvoice.customer?.address && (
                    <p>
                      {selectedInvoice.customer.address.street && `${selectedInvoice.customer.address.street}, `}
                      {selectedInvoice.customer.address.city && `${selectedInvoice.customer.address.city}, `}
                      {selectedInvoice.customer.address.state && `${selectedInvoice.customer.address.state}`}
                      {selectedInvoice.customer.address.pincode && ` - ${selectedInvoice.customer.address.pincode}`}
                    </p>
                  )}
                </div>
              </div>

              <div className="invoice-items-section">
                <table className="invoice-items-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Weight (g)</th>
                      <th>Rate</th>
                      <th>Making</th>
                      <th>Wastage</th>
                      <th>GST</th>
                      <th>Discount</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.product?.name || 'Product'}</td>
                        <td>{item.weight}</td>
                        <td>{formatCurrency(item.rate)}</td>
                        <td>{formatCurrency(item.makingCharge || 0)}</td>
                        <td>{formatCurrency(item.wastage || 0)}</td>
                        <td>{formatCurrency(item.gst || 0)}</td>
                        <td>{formatCurrency(item.discount || 0)}</td>
                        <td><strong>{formatCurrency(item.subtotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="invoice-totals-section">
                <div className="totals-grid">
                  <div className="total-row cart-total-row">
                    <span><strong>Total Cart Value:</strong></span>
                    <span><strong>{formatCurrency(selectedInvoice.subtotal)}</strong></span>
                  </div>
                  <div className="total-row">
                    <span>GST:</span>
                    <span>{formatCurrency(selectedInvoice.gst)}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="total-row">
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedInvoice.discount)}</span>
                    </div>
                  )}
                  <div className="total-row total-final">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(selectedInvoice.total)}</span>
                  </div>
                  <div className="total-row">
                    <span>Paid Amount:</span>
                    <span>{formatCurrency(selectedInvoice.paidAmount)}</span>
                  </div>
                  {selectedInvoice.dueAmount > 0 && (
                    <div className="total-row due-row">
                      <span>Due Amount:</span>
                      <span>{formatCurrency(selectedInvoice.dueAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="payment-info">
                  <p><strong>Payment Details:</strong></p>
                  <p><strong>Payment Mode:</strong> {selectedInvoice.paymentMode}</p>
                  {selectedInvoice.paymentDetails && (
                    <div className="payment-breakdown">
                      {selectedInvoice.paymentDetails.cash > 0 && (
                        <p>Cash: {formatCurrency(selectedInvoice.paymentDetails.cash)}</p>
                      )}
                      {selectedInvoice.paymentDetails.upi > 0 && (
                        <p>UPI: {formatCurrency(selectedInvoice.paymentDetails.upi)}</p>
                      )}
                      {selectedInvoice.paymentDetails.card > 0 && (
                        <p>Card: {formatCurrency(selectedInvoice.paymentDetails.card)}</p>
                      )}
                      <p><strong>Total Paid: {formatCurrency(selectedInvoice.paidAmount)}</strong></p>
                    </div>
                  )}
                </div>

                {selectedInvoice.goldRate && (
                  <div className="gold-rate-info">
                    <p><strong>Gold Rates (at time of sale):</strong></p>
                    {selectedInvoice.goldRate.rate24K && <p>24K: {formatCurrency(selectedInvoice.goldRate.rate24K)}/g</p>}
                    {selectedInvoice.goldRate.rate22K && <p>22K: {formatCurrency(selectedInvoice.goldRate.rate22K)}/g</p>}
                    {selectedInvoice.goldRate.rate18K && <p>18K: {formatCurrency(selectedInvoice.goldRate.rate18K)}/g</p>}
                  </div>
                )}
              </div>

              {selectedInvoice.notes && (
                <div className="invoice-notes">
                  <p><strong>Notes:</strong> {selectedInvoice.notes}</p>
                </div>
              )}

              {selectedInvoice.dueAmount > 0 && (
                <div className="invoice-payment-action">
                  <button 
                    className="btn-add-payment"
                    onClick={() => {
                      setPaymentAmount('');
                      setPaymentMode('Cash');
                      setShowPaymentModal(true);
                    }}
                  >
                    <FiDollarSign /> Add Payment ({formatCurrency(selectedInvoice.dueAmount)} Due)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice View */}
      {selectedInvoice && (
        <div ref={printRef} className="invoice-print-view" style={{ display: 'none' }}>
          <div className="print-invoice-header">
            <h1>VSKK</h1>
            <p className="shop-subtitle">Vaibhav Swarn Kala Kendra</p>
            <p>INVOICE</p>
          </div>
          <div className="print-invoice-info">
            <div>
              <p><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber}</p>
              <p><strong>Date:</strong> {formatDate(selectedInvoice.createdAt)}</p>
            </div>
            <div>
              <p><strong>Bill To:</strong></p>
              <p>{selectedInvoice.customer?.name || 'N/A'}</p>
              <p>{selectedInvoice.customer?.phone || ''}</p>
            </div>
          </div>
          <table className="print-invoice-table">
            <thead>
              <tr>
                <th>SN</th>
                <th>Description</th>
                <th>HUID</th>
                <th>HSN/SAC</th>
                <th>Weight (g)</th>
                <th>Purity</th>
                <th>Rate</th>
                <th>Making</th>
                <th>Wastage</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    {item.product?.name || 'Product'}
                    <br />
                    <small>{item.product?.category}</small>
                  </td>
                  <td>{item.product?.huid || '-'}</td>
                  <td>{item.product?.hsnCode || '7113'}</td>
                  <td>{item.weight}</td>
                  <td>{item.product?.purity || '22K'}</td>
                  <td>{formatCurrency(item.rate)}</td>
                  <td>{formatCurrency(item.makingCharge || 0)}</td>
                  <td>{formatCurrency(item.wastage || 0)}</td>
                  <td>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="print-invoice-totals">
            <p><strong>Total Cart Value: {formatCurrency(selectedInvoice.subtotal)}</strong></p>
            <p>GST: {formatCurrency(selectedInvoice.gst)}</p>
            {selectedInvoice.discount > 0 && <p>Discount: -{formatCurrency(selectedInvoice.discount)}</p>}
            <p className="total">Total: {formatCurrency(selectedInvoice.total)}</p>
            <div className="print-payment-details">
              <p><strong>Payment Details:</strong></p>
              <p>Payment Mode: {selectedInvoice.paymentMode}</p>
              {selectedInvoice.paymentDetails && (
                <>
                  {selectedInvoice.paymentDetails.cash > 0 && <p>Cash: {formatCurrency(selectedInvoice.paymentDetails.cash)}</p>}
                  {selectedInvoice.paymentDetails.upi > 0 && <p>UPI: {formatCurrency(selectedInvoice.paymentDetails.upi)}</p>}
                  {selectedInvoice.paymentDetails.card > 0 && <p>Card: {formatCurrency(selectedInvoice.paymentDetails.card)}</p>}
                </>
              )}
              <p><strong>Total Paid: {formatCurrency(selectedInvoice.paidAmount)}</strong></p>
            </div>
            {selectedInvoice.dueAmount > 0 && <p>Due: {formatCurrency(selectedInvoice.dueAmount)}</p>}
          </div>
        </div>
      )}

      {printBatch.length > 0 && (
        <div ref={batchPrintRef} className="invoice-print-batch" style={{ display: 'none' }}>
          {printBatch.map((inv, idx) => (
            <div key={inv._id} className="invoice-print-item">
              <div className="print-invoice-header">
                <h1>VSKK</h1>
                <p className="shop-subtitle">Vaibhav Swarn Kala Kendra</p>
                <p>INVOICE</p>
              </div>
              <div className="print-invoice-info">
                <div>
                  <p><strong>Invoice #:</strong> {inv.invoiceNumber}</p>
                  <p><strong>Date:</strong> {formatDate(inv.createdAt)}</p>
                </div>
                <div>
                  <p><strong>Bill To:</strong></p>
                  <p>{inv.customer?.name || 'N/A'}</p>
                  <p>{inv.customer?.phone || ''}</p>
                </div>
              </div>
              <table className="print-invoice-table">
                <thead>
                  <tr>
                    <th>SN</th>
                    <th>Description</th>
                    <th>HUID</th>
                    <th>HSN/SAC</th>
                    <th>Weight (g)</th>
                    <th>Purity</th>
                    <th>Rate</th>
                    <th>Making</th>
                    <th>Wastage</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(inv.items || []).map((item, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>
                        {item.product?.name || 'Product'}
                        <br />
                        <small>{item.product?.category}</small>
                      </td>
                      <td>{item.product?.huid || '-'}</td>
                      <td>{item.product?.hsnCode || '7113'}</td>
                      <td>{item.weight}</td>
                      <td>{item.product?.purity || '22K'}</td>
                      <td>{formatCurrency(item.rate)}</td>
                      <td>{formatCurrency(item.makingCharge || 0)}</td>
                      <td>{formatCurrency(item.wastage || 0)}</td>
                      <td>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="print-invoice-totals">
                <p><strong>Total Cart Value: {formatCurrency(inv.subtotal)}</strong></p>
                <p>GST: {formatCurrency(inv.gst)}</p>
                {inv.discount > 0 && <p>Discount: -{formatCurrency(inv.discount)}</p>}
                <p className="total">Total: {formatCurrency(inv.total)}</p>
                <div className="print-payment-details">
                  <p><strong>Payment Details:</strong></p>
                  <p>Payment Mode: {inv.paymentMode}</p>
                  {inv.paymentDetails && (
                    <>
                      {inv.paymentDetails.cash > 0 && <p>Cash: {formatCurrency(inv.paymentDetails.cash)}</p>}
                      {inv.paymentDetails.upi > 0 && <p>UPI: {formatCurrency(inv.paymentDetails.upi)}</p>}
                      {inv.paymentDetails.card > 0 && <p>Card: {formatCurrency(inv.paymentDetails.card)}</p>}
                    </>
                  )}
                  <p><strong>Total Paid: {formatCurrency(inv.paidAmount)}</strong></p>
                </div>
                {inv.dueAmount > 0 && <p>Due: {formatCurrency(inv.dueAmount)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => { setShowPaymentModal(false); setPaymentAmount(''); setPaymentMode('Cash'); }}>
          <div className="modal-content payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Payment</h2>
              <button className="modal-close" onClick={() => { setShowPaymentModal(false); setPaymentAmount(''); setPaymentMode('Cash'); }}>
                <FiX />
              </button>
            </div>
            
            <div className="payment-modal-content">
              <div className="invoice-payment-info">
                <p><strong>Invoice:</strong> {selectedInvoice.invoiceNumber}</p>
                <p><strong>Customer:</strong> {selectedInvoice.customer?.name}</p>
                <p><strong>Total Amount:</strong> {formatCurrency(selectedInvoice.total)}</p>
                <p><strong>Already Paid:</strong> {formatCurrency(selectedInvoice.paidAmount)}</p>
                <p><strong>Due Amount:</strong> <span className="due-amount">{formatCurrency(selectedInvoice.dueAmount)}</span></p>
              </div>

              <div className="form-group">
                <label>Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Max: ${formatCurrency(selectedInvoice.dueAmount)}`}
                  max={selectedInvoice.dueAmount}
                  required
                />
                <small>Maximum: {formatCurrency(selectedInvoice.dueAmount)}</small>
              </div>

              <div className="form-group">
                <label>Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="payment-preview">
                  <p><strong>After Payment:</strong></p>
                  <p>New Paid Amount: {formatCurrency(selectedInvoice.paidAmount + parseFloat(paymentAmount || 0))}</p>
                  <p>Remaining Due: {formatCurrency(Math.max(0, selectedInvoice.dueAmount - parseFloat(paymentAmount || 0)))}</p>
                  {parseFloat(paymentAmount) >= selectedInvoice.dueAmount && (
                    <p className="will-clear">✓ Invoice will be fully paid</p>
                  )}
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => { setShowPaymentModal(false); setPaymentAmount(''); setPaymentMode('Cash'); }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleAddPayment}
                  disabled={isAddingPayment}
                >
                  <FiDollarSign /> {isAddingPayment ? 'Processing…' : 'Add Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
