import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiPlus, FiTrash2, FiShoppingCart, FiUser, FiSearch, FiX, FiPrinter, FiSave, FiCamera } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { Html5QrcodeScanner } from 'html5-qrcode';
import InvoiceTemplate from '../components/InvoiceTemplate';
import './Billing.css';

const Billing = () => {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [goldPrice, setGoldPrice] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: { street: '', city: '', state: '', pincode: '' },
    creditLimit: ''
  });
  const [formData, setFormData] = useState({
    paymentMode: 'Cash',
    paymentDetails: { cash: 0, upi: 0, card: 0 },
    discount: 0
  });
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [exchangeItems, setExchangeItems] = useState([]);
  const [exchangeInput, setExchangeInput] = useState({ description: '', weight: '', purity: '', rate: '' });
  
  // Scanning State
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const scannerInputRef = useRef(null);
  const scannerContainerId = 'reader';

  // Sound Effect
  const playBeep = (type = 'success') => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
      osc.frequency.value = 1200;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.frequency.value = 300;
      osc.type = 'sawtooth';
      gain.gain.value = 0.2;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  };

  // Process Scanned Code
  const processScannedCode = async (code) => {
    if (!code) return;
    try {
      const response = await api.get(`/api/products/scan/${code}`);
      const product = response.data;
      
      playBeep('success');
      toast.success(`Found: ${product.name}`);
      
      // Add to cart with duplicate check
      addToCartOrIncrement(product);
      
    } catch (error) {
      playBeep('error');
      console.error(error);
      toast.error('Product not found or invalid code');
    }
  };

  const addToCartOrIncrement = (product) => {
    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.product === product._id);
      
      if (existingIndex >= 0) {
        // Product exists, increment quantity or weight
        const updatedCart = [...prevCart];
        const item = updatedCart[existingIndex];
        
        if (product.isWeightManaged) {
          // For weight managed, usually we don't just increment weight blindly, 
          // but for this requirement "increase quantity instead of creating a duplicate row",
          // we'll assume quantity increment for non-weight managed, 
          // and maybe just notify for weight managed or add another entry?
          // The requirement says "increase quantity". 
          // If it's weight managed, quantity might not be the main factor.
          // Let's increment quantity if it exists, otherwise do nothing or add new row.
          // Most jewelry software adds a NEW row for each piece because weights differ.
          // BUT, if it's the EXACT same SKU, maybe it's a bulk item?
          // Let's assume quantity increment for now.
           item.quantity = (item.quantity || 1) + 1;
           // We don't auto-increment weight because that varies per piece usually.
        } else {
           item.quantity = (item.quantity || 1) + 1;
           // Recalculate subtotal
           const baseAmount = (item.rate * item.weight) + item.makingCharge + item.wastage - item.discount - item.oldGoldAdjustment;
           // If it's a fixed price item (not weight based), usually rate * quantity.
           // The current logic seems weight based.
           // If netWeight is used for price:
           // item.subtotal = ... 
           // Wait, current logic: subtotal = (rate * weight) + ...
           // If it's quantity based (e.g. stones), logic might differ.
           // Let's just add as new row for now if logic is complex, 
           // BUT requirement says "increase quantity".
           // Let's just add a new row for simplicity and safety in Jewelry domain 
           // unless it's clearly a non-unique item.
           // Actually, let's stick to the user request: "increase quantity".
           
           // If the logic relies on weight * rate, quantity is just a counter?
           // If rate is per piece, then subtotal = rate * quantity.
        }
        
        // Re-calculate subtotal for that item if needed
        // Assuming current logic is mostly weight based. 
        // If I just increment quantity, does it affect subtotal?
        // The current `handleAddToCart` sets `subtotal: (sellingPrice * weight)`.
        // It doesn't use quantity in subtotal calculation.
        // So incrementing quantity is metadata.
        
        // Let's just add it as a new item if it's weight managed (safest),
        // and increment if it's not.
        if (!product.isWeightManaged) {
             // Assuming non-weight managed items are sold by piece?
             // The current code sets weight = netWeight.
             // If I have 2 items, weight should be 2 * netWeight?
             const newQty = (item.quantity || 1) + 1;
             item.quantity = newQty;
             item.weight = (product.netWeight || 0) * newQty;
             
             // Update subtotal
             const baseAmount = (item.rate * item.weight) + item.makingCharge + item.wastage - item.discount - item.oldGoldAdjustment;
             item.subtotal = baseAmount + item.gst;
             
             toast.info(`Increased quantity to ${newQty}`);
             return updatedCart;
        }
      }
      
      // If not found or weight managed (add as new), use existing logic
      // We need to call the logic that creates the item. 
      // Since we are inside set callback, we can't call handleAddToCart directly nicely without passing state.
      // So we duplicate the creation logic here slightly or refactor.
      
      const cartItem = {
        product: product._id,
        productName: product.name,
        sku: product.sku || 'N/A',
        category: product.category,
        quantity: 1,
        weight: product.isWeightManaged ? 0 : (product.netWeight || 0),
        rate: product.sellingPrice || 0,
        makingCharge: 0,
        wastage: 0,
        gst: 0,
        discount: 0,
        oldGoldAdjustment: 0,
        subtotal: (product.sellingPrice || 0) * (product.isWeightManaged ? 0 : (product.netWeight || 0))
      };
      
      return [...prevCart, cartItem];
    });
  };

  // Handle Physical Scanner Input
  const handleScanInput = (e) => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      if (code) {
        processScannedCode(code);
        e.target.value = ''; // Clear input
      }
    }
  };

  // Auto-focus scanner input
  useEffect(() => {
    const focusScanner = () => {
      if (scannerInputRef.current && !showCameraScanner && !showCustomerModal && !showProductSearch) {
        scannerInputRef.current.focus();
      }
    };
    
    // Focus on mount and when modals close
    focusScanner();
    
    // Optional: Keep focus on click anywhere (aggressive mode)
    // const handleClick = () => focusScanner();
    // document.addEventListener('click', handleClick);
    // return () => document.removeEventListener('click', handleClick);
  }, [showCameraScanner, showCustomerModal, showProductSearch]);

  // Camera Scanner Effect
  useEffect(() => {
    if (showCameraScanner) {
      const scanner = new Html5QrcodeScanner(
        scannerContainerId,
        { fps: 10, qrbox: 250 },
        /* verbose= */ false
      );
      
      scanner.render((decodedText) => {
        processScannedCode(decodedText);
        scanner.clear();
        setShowCameraScanner(false);
      }, (error) => {
        // console.warn(error);
      });

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [showCameraScanner]);

  const addExchangeItem = () => {
    if (!exchangeInput.description || !exchangeInput.weight || !exchangeInput.rate) {
      toast.error('Please fill description, weight and rate');
      return;
    }
    const weight = parseFloat(exchangeInput.weight);
    const rate = parseFloat(exchangeInput.rate);
    const purity = parseFloat(exchangeInput.purity) || 100;
    const amount = weight * rate * (purity / 100);
    
    setExchangeItems([...exchangeItems, { ...exchangeInput, weight, rate, purity, amount }]);
    setExchangeInput({ description: '', weight: '', purity: '', rate: '' });
  };
  
  const removeExchangeItem = (index) => {
    setExchangeItems(exchangeItems.filter((_, i) => i !== index));
  };

  const [shopDetails, setShopDetails] = useState(null);

  const printRef = useRef();

  // Load last selected customer on mount
  useEffect(() => {
    const lastCustomer = localStorage.getItem('lastSelectedCustomer');
    if (lastCustomer) {
      try {
        const customer = JSON.parse(lastCustomer);
        setSelectedCustomer(customer);
      } catch (e) {
        console.error('Error loading last customer:', e);
      }
    }
    fetchShopDetails();
  }, []);

  const fetchShopDetails = async () => {
    try {
      const response = await api.get('/api/settings');
      if (response.data && response.data.shopDetails) {
        setShopDetails(response.data.shopDetails);
      }
    } catch (error) {
      console.error('Failed to load shop details', error);
    }
  };

  const fetchCustomers = useCallback(async () => {
    if (!customerSearch || customerSearch.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const params = { search: customerSearch };
      const response = await api.get('/api/customers', { params });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers');
    }
  }, [customerSearch]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data);
      // Don't set filteredProducts here to show all. Only show when searching.
      setFilteredProducts([]); 
    } catch (error) {
      console.error('Failed to load products');
    }
  }, []);

  const fetchGoldPrice = useCallback(async () => {
    try {
      const response = await api.get('/api/gold-price');
      setGoldPrice(response.data);
    } catch (error) {
      console.error('Failed to load gold price');
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [fetchCustomers]);

  useEffect(() => {
    fetchProducts();
    fetchGoldPrice();
  }, [fetchProducts, fetchGoldPrice]);

  // Filter products based on search and category
  useEffect(() => {
    if (!productSearch && !productCategoryFilter) {
      setFilteredProducts([]); // Don't show anything if no search
      return;
    }

    let filtered = products.filter(p => {
      if (p.isWeightManaged) {
        return (p.availableWeight || 0) > 0;
      }
      return (p.quantity || 0) > 0;
    });
    
    if (productSearch) {
      const searchLower = productSearch.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
        (p.category && p.category.toLowerCase().includes(searchLower))
      );
    }
    
    if (productCategoryFilter) {
      filtered = filtered.filter(p => p.category === productCategoryFilter);
    }
    
    setFilteredProducts(filtered);
  }, [products, productSearch, productCategoryFilter]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      if (!newCustomerForm.name || !newCustomerForm.phone) {
        toast.error('Name and Phone are required');
        return;
      }

      // Check if customer with same phone exists
      const checkResponse = await api.get('/api/customers', { 
        params: { search: newCustomerForm.phone } 
      });
      
      const existingCustomer = checkResponse.data.find(
        c => c.phone === newCustomerForm.phone
      );

      if (existingCustomer) {
        toast.error('User already exists, please select from existing users');
        setCustomerSearch(newCustomerForm.phone);
        setShowCustomerModal(false);
        setNewCustomerForm({
          name: '',
          phone: '',
          email: '',
          address: { street: '', city: '', state: '', pincode: '' },
          creditLimit: ''
        });
        // Trigger search
        return;
      }

      const response = await api.post('/api/customers', newCustomerForm);
      toast.success('Customer created successfully!');
      
      setSelectedCustomer(response.data);
      localStorage.setItem('lastSelectedCustomer', JSON.stringify(response.data));
      
      setShowCustomerModal(false);
      setNewCustomerForm({
        name: '',
        phone: '',
        email: '',
        address: { street: '', city: '', state: '', pincode: '' },
        creditLimit: ''
      });
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('phone')) {
        toast.error('User already exists, please select from existing users');
        setCustomerSearch(newCustomerForm.phone);
      } else {
        toast.error(error.response?.data?.message || 'Failed to create customer');
      }
    }
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    localStorage.setItem('lastSelectedCustomer', JSON.stringify(customer));
  };

  const handleAddToCart = (product) => {
    const cartItem = {
      product: product._id,
      productName: product.name,
      sku: product.sku || 'N/A',
      category: product.category,
      quantity: 1,
      weight: product.isWeightManaged ? 0 : (product.netWeight || 0),
      rate: product.sellingPrice || 0,
      makingCharge: 0,
      wastage: 0,
      gst: 0,
      discount: 0,
      oldGoldAdjustment: 0,
      subtotal: (product.sellingPrice || 0) * (product.isWeightManaged ? 0 : (product.netWeight || 0))
    };
    setCart([...cart, cartItem]);
    setProductSearch('');
    setShowProductSearch(false);
    toast.success(`${product.name} added to cart`);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const updateCartItem = (index, field, value) => {
    const updatedCart = [...cart];
    updatedCart[index][field] = parseFloat(value) || 0;
    
    // Recalculate subtotal
    const item = updatedCart[index];
    // Formula: (Rate * Weight) + Making + Wastage - Discount - OldGold
    // GST is calculated on top usually, but here user has GST field per item.
    // Assuming GST is EXTRA.
    const baseAmount = (item.rate * item.weight) + item.makingCharge + item.wastage - item.discount - item.oldGoldAdjustment;
    // If GST is amount, add it. If GST is percent, calculate it. 
    // Usually GST is calculated on total. But here it seems to be an amount field.
    // Let's assume it's an amount entered manually or 0.
    item.subtotal = baseAmount + item.gst;
    
    setCart(updatedCart);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    // GST in cart items is already added to subtotal in updateCartItem logic above?
    // Wait, let's look at Invoice model. 'subtotal' and 'total'.
    // Usually subtotal is before tax.
    // Let's refine: Item Subtotal = (Rate*Weight + Making + Wastage).
    // Item Total = Subtotal + GST - Discount.
    
    // In updateCartItem, I added GST to subtotal. That might be confusing.
    // Let's stick to:
    // Item Subtotal = (Rate * Weight) + Making + Wastage.
    // We will calculate Global GST and Discount.
    
    // BUT, the Invoice Item schema has 'subtotal', 'gst', 'discount'.
    // So per-item calculation is stored.
    
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    // Global discount
    const globalDiscount = parseFloat(formData.discount) || 0;
    const exchangeTotal = exchangeItems.reduce((sum, item) => sum + item.amount, 0);
    const finalTotal = total - globalDiscount - exchangeTotal;
    
    const paidAmount = (parseFloat(formData.paymentDetails.cash) || 0) + 
                       (parseFloat(formData.paymentDetails.upi) || 0) + 
                       (parseFloat(formData.paymentDetails.card) || 0);
    const dueAmount = finalTotal - paidAmount;

    return { subtotal: total, discount: globalDiscount, exchangeTotal, total: finalTotal, paidAmount, dueAmount };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }
    if (cart.length === 0) {
      toast.error('Please add items to cart');
      return;
    }

    const totals = calculateTotals();
    
    // Validation: Payment must be provided unless it's Credit
    if (totals.paidAmount <= 0 && formData.paymentMode !== 'Credit' && totals.total > 0) {
       // Allow 0 payment if total is 0 (exchange)
    }

    try {
      const invoiceData = {
        customer: selectedCustomer._id,
        items: cart.map(item => ({
          product: item.product,
          quantity: item.quantity,
          weight: item.weight,
          rate: item.rate,
          makingCharge: item.makingCharge,
          wastage: item.wastage,
          gst: item.gst,
          discount: item.discount,
          oldGoldAdjustment: item.oldGoldAdjustment,
          subtotal: item.subtotal
        })),
        subtotal: totals.subtotal,
        gst: cart.reduce((sum, item) => sum + item.gst, 0), // Sum of item GSTs
        discount: totals.discount, // Global discount
        exchange: {
          items: exchangeItems,
          totalAmount: totals.exchangeTotal
        },
        total: totals.total,
        paymentMode: formData.paymentMode,
        paidAmount: totals.paidAmount,
        dueAmount: totals.dueAmount,
        paymentDetails: formData.paymentDetails,
        goldRate: goldPrice ? {
          rate24K: goldPrice.rate24K,
          rate22K: goldPrice.rate22K,
          rate18K: goldPrice.rate18K
        } : null
      };

      const response = await api.post('/api/invoices', invoiceData);
      toast.success('Invoice created successfully!');
      setCreatedInvoice(response.data);
      
      // Auto-print? Or just show print button.
      // User said "Add Print Invoice".
      
      // Clear form
      setCart([]);
      setFormData({
        paymentMode: 'Cash',
        paymentDetails: { cash: 0, upi: 0, card: 0 },
        discount: 0
      });
      setProductSearch('');
      setProductCategoryFilter('');
      
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to create invoice');
    }
  };

  const handlePrintInvoice = () => {
    if (!createdInvoice) {
      toast.error('No invoice to print');
      return;
    }
    window.print();
  };

  const totals = calculateTotals();
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  const formatNumber = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0
    }).format(amount);
  };
  const renderAmount = (amount) => (
    <span className="amount">
      <span className="currency">₹</span>
      <span className="value">{formatNumber(amount)}</span>
    </span>
  );

  // Get unique categories from products
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <div className="billing-page debug-outline">
      <div className="page-header">
        <h1>Billing & Invoice</h1>
        <p>Create new invoices and process sales</p>
      </div>

      <div className="billing-container">
        {/* Scanner Input (Always Focused) */}
        <input
          ref={scannerInputRef}
          type="text"
          className="scanner-input"
          placeholder="Scan Barcode..."
          onKeyDown={handleScanInput}
          autoComplete="off"
          autoFocus
        />

        {/* Camera Scanner Modal */}
        {showCameraScanner && (
          <div className="camera-modal-overlay">
            <div className="camera-modal">
              <div className="camera-header">
                <h3>Scan Barcode/QR</h3>
                <button onClick={() => setShowCameraScanner(false)}><FiX /></button>
              </div>
              <div id={scannerContainerId}></div>
              <p className="camera-instruction">Point camera at a barcode</p>
            </div>
          </div>
        )}

        {/* Left Side: Customer & Product Search */}
        <div className="billing-left">
          {/* Customer Section */}
          <div className="section">
            <div className="customer-header">
              <h3>Select Customer</h3>
              <button 
                type="button"
                className="btn-add-customer"
                onClick={() => setShowCustomerModal(true)}
              >
                <FiPlus /> Add New Customer
              </button>
            </div>
            
            <div className="customer-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search User (Name/Mobile)..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  if (e.target.value.length < 2) {
                    setCustomers([]);
                  }
                }}
              />
            </div>

            {selectedCustomer && (
              <div className="selected-customer-info">
                <div className="customer-info-header">
                  <FiUser />
                  <div>
                    <strong>{selectedCustomer.name}</strong>
                    <p>{selectedCustomer.phone}</p>
                    {selectedCustomer.totalDue > 0 && (
                      <p className="due-warning">
                        Outstanding: {formatCurrency(selectedCustomer.totalDue)}
                      </p>
                    )}
                  </div>
                  <button 
                    className="btn-clear-customer"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                    title="Clear selection"
                  >
                    <FiX />
                  </button>
                </div>
              </div>
            )}

            {!selectedCustomer && customerSearch.length >= 2 && (
              <div className="customer-list">
                {customers.length === 0 ? (
                  <p className="no-customers">User not found. Check number or Add New.</p>
                ) : (
                  customers.map(customer => (
                    <div
                      key={customer._id}
                      className="customer-list-item"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <FiUser />
                      <div>
                        <strong>{customer.name}</strong>
                        <p>{customer.phone}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Product Section */}
          <div className="section">
            <h3>Add Products</h3>
            <div className="product-search-controls">
              <div className="product-search-box">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search by SKU, Name, or Category..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductSearch(true);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                />
              </div>
              <button 
                className="btn-camera-scan"
                onClick={() => setShowCameraScanner(true)}
                title="Scan with Camera"
              >
                <FiCamera />
              </button>
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="category-filter"
              >
                <option value="">Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            {(productSearch || productCategoryFilter) && (
              <div className="products-list">
                {filteredProducts.length === 0 ? (
                  <p className="no-customers">No products found</p>
                ) : (
                  filteredProducts.map(product => (
                    <div key={product._id} className="product-item" onClick={() => handleAddToCart(product)}>
                      <div>
                        <strong>{product.name}</strong>
                        <p>
                          {product.sku} | {product.category} | {product.isWeightManaged ? `${product.availableWeight}g avail` : `${product.netWeight}g`}
                        </p>
                      </div>
                      <div className="product-price">{formatCurrency(product.sellingPrice)}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Column: Cart + Exchange + Payment */}
        <div className="billing-center">
          <div className="cart-section">
            <h3><FiShoppingCart /> Cart ({cart.length})</h3>
            {cart.length === 0 ? (
              <p className="empty-cart">Cart is empty</p>
            ) : (
              <>
                {/* Desktop/Tablet Table */}
                <div className="cart-table-container">
                  <table className="cart-table">
                     <thead>
                       <tr>
                         <th>Product</th>
                         <th>Wt(g)</th>
                         <th>Rate</th>
                         <th>MC</th>
                         <th>Wst</th>
                         <th>GST</th>
                         <th>Total</th>
                         <th></th>
                       </tr>
                     </thead>
                     <tbody>
                       {cart.map((item, index) => (
                         <tr key={index}>
                           <td data-label="Product">
                             <div className="cart-product-name">{item.productName}</div>
                             <div className="cart-product-sku">{item.sku}</div>
                           </td>
                           <td data-label="Wt(g)">
                             <input 
                               type="number" 
                               step="0.01" 
                               value={item.weight} 
                               onChange={(e) => updateCartItem(index, 'weight', e.target.value)}
                               className="table-input number-input"
                               placeholder="0.00 g"
                               title="Weight in grams"
                               min="0"
                             />
                           </td>
                           <td data-label="Rate">
                             <input 
                               type="number" 
                               value={item.rate} 
                               onChange={(e) => updateCartItem(index, 'rate', e.target.value)}
                               className="table-input number-input"
                               placeholder="₹/g"
                               title="Rate per gram"
                               min="0"
                             />
                           </td>
                           <td data-label="MC">
                             <input 
                               type="number" 
                               value={item.makingCharge} 
                               onChange={(e) => updateCartItem(index, 'makingCharge', e.target.value)}
                               className="table-input number-input"
                               placeholder="Making"
                               title="Making charge"
                               min="0"
                             />
                           </td>
                           <td data-label="Wst">
                             <input 
                               type="number" 
                               value={item.wastage} 
                               onChange={(e) => updateCartItem(index, 'wastage', e.target.value)}
                               className="table-input number-input"
                               placeholder="Wastage"
                               title="Wastage"
                               min="0"
                             />
                           </td>
                           <td data-label="GST">
                             <input 
                               type="number" 
                               value={item.gst} 
                               onChange={(e) => updateCartItem(index, 'gst', e.target.value)}
                               className="table-input number-input"
                               placeholder="GST"
                               title="GST amount"
                               min="0"
                             />
                           </td>
                           <td className="text-right" data-label="Total">
                             {formatCurrency(item.subtotal)}
                           </td>
                           <td>
                             <button onClick={() => removeFromCart(index)} className="btn-icon-danger">
                               <FiTrash2 />
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="cart-cards">
                  {cart.map((item, index) => (
                    <div key={index} className="cart-card">
                      <div className="cart-card-header">
                        <div>
                          <div className="cart-card-title">{item.productName}</div>
                          <div className="cart-card-sku">{item.sku}</div>
                        </div>
                        <button onClick={() => removeFromCart(index)} className="btn-icon-danger" aria-label="Remove item">
                          <FiTrash2 />
                        </button>
                      </div>
                      <div className="cart-field">
                        <div className="cart-label">Wt(g)</div>
                        <div className="cart-value">
                          <input 
                            type="number" 
                            step="0.01" 
                            value={item.weight} 
                            onChange={(e) => updateCartItem(index, 'weight', e.target.value)}
                            placeholder="0.00"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="cart-field">
                        <div className="cart-label">Rate</div>
                        <div className="cart-value">
                          <input 
                            type="number" 
                            value={item.rate} 
                            onChange={(e) => updateCartItem(index, 'rate', e.target.value)}
                            placeholder="₹/g"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="cart-field">
                        <div className="cart-label">MC</div>
                        <div className="cart-value">
                          <input 
                            type="number" 
                            value={item.makingCharge} 
                            onChange={(e) => updateCartItem(index, 'makingCharge', e.target.value)}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="cart-field">
                        <div className="cart-label">GST</div>
                        <div className="cart-value">
                          <input 
                            type="number" 
                            value={item.gst} 
                            onChange={(e) => updateCartItem(index, 'gst', e.target.value)}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="cart-field">
                        <div className="cart-label">Wst</div>
                        <div className="cart-value">
                          <input 
                            type="number" 
                            value={item.wastage} 
                            onChange={(e) => updateCartItem(index, 'wastage', e.target.value)}
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="cart-total">
                        <span>Total</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="exchange-section">
            <h3>Old Gold / Exchange</h3>
            <div className="exchange-inputs">
              <input 
                type="text" 
                placeholder="Description" 
                value={exchangeInput.description}
                onChange={(e) => setExchangeInput({...exchangeInput, description: e.target.value})}
                className="ex-desc"
              />
              <input 
                type="number" 
                placeholder="Wt (g)" 
                value={exchangeInput.weight}
                onChange={(e) => setExchangeInput({...exchangeInput, weight: e.target.value})}
                className="ex-wt"
              />
              <input 
                type="number" 
                placeholder="Purity %" 
                value={exchangeInput.purity}
                onChange={(e) => setExchangeInput({...exchangeInput, purity: e.target.value})}
                className="ex-purity"
              />
              <input 
                type="number" 
                placeholder="Rate/g" 
                value={exchangeInput.rate}
                onChange={(e) => setExchangeInput({...exchangeInput, rate: e.target.value})}
                className="ex-rate"
              />
              <button onClick={addExchangeItem} className="btn-add-exchange">
                <FiPlus /> Add
              </button>
            </div>

            {exchangeItems.length > 0 && (
              <div className="exchange-list">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Wt</th>
                      <th>Purity</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {exchangeItems.map((item, index) => (
                      <tr key={index}>
                        <td>{item.description}</td>
                        <td>{item.weight}</td>
                        <td>{item.purity}%</td>
                        <td>{item.rate}</td>
                        <td>{formatCurrency(item.amount)}</td>
                        <td>
                          <button onClick={() => removeExchangeItem(index)} className="btn-icon-danger">
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

          <div className="payment-section">
            <div className="totals-display">
              <div className="total-row"><span>Subtotal:</span> <span>{renderAmount(totals.subtotal)}</span></div>
              <div className="total-row"><span>Discount:</span> <span>- {renderAmount(totals.discount)}</span></div>
              {totals.exchangeTotal > 0 && (
                <div className="total-row"><span>Exchange:</span> <span>- {renderAmount(totals.exchangeTotal)}</span></div>
              )}
              <div className="total-row grand-total"><span>Total:</span> <span>{renderAmount(totals.total)}</span></div>
            </div>

            <div className="payment-controls">
                <div className="form-group">
                    <label>Discount</label>
                    <input type="number" value={formData.discount} onChange={(e) => setFormData({...formData, discount: parseFloat(e.target.value) || 0})} />
                </div>
                
                <div className="form-group">
                    <label>Payment Mode</label>
                    <select value={formData.paymentMode} onChange={(e) => setFormData({...formData, paymentMode: e.target.value})}>
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Split">Split</option>
                    </select>
                </div>

                {formData.paymentMode === 'Split' ? (
                   <div className="split-payment">
                       <input type="number" placeholder="Cash" value={formData.paymentDetails.cash} onChange={(e) => setFormData({...formData, paymentDetails: {...formData.paymentDetails, cash: parseFloat(e.target.value) || 0}})} />
                       <input type="number" placeholder="UPI" value={formData.paymentDetails.upi} onChange={(e) => setFormData({...formData, paymentDetails: {...formData.paymentDetails, upi: parseFloat(e.target.value) || 0}})} />
                       <input type="number" placeholder="Card" value={formData.paymentDetails.card} onChange={(e) => setFormData({...formData, paymentDetails: {...formData.paymentDetails, card: parseFloat(e.target.value) || 0}})} />
                   </div>
                ) : (
                   <div className="form-group">
                       <label>Paid Amount</label>
                       <input 
                         type="number" 
                         value={formData.paymentDetails[formData.paymentMode.toLowerCase()] ?? 0} 
                         onChange={(e) => {
                             const val = parseFloat(e.target.value) || 0;
                             setFormData({
                                 ...formData, 
                                 paymentDetails: { 
                                     cash: formData.paymentMode === 'Cash' ? val : 0,
                                     upi: formData.paymentMode === 'UPI' ? val : 0,
                                     card: formData.paymentMode === 'Card' ? val : 0
                                 }
                             });
                         }} 
                       />
                   </div>
                )}
                
                <div className="total-row due-row"><span>Due:</span> <span>{renderAmount(totals.dueAmount)}</span></div>

                <div className="action-buttons">
                    <button className="btn-save" onClick={handleSubmit} disabled={cart.length === 0}><FiSave /> Save Invoice</button>
                    {createdInvoice && (
                        <button className="btn-print" onClick={handlePrintInvoice}><FiPrinter /> Print</button>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky-bottom-save">
        <div className="save-bar">
          <div className="save-total">Total: {renderAmount(totals.total)}</div>
          <button className="save-action" onClick={handleSubmit} disabled={cart.length === 0}><FiSave /> Pay Now</button>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Customer</h3>
              <button onClick={() => setShowCustomerModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleCreateCustomer}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  required
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  value={newCustomerForm.address.street}
                  onChange={(e) => setNewCustomerForm({
                    ...newCustomerForm,
                    address: { ...newCustomerForm.address, street: e.target.value }
                  })}
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={newCustomerForm.address.city}
                  onChange={(e) => setNewCustomerForm({
                    ...newCustomerForm,
                    address: { ...newCustomerForm.address, city: e.target.value }
                  })}
                />
              </div>
              <button type="submit" className="btn-submit">Create Customer</button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for Printing */}
      <InvoiceTemplate ref={printRef} invoice={createdInvoice} shopDetails={shopDetails} />
    </div>
  );
};

export default Billing;
