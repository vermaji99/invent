import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiX } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Purchases.css';

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [formData, setFormData] = useState({
    supplier: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    paidAmount: 0,
    gst: 0,
    notes: ''
  });
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Gold',
    purity: '22K',
    weight: '',
    rate: '',
    quantity: 1,
    product: '',
    createProduct: false,
    sku: ''
  });

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/purchases');
      setPurchases(response.data);
    } catch (error) {
      toast.error('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/api/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      toast.error('Failed to load suppliers');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      // Silent fail - products are optional
    }
  };

  const addItem = () => {
    if (!newItem.name || !newItem.weight || !newItem.rate) {
      toast.error('Please fill all required fields');
      return;
    }

    const item = {
      ...newItem,
      weight: parseFloat(newItem.weight),
      rate: parseFloat(newItem.rate),
      quantity: parseInt(newItem.quantity) || 1,
      amount: parseFloat(newItem.weight) * parseFloat(newItem.rate) * (parseInt(newItem.quantity) || 1)
    };

    setItems([...items, item]);
    setNewItem({
      name: '',
      category: 'Gold',
      purity: '22K',
      weight: '',
      rate: '',
      quantity: 1,
      product: '',
      createProduct: false,
      sku: ''
    });
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.supplier) {
      toast.error('Please select a supplier');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    try {
      const purchaseData = {
        supplier: formData.supplier,
        items: items,
        gst: parseFloat(formData.gst) || 0,
        paymentMode: formData.paymentMode,
        paidAmount: parseFloat(formData.paidAmount) || 0,
        purchaseDate: formData.purchaseDate,
        notes: formData.notes
      };

      if (editingPurchase) {
        await api.put(`/api/purchases/${editingPurchase._id}`, purchaseData);
        toast.success('Purchase updated successfully');
      } else {
        await api.post('/api/purchases', purchaseData);
        toast.success('Purchase created successfully');
      }

      setShowModal(false);
      setEditingPurchase(null);
      resetForm();
      fetchPurchases();
      fetchProducts(); // Refresh products in case new ones were created
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const resetForm = () => {
    setFormData({
      supplier: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      paymentMode: 'Cash',
      paidAmount: 0,
      gst: 0,
      notes: ''
    });
    setItems([]);
    setNewItem({
      name: '',
      category: 'Gold',
      purity: '22K',
      weight: '',
      rate: '',
      quantity: 1,
      product: '',
      createProduct: false,
      sku: ''
    });
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const gst = parseFloat(formData.gst) || 0;
    const total = subtotal + gst;
    const paidAmount = parseFloat(formData.paidAmount) || 0;
    const dueAmount = total - paidAmount;

    return { subtotal, gst, total, paidAmount, dueAmount };
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

  const totals = calculateTotals();

  return (
    <div className="purchases-page">
      <div className="page-header">
        <div>
          <h1>Purchase Management</h1>
          <p>Manage purchases from suppliers</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); setEditingPurchase(null); }}>
          <FiPlus /> New Purchase
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading purchases...</div>
      ) : (
        <div className="purchases-list">
          {purchases.length === 0 ? (
            <div className="empty-state">
              <p>No purchases found. Create your first purchase.</p>
            </div>
          ) : (
            purchases.map((purchase) => (
              <div key={purchase._id} className="purchase-card">
                <div className="purchase-header">
                  <div>
                    <h3>{purchase.purchaseNumber}</h3>
                    <p>{purchase.supplier?.name}</p>
                    <p className="purchase-date">{formatDate(purchase.purchaseDate)}</p>
                  </div>
                  <div className="purchase-total">
                    {formatCurrency(purchase.total)}
                  </div>
                </div>
                <div className="purchase-details">
                  <div className="detail">
                    <span>Items:</span>
                    <span>{purchase.items.length}</span>
                  </div>
                  <div className="detail">
                    <span>Payment:</span>
                    <span>{purchase.paymentMode}</span>
                  </div>
                  <div className="detail">
                    <span>Paid:</span>
                    <span>{formatCurrency(purchase.paidAmount)}</span>
                  </div>
                  <div className="detail">
                    <span>Due:</span>
                    <span className={purchase.dueAmount > 0 ? 'due' : ''}>
                      {formatCurrency(purchase.dueAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingPurchase(null); resetForm(); }}>
          <div className="modal-content purchase-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPurchase ? 'Edit Purchase' : 'New Purchase'}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); setEditingPurchase(null); resetForm(); }}>
                <FiX />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Supplier *</label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    required
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(supplier => (
                      <option key={supplier._id} value={supplier._id}>
                        {supplier.name} - {supplier.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Purchase Date *</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="items-section">
                <h3>Items</h3>
                
                <div className="add-item-form">
                  <div className="form-row mb-4">
                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
                      <label style={{ marginBottom: 0 }}>Item Type:</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          checked={newItem.createProduct} 
                          onChange={() => setNewItem({...newItem, createProduct: true, product: '', name: ''})} 
                        /> 
                        New Product
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                          type="radio" 
                          checked={!newItem.createProduct} 
                          onChange={() => setNewItem({...newItem, createProduct: false, product: '', name: ''})} 
                        /> 
                        Existing Product (Restock)
                      </label>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Product {newItem.createProduct ? 'Name' : 'Selection'} *</label>
                      {newItem.createProduct ? (
                        <input
                          type="text"
                          value={newItem.name}
                          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                          placeholder="Enter product name"
                        />
                      ) : (
                        <select
                          value={newItem.product}
                          onChange={(e) => {
                            const prod = products.find(p => p._id === e.target.value);
                            if (prod) {
                              setNewItem({
                                ...newItem,
                                product: prod._id,
                                name: prod.name,
                                category: prod.category,
                                purity: prod.purity,
                                weight: '', // Allow user to enter weight of new batch
                                rate: '',
                                sku: prod.sku
                              });
                            } else {
                              setNewItem({ ...newItem, product: '' });
                            }
                          }}
                        >
                          <option value="">Select Product</option>
                          {products.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        disabled={!newItem.createProduct} // Disable if existing product
                      >
                        <option value="Gold">Gold</option>
                        <option value="Silver">Silver</option>
                        <option value="Diamond">Diamond</option>
                        <option value="Platinum">Platinum</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Purity *</label>
                      <select
                        value={newItem.purity}
                        onChange={(e) => setNewItem({ ...newItem, purity: e.target.value })}
                        disabled={!newItem.createProduct}
                      >
                        <option value="24K">24K</option>
                        <option value="22K">22K</option>
                        <option value="18K">18K</option>
                        <option value="925">925</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Weight (g/unit) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.weight}
                        onChange={(e) => setNewItem({ ...newItem, weight: e.target.value })}
                        placeholder="Weight in grams"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Rate (₹/g) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItem.rate}
                        onChange={(e) => setNewItem({ ...newItem, rate: e.target.value })}
                        placeholder="Rate per gram"
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantity *</label>
                      <input
                        type="number"
                        value={newItem.quantity}
                        onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={newItem.createProduct}
                        onChange={(e) => setNewItem({ ...newItem, createProduct: e.target.checked })}
                      />
                      Create Product in Inventory
                    </label>
                    {newItem.createProduct && (
                      <input
                        type="text"
                        value={newItem.sku}
                        onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                        placeholder="SKU (optional, auto-generated if empty)"
                        style={{ marginTop: '0.5rem' }}
                      />
                    )}
                  </div>

                  <button type="button" className="btn-add-item" onClick={addItem}>
                    <FiPlus /> Add Item
                  </button>
                </div>

                {items.length > 0 && (
                  <div className="items-list">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Weight</th>
                          <th>Rate</th>
                          <th>Qty</th>
                          <th>Amount</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.category}</td>
                            <td>{item.weight}g</td>
                            <td>{formatCurrency(item.rate)}</td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.amount)}</td>
                            <td>
                              <button type="button" onClick={() => removeItem(index)} className="btn-remove">
                                <FiTrash2 />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>GST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Payment Mode *</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    required
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
              </div>

              {formData.paymentMode !== 'Credit' && (
                <div className="form-group">
                  <label>Paid Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                  />
                </div>
              )}

              <div className="totals-display">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="total-row">
                  <span>GST:</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="total-row total-final">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
                <div className="total-row">
                  <span>Paid:</span>
                  <span>{formatCurrency(totals.paidAmount)}</span>
                </div>
                <div className="total-row">
                  <span>Due:</span>
                  <span className={totals.dueAmount > 0 ? 'due' : ''}>
                    {formatCurrency(totals.dueAmount)}
                  </span>
                </div>
              </div>

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
                <button type="button" onClick={() => { setShowModal(false); setEditingPurchase(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingPurchase ? 'Update' : 'Create'} Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
