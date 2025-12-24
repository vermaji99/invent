import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiDollarSign, FiPackage, FiAlertTriangle, FiX, FiPrinter } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './OrderDetail.css';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  
  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/orders/${id}`);
      setOrder(response.data);
      // Pre-fill payment amount with remaining balance
      if (response.data.remainingAmount > 0) {
        setPaymentAmount(response.data.remainingAmount);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load order details');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    try {
      await api.post(`/api/orders/${id}/pay`, {
        amount: Number(paymentAmount),
        method: paymentMethod,
        notes: paymentNotes
      });
      toast.success('Payment added successfully');
      setShowPaymentModal(false);
      fetchOrder();
    } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to add payment');
    }
  };

  const handleDeliver = async () => {
    try {
      // If balance > 0 and user wants to pay now
      const payload = {};
      if (order.remainingAmount > 0 && paymentAmount > 0) {
          payload.finalPayment = {
              amount: Number(paymentAmount),
              method: paymentMethod
          };
      }

      const response = await api.post(`/api/orders/${id}/deliver`, payload);
      toast.success('Order delivered and inventory updated');
      setShowDeliverModal(false);
      fetchOrder();
      
      // Optionally redirect to invoice or show invoice details
      if (response.data.invoice) {
          // toast.info(`Invoice ${response.data.invoice.invoiceNumber} generated`);
      }
    } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to deliver order');
    }
  };

  const handleStatusUpdate = async (newStatus) => {
      try {
          await api.patch(`/api/orders/${id}/status`, { status: newStatus });
          toast.success(`Status updated to ${newStatus}`);
          fetchOrder();
      } catch (error) {
          toast.error('Failed to update status');
      }
  };

  const handlePrint = () => {
      window.print();
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!order) return null;

  const isOverdue = new Date(order.expectedDeliveryDate) < new Date() && order.orderStatus !== 'DELIVERED';
  const isNearDue = !isOverdue && new Date(order.expectedDeliveryDate) < new Date(Date.now() + 24 * 60 * 60 * 1000) && order.orderStatus !== 'DELIVERED';

  return (
    <div className="order-detail-container">
      <div className="order-header">
        <div className="order-title">
          <h2>
             Order #{order.orderNumber}
             <span className={`status-badge status-${order.orderStatus.toLowerCase()}`} style={{ fontSize: '0.9rem', marginLeft: '10px' }}>
                {order.orderStatus.replace('_', ' ')}
             </span>
          </h2>
          <div className="order-meta">
            Created on {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}
          </div>
        </div>
        <div className="order-actions">
           <button className="btn btn-secondary" onClick={handlePrint}>
               <FiPrinter /> Print Order
           </button>
           {order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'CANCELLED' && (
             <>
                <button className="btn btn-secondary" onClick={() => handleStatusUpdate('READY')}>Mark Ready</button>
                {order.remainingAmount > 0 && (
                    <button className="btn btn-primary" onClick={() => {
                        setPaymentAmount(order.remainingAmount);
                        setShowPaymentModal(true);
                    }}>
                        <FiDollarSign /> Add Payment
                    </button>
                )}
                <button className="btn btn-success" onClick={() => {
                     setPaymentAmount(order.remainingAmount); // Default to clearing balance
                     setShowDeliverModal(true);
                }}>
                    <FiCheckCircle /> Deliver
                </button>
                <button className="btn btn-danger" onClick={() => {
                    if(window.confirm('Are you sure you want to cancel this order?')) {
                        handleStatusUpdate('CANCELLED');
                    }
                }}>Cancel</button>
             </>
           )}
        </div>
      </div>

      {isOverdue && (
        <div className="alert-banner alert-danger">
            <FiAlertTriangle />
            <strong>Overdue!</strong> This order was expected on {new Date(order.expectedDeliveryDate).toLocaleDateString()}.
        </div>
      )}

      {isNearDue && (
        <div className="alert-banner alert-warning">
            <FiClock />
            <strong>Due Soon!</strong> Expected delivery is tomorrow/today.
        </div>
      )}

      <div className="detail-grid">
        <div className="left-column">
           <div className="detail-card">
              <div className="card-title">Order Items</div>
              <table className="items-table">
                  <thead>
                      <tr>
                          <th>Product</th>
                          <th>Details</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Total</th>
                      </tr>
                  </thead>
                  <tbody>
                      {order.items.map((item, idx) => (
                          <tr key={idx}>
                              <td>
                                  <div style={{ fontWeight: '500' }}>{item.name}</div>
                                  {item.isCustom && <span style={{ fontSize: '0.8rem', color: 'var(--gold-primary)', border: '1px solid var(--gold-primary)', padding: '2px 4px', borderRadius: '4px' }}>Custom</span>}
                              </td>
                              <td>
                                  {item.isCustom ? (
                                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                          {item.targetWeight && <div>Target Wt: {item.targetWeight}</div>}
                                          {item.size && <div>Size: {item.size}</div>}
                                          {item.itemType && <div>Type: {item.itemType}</div>}
                                          {item.specialInstructions && <div style={{ fontStyle: 'italic' }}>Note: {item.specialInstructions}</div>}
                                      </div>
                                  ) : (
                                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                          SKU: {item.sku}<br/>
                                          {item.purity && <span>{item.purity} | </span>}
                                          {item.weight && <span>{item.weight}g</span>}
                                      </div>
                                  )}
                              </td>
                              <td>{item.quantity}</td>
                              <td>₹{item.price.toLocaleString()}</td>
                              <td>₹{(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>

           <div className="detail-card">
              <div className="card-title">Payment History</div>
              {order.payments.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No payments recorded.</p>
              ) : (
                  order.payments.map((payment, idx) => (
                      <div key={idx} className="payment-history-item">
                          <div>
                              <strong>{payment.type}</strong> ({payment.method})
                              {payment.notes && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{payment.notes}</div>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 'bold', color: 'var(--success)' }}>₹{payment.amount.toLocaleString()}</div>
                              <div className="payment-date">{new Date(payment.date).toLocaleDateString()}</div>
                          </div>
                      </div>
                  ))
              )}
           </div>
        </div>

        <div className="right-column">
            <div className="detail-card">
                <div className="card-title">Customer Details</div>
                <div className="info-row">
                    <span className="info-label">Name</span>
                    <span className="info-value">{order.customerDetails.name}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Phone</span>
                    <span className="info-value">{order.customerDetails.phone}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Email</span>
                    <span className="info-value">{order.customerDetails.email || '-'}</span>
                </div>
            </div>

            <div className="detail-card">
                <div className="card-title">Order Summary</div>
                <div className="info-row">
                    <span className="info-label">Total Amount</span>
                    <span className="info-value">₹{order.totalAmount.toLocaleString()}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Advance Paid</span>
                    <span className="info-value" style={{ color: 'var(--success)' }}>- ₹{order.advanceAmount.toLocaleString()}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Paid Since</span>
                    <span className="info-value" style={{ color: 'var(--success)' }}>
                        - ₹{(order.totalAmount - order.remainingAmount - order.advanceAmount).toLocaleString()}
                    </span>
                </div>
                <div className="info-row" style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <span className="info-label" style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Balance Due</span>
                    <span className="info-value" style={{ fontWeight: 'bold', color: order.remainingAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        ₹{order.remainingAmount.toLocaleString()}
                    </span>
                </div>
            </div>
            
            <div className="detail-card">
                <div className="card-title">Delivery Info</div>
                <div className="info-row">
                    <span className="info-label">Expected</span>
                    <span className="info-value">{new Date(order.expectedDeliveryDate).toLocaleDateString()}</span>
                </div>
                {order.actualDeliveryDate && (
                    <div className="info-row">
                        <span className="info-label">Delivered On</span>
                        <span className="info-value">{new Date(order.actualDeliveryDate).toLocaleDateString()}</span>
                    </div>
                )}
                <div className="info-row">
                     <span className="info-label">Status</span>
                     <span className={`status-badge status-${order.orderStatus.toLowerCase()}`}>{order.orderStatus}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Add Payment</h3>
                    <button onClick={() => setShowPaymentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}><FiX size={20}/></button>
                </div>
                <div className="form-group">
                    <label>Amount</label>
                    <input 
                        type="number" 
                        className="form-control"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label>Method</label>
                    <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">Card</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Notes</label>
                    <input 
                        type="text" 
                        className="form-control"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleAddPayment}>Save Payment</button>
                </div>
            </div>
        </div>
      )}

      {/* Deliver Modal */}
      {showDeliverModal && (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Deliver Order</h3>
                    <button onClick={() => setShowDeliverModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}><FiX size={20}/></button>
                </div>
                <p>Confirm delivery of this order? Inventory will be reduced.</p>
                
                {order.remainingAmount > 0 && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
                        <strong style={{ color: 'var(--warning)' }}>Balance Due: ₹{order.remainingAmount}</strong>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Collect remaining payment now?</p>
                    </div>
                )}

                {order.remainingAmount > 0 && (
                    <>
                         <div className="form-group">
                            <label>Payment Amount (leave 0 to deliver with due)</label>
                            <input 
                                type="number" 
                                className="form-control"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Payment Method</label>
                            <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="CARD">Card</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                            </select>
                        </div>
                    </>
                )}

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={() => setShowDeliverModal(false)}>Cancel</button>
                    <button className="btn btn-success" onClick={handleDeliver}>Confirm Delivery</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default OrderDetail;
