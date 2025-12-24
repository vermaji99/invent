import React, { useState, useEffect, useRef } from 'react';
import { FiEye, FiDownload, FiX, FiPrinter, FiDollarSign } from 'react-icons/fi';
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

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await api.get('/api/invoices');
      setInvoices(response.data);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const response = await api.get(`/api/invoices/${invoiceId}`);
      setSelectedInvoice(response.data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load invoice details');
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      const response = await api.get(`/api/invoices/${invoice._id}`);
      setSelectedInvoice(response.data);
      
      // Wait for state to update, then trigger print
      setTimeout(() => {
        window.print();
      }, 100);
    } catch (error) {
      toast.error('Failed to load invoice for download');
    }
  };

  const handleAddPayment = async () => {
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

      {loading ? (
        <div className="loading">Loading invoices...</div>
      ) : (
        <div className="invoices-table-container">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-data">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice._id}>
                    <td className="invoice-number">{invoice.invoiceNumber}</td>
                    <td>{invoice.customer?.name || 'N/A'}</td>
                    <td>{formatDate(invoice.createdAt)}</td>
                    <td>{formatCurrency(invoice.total)}</td>
                    <td>{formatCurrency(invoice.paidAmount)}</td>
                    <td className={invoice.dueAmount > 0 ? 'due' : ''}>
                      {formatCurrency(invoice.dueAmount)}
                    </td>
                    <td>
                      <span className={`status-badge ${(invoice.dueAmount <= 0 ? 'Paid' : invoice.status).toLowerCase()}`}>
                        {invoice.dueAmount <= 0 ? 'Paid' : invoice.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {invoice.dueAmount > 0 && (
                          <button 
                            className="btn-icon btn-payment" 
                            title="Add Payment"
                            onClick={() => {
                              handleViewInvoice(invoice._id);
                              setShowPaymentModal(true);
                            }}
                          >
                            <FiDollarSign />
                          </button>
                        )}
                        <button 
                          className="btn-icon" 
                          title="View Invoice"
                          onClick={() => handleViewInvoice(invoice._id)}
                        >
                          <FiEye />
                        </button>
                        <button 
                          className="btn-icon" 
                          title="Download/Print Invoice"
                          onClick={() => handleDownloadInvoice(invoice)}
                        >
                          <FiDownload />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                  <h1 className="shop-name">JEWELLERY SHOP</h1>
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
            <h1>JEWELLERY SHOP</h1>
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
                <th>Item</th>
                <th>HUID</th>
                <th>Weight</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.product?.name || 'Product'}</td>
                  <td>{item.product?.huid || '-'}</td>
                  <td>{item.weight}g</td>
                  <td>{formatCurrency(item.rate)}</td>
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
                >
                  <FiDollarSign /> Add Payment
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
