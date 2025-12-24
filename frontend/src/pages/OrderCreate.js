import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiSearch, FiTrash2, FiPlus, FiMinus, FiX, FiUpload } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './OrderCreate.css';

const OrderCreate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Customer State
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Product State
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  
  // Cart State
  const [cart, setCart] = useState([]);
  
  // Custom Item State
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' or 'custom'
  const [customItem, setCustomItem] = useState({
    name: '',
    targetWeight: '',
    designImage: '',
    specialInstructions: '',
    price: '',
    quantity: 1,
    size: '',
    itemType: ''
  });
  
  // Order Details State
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Load Products on Mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter Products
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts(products);
    } else {
      const lower = productSearch.toLowerCase();
      setFilteredProducts(products.filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.sku?.toLowerCase().includes(lower) ||
        p.category.toLowerCase().includes(lower)
      ));
    }
  }, [productSearch, products]);

  // Search Customers
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (customerSearch.length >= 2) {
        fetchCustomers();
      } else {
        setCustomers([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearch]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
      setFilteredProducts(response.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load products');
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/api/customers', { params: { search: customerSearch } });
      setCustomers(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.product === product._id);
    if (existing) {
      setCart(cart.map(item => 
        item.product === product._id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product: product._id,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1,
        image: product.images?.[0]
      }]);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    setUploading(true);
    try {
      const response = await api.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setCustomItem(prev => ({ ...prev, designImage: response.data.url }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const addCustomItemToCart = () => {
    // Debug log to confirm function execution
    console.log('Adding custom item:', customItem);

    if (!customItem.name || !customItem.price || !customItem.quantity) {
       toast.error('Please fill required fields (Name, Price, Quantity)');
       return;
    }
    
    setCart([...cart, {
        isCustom: true,
        tempId: Date.now(),
        ...customItem,
        price: Number(customItem.price),
        quantity: Number(customItem.quantity)
    }]);
    
    setCustomItem({
        name: '',
        targetWeight: '',
        designImage: '',
        specialInstructions: '',
        price: '',
        quantity: 1,
        size: '',
        itemType: ''
    });
    
    toast.success('Custom item added');
  };

  const removeFromCart = (itemToRemove) => {
    if (itemToRemove.isCustom) {
        setCart(cart.filter(item => item.tempId !== itemToRemove.tempId));
    } else {
        setCart(cart.filter(item => item.product !== itemToRemove.product));
    }
  };

  const updateQuantity = (itemToUpdate, delta) => {
    setCart(cart.map(item => {
      const isMatch = item.isCustom 
          ? item.tempId === itemToUpdate.tempId 
          : item.product === itemToUpdate.product;

      if (isMatch) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const calculateTotal = () => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (cart.length === 0) {
      toast.error('Please add products to order');
      return;
    }
    if (!expectedDeliveryDate) {
      toast.error('Please select expected delivery date');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        customerId: selectedCustomer._id,
        items: cart,
        advanceAmount: Number(advanceAmount) || 0,
        expectedDeliveryDate,
        notes,
        paymentMethod
      };

      const response = await api.post('/api/orders', payload);
      toast.success('Order created successfully');
      navigate(`/orders/${response.data._id}`);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = calculateTotal();
  const balanceAmount = totalAmount - (Number(advanceAmount) || 0);

  return (
    <div className="order-create-container">
      <div className="left-panel">
        {/* Customer Selection */}
        <div className="card">
          <div className="section-title"><FiUser /> Customer Details</div>
          {selectedCustomer ? (
            <div className="selected-customer">
              <button className="remove-customer" onClick={() => setSelectedCustomer(null)}><FiX /></button>
              <strong>{selectedCustomer.name}</strong>
              <div>{selectedCustomer.phone}</div>
              <div>{selectedCustomer.email}</div>
            </div>
          ) : (
            <div>
              <input
                type="text"
                className="search-input"
                placeholder="Search customer by name or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customers.length > 0 && (
                <div className="search-results">
                  {customers.map(customer => (
                    <div 
                      key={customer._id} 
                      className="search-result-item"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomers([]);
                        setCustomerSearch('');
                      }}
                    >
                      <strong>{customer.name}</strong> - {customer.phone}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Product Selection */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="tabs-header" style={{ display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '1px solid var(--border-color)' }}>
             <button 
                className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} 
                onClick={() => setActiveTab('inventory')}
                style={{
                    padding: '10px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'inventory' ? '2px solid var(--gold-primary)' : 'none',
                    color: activeTab === 'inventory' ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
             >
                <FiSearch /> Inventory
             </button>
             <button 
                className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`} 
                onClick={() => setActiveTab('custom')}
                style={{
                    padding: '10px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === 'custom' ? '2px solid var(--gold-primary)' : 'none',
                    color: activeTab === 'custom' ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
             >
                <FiPlus /> Custom Design
             </button>
          </div>

          {activeTab === 'inventory' ? (
            <>
              <input
                type="text"
                className="search-input"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <div className="products-grid" style={{ overflowY: 'auto', flex: 1 }}>
                {filteredProducts.map(product => (
                  <div key={product._id} className="product-card" onClick={() => addToCart(product)}>
                    <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                    <div style={{ fontSize: '0.9rem', color: '#666' }}>{product.sku}</div>
                    <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#2e7d32' }}>
                      ₹{product.sellingPrice.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="custom-item-form" style={{ overflowY: 'auto', flex: 1, padding: '10px' }}>
                <div className="form-group">
                    <label>Item Name / Design Name *</label>
                    <input 
                        type="text" 
                        className="form-control" 
                        value={customItem.name}
                        onChange={e => setCustomItem({...customItem, name: e.target.value})}
                        placeholder="e.g. Custom Gold Necklace"
                    />
                </div>
                <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Target Weight (approx)</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={customItem.targetWeight}
                            onChange={e => setCustomItem({...customItem, targetWeight: e.target.value})}
                            placeholder="e.g. 10-12g"
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Size / Dimensions</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            value={customItem.size}
                            onChange={e => setCustomItem({...customItem, size: e.target.value})}
                            placeholder="e.g. 18 inch, Size 6"
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label>Design Image</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <input 
                                type="text" 
                                className="form-control" 
                                value={customItem.designImage}
                                onChange={e => setCustomItem({...customItem, designImage: e.target.value})}
                                placeholder="Image URL or Upload..."
                            />
                        </div>
                        <label className="btn-secondary" style={{ 
                            cursor: 'pointer', 
                            padding: '8px 12px', 
                            borderRadius: '4px', 
                            border: '1px solid var(--border-color)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '5px', 
                            marginBottom: 0,
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)'
                        }}>
                            <FiUpload />
                            {uploading ? 'Uploading...' : 'Upload'}
                            <input type="file" hidden onChange={handleImageUpload} accept="image/*" disabled={uploading} />
                        </label>
                    </div>
                    {customItem.designImage && (
                        <div style={{ marginTop: '10px', border: '1px solid var(--border-color)', padding: '5px', borderRadius: '4px', width: 'fit-content', background: 'var(--bg-tertiary)' }}>
                            <img src={customItem.designImage.startsWith('/') ? `http://localhost:5000${customItem.designImage}` : customItem.designImage} alt="Design Preview" style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} />
                        </div>
                    )}
                </div>
                <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
                     <div className="form-group" style={{ flex: 1 }}>
                        <label>Estimated Price *</label>
                        <input 
                            type="number" 
                            className="form-control" 
                            value={customItem.price}
                            onChange={e => setCustomItem({...customItem, price: e.target.value})}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Quantity *</label>
                        <input 
                            type="number" 
                            className="form-control" 
                            value={customItem.quantity}
                            onChange={e => setCustomItem({...customItem, quantity: e.target.value})}
                            min="1"
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label>Special Instructions / User Requirements</label>
                    <textarea 
                        className="form-control" 
                        rows="3"
                        value={customItem.specialInstructions}
                        onChange={e => setCustomItem({...customItem, specialInstructions: e.target.value})}
                        placeholder="Detailed requirements..."
                    />
                </div>
                <button className="btn-primary" style={{ width: '100%', marginTop: '10px' }} onClick={addCustomItemToCart}>
                    Add Custom Item
                </button>
            </div>
          )}
        </div>
      </div>

      <div className="right-panel">
        <div className="section-title">Order Summary</div>
        
        <div className="cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>
              No items in order
            </div>
          ) : (
            cart.map(item => (
              <div key={item.isCustom ? item.tempId : item.product} className="cart-item">
                <div className="cart-item-details">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     {item.name} 
                     {item.isCustom && <span style={{ fontSize: '0.7rem', background: 'var(--gold-secondary)', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>Custom</span>}
                  </h4>
                  <p>₹{item.price.toLocaleString()} x {item.quantity}</p>
                  {item.isCustom && item.targetWeight && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Target: {item.targetWeight}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => updateQuantity(item, -1)}><FiMinus size={12}/></button>
                    <span>{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQuantity(item, 1)}><FiPlus size={12}/></button>
                  </div>
                  <button className="action-btn" onClick={() => removeFromCart(item)}>
                    <FiTrash2 color="var(--danger)" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="order-details-form">
          <div className="form-group">
            <label>Expected Delivery Date *</label>
            <input 
              type="datetime-local" 
              className="form-control"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div className="form-group">
            <label>Advance Payment</label>
            <input 
              type="number" 
              className="form-control"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="form-group">
             <label>Payment Method (Advance)</label>
             <select 
               className="form-control"
               value={paymentMethod}
               onChange={(e) => setPaymentMethod(e.target.value)}
             >
               <option value="CASH">Cash</option>
               <option value="UPI">UPI</option>
               <option value="CARD">Card</option>
               <option value="BANK_TRANSFER">Bank Transfer</option>
             </select>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea 
              className="form-control"
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="summary-section">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₹{totalAmount.toLocaleString()}</span>
          </div>
          <div className="summary-row">
            <span>Advance Paid</span>
            <span style={{ color: '#2e7d32' }}>- ₹{Number(advanceAmount || 0).toLocaleString()}</span>
          </div>
          <div className="summary-row total-row">
            <span>Balance Due</span>
            <span style={{ color: '#d32f2f' }}>₹{balanceAmount.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
            <button 
              className="submit-btn" 
              disabled={loading || cart.length === 0 || !selectedCustomer}
              onClick={handleSubmit}
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
            {cart.length === 0 && (activeTab === 'custom' || customItem.name) && (
                <div style={{ color: 'var(--warning)', fontSize: '0.85rem', marginTop: '5px', textAlign: 'center' }}>
                    * Please add items to cart first (Click "Add Custom Item")
                </div>
            )}
            {!selectedCustomer && (
                <div style={{ color: 'var(--warning)', fontSize: '0.85rem', marginTop: '5px', textAlign: 'center' }}>
                    * Please select a customer
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default OrderCreate;
