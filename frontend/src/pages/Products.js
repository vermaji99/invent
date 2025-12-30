import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiPrinter, FiUpload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { toast } from 'react-toastify';
import BarcodePrintModal from '../components/BarcodePrintModal';
import './Products.css';

const Products = () => {
  const PLACEHOLDER_DATA_URI = 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"300\" height=\"225\"><rect width=\"100%\" height=\"100%\" fill=\"%232f2f2f\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23999\" font-size=\"20\">No Image</text></svg>';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [huidFilter, setHuidFilter] = useState('');
  const [weightFilter, setWeightFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 });
  const [cancelImport, setCancelImport] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWeightSubmitting, setIsWeightSubmitting] = useState(false);
  const [weightFormData, setWeightFormData] = useState({
    name: '',
    category: 'Gold',
    sku: '',
    purity: '22K',
    totalWeight: '',
    purchasePrice: '',
    sellingPrice: ''
  });
  
  // Image states
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Gold',
    sku: '',
    huid: '',
    grossWeight: '',
    netWeight: '',
    purity: '22K',
    purchasePrice: '',
    sellingPrice: '',
    quantity: '',
    lowStockAlert: '5'
  });

  useEffect(() => {
    fetchProducts();
  }, [category, search, huidFilter, weightFilter]);

  const fetchProducts = async () => {
    try {
      const params = {};
      if (category) params.category = category;
      if (search) params.search = search;
      if (huidFilter) {
        params.huidEnabled = huidFilter === 'enabled' ? 'true' : (huidFilter === 'disabled' ? 'false' : '');
      }
      if (weightFilter) {
        params.weightManaged = weightFilter === 'weight' ? 'true' : (weightFilter === 'qty' ? 'false' : '');
      }
      const response = await api.get('/api/products', { params });
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightSubmit = async (e) => {
    e.preventDefault();
    if (isWeightSubmitting) return;
    setIsWeightSubmitting(true);
    try {
      const payload = {
        name: weightFormData.name,
        category: weightFormData.category,
        sku: weightFormData.sku,
        purity: weightFormData.purity,
        totalWeight: parseFloat(weightFormData.totalWeight) || 0,
        purchasePrice: parseFloat(weightFormData.purchasePrice) || 0,
        sellingPrice: parseFloat(weightFormData.sellingPrice) || 0
      };
      const res = await api.post('/api/products/weight-managed', payload);
      toast.success('Weight-based stock updated');
      setShowWeightModal(false);
      setWeightFormData({
        name: '',
        category: 'Gold',
        sku: '',
        purity: '22K',
        totalWeight: '',
        purchasePrice: '',
        sellingPrice: ''
      });
      fetchProducts();
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to add weight-based product';
      toast.error(msg);
    } finally {
      setIsWeightSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'huid') {
          const v = (formData.huid || '').trim();
          if (v.length === 0) return;
          data.append('huid', v);
          return;
        }
        data.append(key, formData[key]);
      });
      
      // Append images
      if (imageFiles) {
        Array.from(imageFiles).forEach(file => {
          data.append('images', file);
        });
      }

      // Append existing images if editing
      if (editingProduct && existingImages.length > 0) {
        existingImages.forEach(img => {
          data.append('existingImages', img);
        });
      }

      const config = {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      };

      if (editingProduct) {
        await api.put(`/api/products/${editingProduct._id}`, data, config);
        toast.success('Product updated successfully');
      } else {
        await api.post('/api/products', data, config);
        toast.success('Product created successfully');
      }
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      const errors = error.response?.data?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        errors.forEach(err => {
          const msg = err.msg || err.message || 'Validation error';
          toast.error(msg);
        });
      } else {
        toast.error(error.response?.data?.message || 'Operation failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      sku: product.sku,
      huid: product.huid || '',
      grossWeight: product.grossWeight,
      netWeight: product.netWeight,
      purity: product.purity,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      quantity: product.quantity,
      lowStockAlert: product.lowStockAlert || 5
    });
    setExistingImages(product.images || []);
    setImageFiles([]); // Reset new files
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.delete(`/api/products/${id}`);
        toast.success('Product deleted successfully');
        fetchProducts();
      } catch (error) {
        toast.error('Failed to delete product');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Gold',
      sku: '',
      huid: '',
      grossWeight: '',
      netWeight: '',
      purity: '22K',
      purchasePrice: '',
      sellingPrice: '',
      quantity: '',
      lowStockAlert: '5'
    });
    setImageFiles([]);
    setExistingImages([]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      fetchProducts();
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(products.map(p => p._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected product(s)?`);
    if (!ok) return;
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/api/products/${id}`)));
      toast.success(`Deleted ${selectedIds.length} product(s)`);
      setSelectedIds([]);
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete selected products');
    }
  };

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h1>Inventory Management</h1>
          <p>Manage your products and stock</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); setEditingProduct(null); }}>
            <FiPlus /> Add Product
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setShowWeightModal(true)}
          >
            <FiPlus /> Bulk Add by Weight
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setShowExcelModal(true)}
          >
            <FiUpload /> Import via Excel
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setShowPrintModal(true)} 
            disabled={selectedIds.length === 0}
            style={{ opacity: selectedIds.length === 0 ? 0.6 : 1 }}
          >
            <FiPrinter /> Print Barcodes
          </button>
          <button
            className="btn-primary"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0}
            style={{ opacity: selectedIds.length === 0 ? 0.6 : 1 }}
            title="Delete selected products"
          >
            <FiTrash2 /> Delete Selected
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="search-box">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search products or scan barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleBarcodeScan}
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="Gold">Gold</option>
          <option value="Silver">Silver</option>
          <option value="Diamond">Diamond</option>
          <option value="Platinum">Platinum</option>
          <option value="Other">Other</option>
        </select>
        <select value={huidFilter} onChange={(e) => setHuidFilter(e.target.value)}>
          <option value="">All Stock</option>
          <option value="enabled">HUID Enabled</option>
          <option value="disabled">Non-HUID Stock</option>
        </select>
        <select value={weightFilter} onChange={(e) => setWeightFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="weight">Weight</option>
          <option value="qty">Qty</option>
        </select>
      </div>

      <div className="selection-bar">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <input 
            type="checkbox" 
            onChange={handleSelectAll}
            checked={products.length > 0 && selectedIds.length === products.length}
          />
          Select All Cards ({selectedIds.length} selected)
        </label>
      </div>

      {loading ? (
        <div className="loading">Loading products...</div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div 
              key={product._id} 
              className={`product-card royal-card ${selectedIds.includes(product._id) ? 'selected' : ''}`}
              onClick={() => toggleSelect(product._id)}
            >
              <input 
                type="checkbox" 
                className="select-checkbox"
                checked={selectedIds.includes(product._id)} 
                onChange={() => toggleSelect(product._id)} 
                onClick={(e) => e.stopPropagation()}
                aria-label="Select product for printing"
              />
              <div className="product-image-container">
                {product.images && product.images.length > 0 ? (
                  <img 
                    src={`${api.defaults.baseURL}${product.images[0]}`} 
                    alt={product.name} 
                    className="product-thumb"
                    onError={(e) => { e.target.onerror = null; e.target.src = product.thumbnailBase64 || PLACEHOLDER_DATA_URI; }} 
                  />
                ) : (
                   product.thumbnailBase64 ? (
                     <img 
                       src={product.thumbnailBase64} 
                       alt={product.name} 
                       className="product-thumb"
                     />
                   ) : (
                     <img 
                       src={PLACEHOLDER_DATA_URI} 
                       alt="No Image" 
                       className="product-thumb"
                     />
                   )
                )}
              </div>
              <div className="product-header">
                <h3 className="product-title">{product.name}</h3>
                <div className="badge-row">
                  <span className={`category-badge ${product.category.toLowerCase()}`}>
                    {product.category}
                  </span>
                  <span className={`huid-badge ${product.huid ? 'enabled' : 'disabled'}`}>
                    {product.huid ? 'HUID Enabled' : 'Non-HUID Stock'}
                  </span>
                </div>
              </div>
              <div className="product-meta">
                <div className="meta-item">
                  <span className="meta-label">SKU</span>
                  <span className="meta-value">{product.sku}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Weight</span>
                  <span className="meta-value">{product.netWeight}g</span>
                </div>
                {product.isWeightManaged && (
                  <div className="meta-item">
                    <span className="meta-label">Available Weight</span>
                    <span className="meta-value">{product.availableWeight}g</span>
                  </div>
                )}
                <div className="meta-item">
                  <span className="meta-label">Purity</span>
                  <span className="meta-value">{product.purity}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Stock</span>
                  <span className={`meta-value ${product.quantity <= product.lowStockAlert ? 'low-stock' : ''}`}>{product.isWeightManaged ? 'N/A' : product.quantity}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Rate/g</span>
                  <span className="meta-value price">{formatCurrency(product.sellingPrice)} /g</span>
                </div>
              </div>
              <div className="product-actions compact-actions">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(product); }} className="btn-small">
                  <FiEdit /> Edit
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(product._id); }} className="btn-danger btn-small">
                  <FiTrash2 /> Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Product Images</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setImageFiles(e.target.files)}
                  accept="image/*"
                />
                {/* Preview existing images */}
                {existingImages && existingImages.length > 0 && (
                  <div className="image-previews">
                    {existingImages.map((img, idx) => (
                      <div key={idx} className="preview-thumb-container">
                        <img src={`https://invent-backend-rjbf.onrender.com${img}`} alt="preview" className="preview-thumb" />
                        <button 
                          type="button" 
                          className="remove-img-btn"
                          onClick={() => setExistingImages(existingImages.filter((_, i) => i !== idx))}
                        >x</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>HUID (Optional)</label>
                  <input
                    type="text"
                    value={formData.huid}
                    onChange={(e) => setFormData({ ...formData, huid: e.target.value })}
                    placeholder="6 alphanumeric characters"
                    maxLength={6}
                  />
                  <small style={{ color: 'var(--text-secondary)' }}>HUID recommended but not mandatory</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gross Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.grossWeight}
                    onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Net Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.netWeight}
                    onChange={(e) => setFormData({ ...formData, netWeight: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Purity</label>
                  <select
                    value={formData.purity}
                    onChange={(e) => setFormData({ ...formData, purity: e.target.value })}
                  >
                    <option value="24K">24K</option>
                    <option value="22K">22K</option>
                    <option value="18K">18K</option>
                    <option value="14K">14K</option>
                    <option value="Silver 925">Silver 925</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                <label>Low Stock Alert</label>
                  <input
                    type="number"
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price (₹/g)</label>
                  <input
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price (₹/g)</label>
                  <input
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {editingProduct ? (isSubmitting ? 'Updating…' : 'Update Product') : (isSubmitting ? 'Creating…' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showExcelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Import Products via Excel</h2>
            <div className="form-group">
              <label>Select Excel File (.xlsx / .xls)</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                disabled={isImporting}
              />
            </div>
            <div className="form-group">
              <label>Expected Columns</label>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                name, category, sku, huid, grossWeight, netWeight, purity, purchasePrice, sellingPrice, quantity, lowStockAlert
              </p>
            </div>
            {importSummary && (
              <div className="form-group">
                <label>Last Import Summary</label>
                <p style={{ fontSize: '0.9rem' }}>
                  Imported: {importSummary.success} • Failed: {importSummary.failed}
                </p>
                {importSummary.errors?.length > 0 && (
                  <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.5rem' }}>
                    {importSummary.errors.map((err, idx) => (
                      <div key={idx} style={{ color: 'var(--danger)', fontSize: '0.85rem)' }}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isImporting && (
              <div className="form-group">
                <label>Progress</label>
                <p style={{ fontSize: '0.9rem' }}>
                  {importProgress.processed} / {importProgress.total}
                </p>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => { 
                if (isImporting) {
                  setCancelImport(true);
                } else {
                  setShowExcelModal(false); 
                  setExcelFile(null);
                }
              }}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={async () => {
                  if (!excelFile) {
                    toast.error('Please select an Excel file');
                    return;
                  }
                  setIsImporting(true);
                  setCancelImport(false);
                  try {
                    const buf = await excelFile.arrayBuffer();
                    const wb = XLSX.read(buf, { type: 'array' });
                    const wsName = wb.SheetNames[0];
                    const ws = wb.Sheets[wsName];
                    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                    if (!Array.isArray(rows) || rows.length === 0) {
                      toast.error('No rows found in sheet');
                      setIsImporting(false);
                      return;
                    }
                    const requiredFields = ['name','category','grossWeight','netWeight','purity','purchasePrice','sellingPrice','quantity'];
                    let success = 0;
                    const errors = [];
                    setImportProgress({ processed: 0, total: rows.length });
                    const allowedCats = ['Gold','Silver','Diamond','Platinum','Other'];
                    const buildPayload = (r, rowIndex) => {
                      const miss = requiredFields.filter(f => String(r[f] ?? '').toString().trim() === '');
                      if (miss.length > 0) {
                        return { error: `Row ${rowIndex}: Missing ${miss.join(', ')}` };
                      }
                      const categoryVal = String(r.category).trim();
                      if (!allowedCats.includes(categoryVal)) {
                        return { error: `Row ${rowIndex}: Invalid category "${categoryVal}"` };
                      }
                      const data = new FormData();
                      data.append('name', String(r.name).trim());
                      data.append('category', categoryVal);
                      if (String(r.sku || '').trim()) data.append('sku', String(r.sku).trim());
                      const huidVal = String(r.huid || '').trim();
                      if (huidVal.length === 6 && /^[A-Za-z0-9]{6}$/.test(huidVal)) {
                        data.append('huid', huidVal);
                      }
                      data.append('grossWeight', String(r.grossWeight).trim());
                      data.append('netWeight', String(r.netWeight).trim());
                      data.append('purity', String(r.purity).trim());
                      data.append('purchasePrice', String(r.purchasePrice).trim());
                      data.append('sellingPrice', String(r.sellingPrice).trim());
                      data.append('quantity', String(r.quantity).trim());
                      const lsa = String(r.lowStockAlert || '').trim();
                      if (lsa) data.append('lowStockAlert', lsa);
                      return { data };
                    };
                    const processRow = async (r, idx) => {
                      if (cancelImport) return;
                      const rowIndex = idx + 2;
                      const payload = buildPayload(r, rowIndex);
                      if (payload.error) {
                        errors.push(payload.error);
                        setImportProgress(p => ({ ...p, processed: p.processed + 1 }));
                        return;
                      }
                      try {
                        await api.post('/api/products', payload.data, { headers: { 'Content-Type': 'multipart/form-data' } });
                        success += 1;
                      } catch (err) {
                        const msg = err.response?.data?.message || (Array.isArray(err.response?.data?.errors) ? err.response.data.errors.map(e => e.msg).join('; ') : 'Failed');
                        errors.push(`Row ${rowIndex}: ${msg}`);
                      } finally {
                        setImportProgress(p => ({ ...p, processed: p.processed + 1 }));
                      }
                    };
                    const concurrency = 5;
                    let pointer = 0;
                    const workers = Array.from({ length: concurrency }).map(async () => {
                      while (pointer < rows.length && !cancelImport) {
                        const i = pointer++;
                        await processRow(rows[i], i);
                      }
                    });
                    await Promise.all(workers);
                    setImportSummary({ success, failed: errors.length, errors });
                    if (success > 0) {
                      toast.success(`Imported ${success} product(s)`);
                      fetchProducts();
                    }
                    if (cancelImport) {
                      toast.info('Import cancelled');
                    }
                  } catch (e) {
                    toast.error('Failed to parse Excel');
                  } finally {
                    setIsImporting(false);
                    setCancelImport(false);
                  }
                }}
                disabled={isImporting}
              >
                {isImporting ? `Importing... (${importProgress.processed}/${importProgress.total})` : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWeightModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Bulk Add by Weight</h2>
            <form onSubmit={handleWeightSubmit}>
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={weightFormData.name}
                  onChange={(e) => setWeightFormData({ ...weightFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={weightFormData.category}
                    onChange={(e) => setWeightFormData({ ...weightFormData, category: e.target.value })}
                  >
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>SKU</label>
                  <input
                    type="text"
                    value={weightFormData.sku}
                    onChange={(e) => setWeightFormData({ ...weightFormData, sku: e.target.value })}
                    placeholder="Auto if empty"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purity</label>
                  <select
                    value={weightFormData.purity}
                    onChange={(e) => setWeightFormData({ ...weightFormData, purity: e.target.value })}
                  >
                    <option value="24K">24K</option>
                    <option value="22K">22K</option>
                    <option value="18K">18K</option>
                    <option value="14K">14K</option>
                    <option value="Silver 925">Silver 925</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Total Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={weightFormData.totalWeight}
                    onChange={(e) => setWeightFormData({ ...weightFormData, totalWeight: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Purchase Price (₹/g)</label>
                  <input
                    type="number"
                    value={weightFormData.purchasePrice}
                    onChange={(e) => setWeightFormData({ ...weightFormData, purchasePrice: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Selling Price (₹/g)</label>
                  <input
                    type="number"
                    value={weightFormData.sellingPrice}
                    onChange={(e) => setWeightFormData({ ...weightFormData, sellingPrice: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowWeightModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isWeightSubmitting}>
                  {isWeightSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BarcodePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        products={products.filter(p => selectedIds.includes(p._id))}
      />
    </div>
  );
};

export default Products;
