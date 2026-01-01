import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiDollarSign, FiPackage, FiAlertTriangle, FiX, FiPrinter, FiEdit } from 'react-icons/fi';
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
  const [previewImage, setPreviewImage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);

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
    if (isPaying) return;
    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const confirmed = window.confirm(`Add payment of ₹${amt.toLocaleString()} via ${paymentMethod}?`);
    if (!confirmed) return;
    try {
      setIsPaying(true);
      await api.post(`/api/orders/${id}/pay`, {
        amount: amt,
        method: paymentMethod,
        notes: paymentNotes
      });
      toast.success('Payment added successfully');
      setShowPaymentModal(false);
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add payment');
    } finally {
      setIsPaying(false);
    }
  };

  const handleDeliver = async () => {
    if (isDelivering) return;
    setIsDelivering(true);
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
    } finally {
      setIsDelivering(false);
    }
  };
  const handleGenerateInvoice = async () => {
    try {
      const response = await api.post(`/api/orders/${id}/deliver`, {});
      toast.success('Invoice generated from order');
      if (response.data?.invoice?._id) {
        navigate('/invoices');
      } else {
        navigate('/invoices');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate invoice');
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
  const resolveImageUrl = (item) => {
    const candidate = item.image || item.designImage;
    if (!candidate) return null;
    return String(candidate).startsWith('/') ? `https://invent-backend-rjbf.onrender.com${candidate}` : candidate;
  };
  const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const advancePaid = order.payments.filter(p => p.type === 'ADVANCE').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const paidSince = Math.max(0, totalPaid - advancePaid);
  const openEditItem = (item) => {
    setEditingItem({
      id: item._id || item.id,
      isCustom: !!item.isCustom,
      name: item.name || '',
      quantity: item.quantity,
      price: item.price,
      weight: item.weight || '',
      targetWeight: item.targetWeight || '',
      size: item.size || '',
      itemType: item.itemType || '',
      specialInstructions: item.specialInstructions || '',
      designImage: item.designImage || '',
      purchaseRate: item.purchaseRate ?? '',
      makingCharge: item.makingCharge ?? '',
      wastage: item.wastage ?? '',
      discount: item.discount ?? '',
      oldGoldAdjustment: item.oldGoldAdjustment ?? '',
      otherCost: item.otherCost ?? '',
      recalculate: false,
      manualRate: item.manualRate ?? ''
    });
    setShowEditModal(true);
  };
  const applyEditItem = async () => {
    if (!editingItem || isSavingItem) return;
    try {
      setIsSavingItem(true);
      const payload = {
        quantity: Number(editingItem.quantity),
        price: Number(editingItem.price),
        weight: editingItem.weight !== '' ? Number(editingItem.weight) : undefined,
        recalculate: !!editingItem.recalculate,
        manualRate: editingItem.manualRate !== '' ? Number(editingItem.manualRate) : undefined,
        purchaseRate: editingItem.purchaseRate !== '' ? Number(editingItem.purchaseRate) : undefined,
        makingCharge: editingItem.makingCharge !== '' ? Number(editingItem.makingCharge) : undefined,
        wastage: editingItem.wastage !== '' ? Number(editingItem.wastage) : undefined,
        discount: editingItem.discount !== '' ? Number(editingItem.discount) : undefined,
        oldGoldAdjustment: editingItem.oldGoldAdjustment !== '' ? Number(editingItem.oldGoldAdjustment) : undefined,
        otherCost: editingItem.otherCost !== '' ? Number(editingItem.otherCost) : undefined
      };
      if (editingItem.isCustom) {
        payload.name = editingItem.name;
        payload.targetWeight = editingItem.targetWeight;
        payload.size = editingItem.size;
        payload.itemType = editingItem.itemType;
        payload.specialInstructions = editingItem.specialInstructions;
        payload.designImage = editingItem.designImage;
      }
      await api.patch(`/api/orders/${order._id}/items/${editingItem.id}`, payload);
      toast.success('Item updated');
      setShowEditModal(false);
      setEditingItem(null);
      fetchOrder();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update item');
    } finally {
      setIsSavingItem(false);
    }
  };

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
           {order.orderStatus === 'DELIVERED' ? (
             <button className="btn btn-primary" onClick={() => navigate('/invoices')}>
                 <FiPackage /> View Invoice
             </button>
           ) : (
             <button className="btn btn-primary" onClick={handleGenerateInvoice}>
                 <FiPackage /> Generate Invoice
             </button>
           )}
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {resolveImageUrl(item) && (
                                        <img
                                          src={resolveImageUrl(item)}
                                          alt={item.name}
                                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)', cursor: 'zoom-in' }}
                                          onClick={() => setPreviewImage(resolveImageUrl(item))}
                                        />
                                      )}
                                      <span style={{ fontWeight: '500' }}>{item.name}</span>
                                      {order.orderStatus !== 'DELIVERED' && order.orderStatus !== 'CANCELLED' && (
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '4px 8px' }} 
                                          onClick={() => openEditItem(item)}
                                          title="Edit item"
                                        >
                                          <FiEdit /> Edit
                                        </button>
                                      )}
                                  </div>
                              </td>
                              <td>
                                  {item.isCustom ? (
                                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                          {item.targetWeight && <div>Target Wt: {item.targetWeight}</div>}
                                          {item.size && <div>Size: {item.size}</div>}
                                          {item.itemType && <div>Type: {item.itemType}</div>}
                                          {item.specialInstructions && <div style={{ fontStyle: 'italic' }}>Note: {item.specialInstructions}</div>}
                                          {((item.manualRate > 0) || (item.appliedRate > 0) || item.makingCharge > 0 || item.wastage > 0 || item.discount > 0 || item.oldGoldAdjustment > 0 || item.otherCost > 0) && (
                                            <div style={{ marginTop: 6 }}>
                                              {(item.manualRate > 0 || item.appliedRate > 0) && <div>Rate: ₹{(item.manualRate > 0 ? item.manualRate : item.appliedRate)}/g</div>}
                                              {item.makingCharge > 0 && <div>Making: ₹{item.makingCharge}</div>}
                                              {item.wastage > 0 && <div>Wastage: ₹{item.wastage}</div>}
                                              {item.discount > 0 && <div>Discount: -₹{item.discount}</div>}
                                              {item.oldGoldAdjustment > 0 && <div>Old Gold: -₹{item.oldGoldAdjustment}</div>}
                                              {item.otherCost > 0 && <div>Other: ₹{item.otherCost}</div>}
                                            </div>
                                          )}
                                      </div>
                                  ) : (
                                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                          SKU: {item.sku}<br/>
                                          {item.purity && <span>{item.purity} | </span>}
                                          {item.weight && <span>{item.weight}g</span>}
                                          {((item.manualRate > 0) || (item.appliedRate > 0) || item.makingCharge > 0 || item.wastage > 0 || item.discount > 0 || item.oldGoldAdjustment > 0 || item.otherCost > 0) && (
                                            <div style={{ marginTop: 6 }}>
                                              {(item.manualRate > 0 || item.appliedRate > 0) && <div>Rate: ₹{(item.manualRate > 0 ? item.manualRate : item.appliedRate)}/g</div>}
                                              {item.makingCharge > 0 && <div>Making: ₹{item.makingCharge}</div>}
                                              {item.wastage > 0 && <div>Wastage: ₹{item.wastage}</div>}
                                              {item.discount > 0 && <div>Discount: -₹{item.discount}</div>}
                                              {item.oldGoldAdjustment > 0 && <div>Old Gold: -₹{item.oldGoldAdjustment}</div>}
                                              {item.otherCost > 0 && <div>Other: ₹{item.otherCost}</div>}
                                            </div>
                                          )}
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
                    <span className="info-value" style={{ color: 'var(--success)' }}>- ₹{advancePaid.toLocaleString()}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Paid Since</span>
                    <span className="info-value" style={{ color: 'var(--success)' }}>
                        - ₹{paidSince.toLocaleString()}
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
                    <button className="btn btn-primary" onClick={handleAddPayment} disabled={isPaying}>
                      {isPaying ? 'Processing...' : 'Save Payment'}
                    </button>
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
                    <button className="btn btn-success" onClick={handleDeliver} disabled={isDelivering}>{isDelivering ? 'Processing…' : 'Confirm Delivery'}</button>
                </div>
            </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Image Preview</h3>
              <button onClick={() => setPreviewImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <FiX size={20} />
              </button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <img
                src={previewImage}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 6, border: '1px solid var(--border-color)' }}
                onClick={() => window.open(previewImage, '_blank')}
              />
            </div>
            <div className="modal-footer">
              <a className="btn btn-secondary" href={previewImage} target="_blank" rel="noopener noreferrer">Open in new tab</a>
              <button className="btn btn-primary" onClick={() => setPreviewImage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingItem(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem.isCustom ? 'Edit Custom Item' : 'Edit Item'}</h3>
              <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <FiX size={20} />
              </button>
            </div>
            {editingItem.isCustom ? (
              <div>
                <div className="form-group">
                  <label>Item Name</label>
                  <input type="text" className="form-control" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Weight (g)</label>
                    <input type="number" className="form-control" value={editingItem.weight} onChange={e => setEditingItem({ ...editingItem, weight: e.target.value })} step="0.001" min="0" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Target Weight</label>
                    <input type="text" className="form-control" value={editingItem.targetWeight} onChange={e => setEditingItem({ ...editingItem, targetWeight: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Size</label>
                    <input type="text" className="form-control" value={editingItem.size} onChange={e => setEditingItem({ ...editingItem, size: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Type</label>
                    <input type="text" className="form-control" value={editingItem.itemType} onChange={e => setEditingItem({ ...editingItem, itemType: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Quantity</label>
                    <input type="number" className="form-control" value={editingItem.quantity} onChange={e => setEditingItem({ ...editingItem, quantity: e.target.value })} min="1" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Price</label>
                    <input type="number" className="form-control" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Design Image URL</label>
                    <input type="text" className="form-control" value={editingItem.designImage} onChange={e => setEditingItem({ ...editingItem, designImage: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Auto Recalculate</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" checked={editingItem.recalculate} onChange={e => setEditingItem({ ...editingItem, recalculate: e.target.checked })} />
                    <span style={{ color: 'var(--text-secondary)' }}>Uses latest gold rate (or manual)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Manual Rate (₹/g)</label>
                    <input type="number" className="form-control" value={editingItem.manualRate} onChange={e => setEditingItem({ ...editingItem, manualRate: e.target.value })} step="0.01" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Instructions</label>
                  <textarea className="form-control" rows="2" value={editingItem.specialInstructions} onChange={e => setEditingItem({ ...editingItem, specialInstructions: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Purchase Rate (₹/g)</label>
                    <input type="number" className="form-control" value={editingItem.purchaseRate} onChange={e => setEditingItem({ ...editingItem, purchaseRate: e.target.value })} step="0.01" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Making Charge (₹)</label>
                    <input type="number" className="form-control" value={editingItem.makingCharge} onChange={e => setEditingItem({ ...editingItem, makingCharge: e.target.value })} step="1" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Wastage (₹)</label>
                    <input type="number" className="form-control" value={editingItem.wastage} onChange={e => setEditingItem({ ...editingItem, wastage: e.target.value })} step="1" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Discount (₹)</label>
                    <input type="number" className="form-control" value={editingItem.discount} onChange={e => setEditingItem({ ...editingItem, discount: e.target.value })} step="1" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Old Gold Adjustment (₹)</label>
                    <input type="number" className="form-control" value={editingItem.oldGoldAdjustment} onChange={e => setEditingItem({ ...editingItem, oldGoldAdjustment: e.target.value })} step="1" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Other Cost (₹)</label>
                    <input type="number" className="form-control" value={editingItem.otherCost} onChange={e => setEditingItem({ ...editingItem, otherCost: e.target.value })} step="1" />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Weight (g)</label>
                    <input type="number" className="form-control" value={editingItem.weight} onChange={e => setEditingItem({ ...editingItem, weight: e.target.value })} step="0.001" min="0" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Quantity</label>
                    <input type="number" className="form-control" value={editingItem.quantity} onChange={e => setEditingItem({ ...editingItem, quantity: e.target.value })} min="1" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Price</label>
                    <input type="number" className="form-control" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Auto Recalculate</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={editingItem.recalculate} onChange={e => setEditingItem({ ...editingItem, recalculate: e.target.checked })} />
                      <span style={{ color: 'var(--text-secondary)' }}>Uses latest gold rate (or manual)</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Manual Rate (₹/g)</label>
                    <input type="number" className="form-control" value={editingItem.manualRate} onChange={e => setEditingItem({ ...editingItem, manualRate: e.target.value })} step="0.01" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Purchase Rate (₹/g)</label>
                    <input type="number" className="form-control" value={editingItem.purchaseRate} onChange={e => setEditingItem({ ...editingItem, purchaseRate: e.target.value })} step="0.01" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Making Charge (₹)</label>
                    <input type="number" className="form-control" value={editingItem.makingCharge} onChange={e => setEditingItem({ ...editingItem, makingCharge: e.target.value })} step="1" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Wastage (₹)</label>
                    <input type="number" className="form-control" value={editingItem.wastage} onChange={e => setEditingItem({ ...editingItem, wastage: e.target.value })} step="1" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Discount (₹)</label>
                    <input type="number" className="form-control" value={editingItem.discount} onChange={e => setEditingItem({ ...editingItem, discount: e.target.value })} step="1" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Old Gold Adjustment (₹)</label>
                    <input type="number" className="form-control" value={editingItem.oldGoldAdjustment} onChange={e => setEditingItem({ ...editingItem, oldGoldAdjustment: e.target.value })} step="1" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Other Cost (₹)</label>
                    <input type="number" className="form-control" value={editingItem.otherCost} onChange={e => setEditingItem({ ...editingItem, otherCost: e.target.value })} step="1" />
                  </div>
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingItem(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={applyEditItem} disabled={isSavingItem}>
                {isSavingItem ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
