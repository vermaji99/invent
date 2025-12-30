import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiDollarSign } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Suppliers.css';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: { street: '', city: '', state: '', pincode: '' },
    gstNumber: '',
    categorySpecializations: []
  });
  const [newSpecialization, setNewSpecialization] = useState({ category: '', material: '' });
  const [filterMaterial, setFilterMaterial] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          supplier.phone.includes(searchTerm);
    const matchesMaterial = filterMaterial === '' || 
                            supplier.categorySpecializations.some(spec => spec.includes(filterMaterial));
    return matchesSearch && matchesMaterial;
  });

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/api/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingSupplier) {
        await api.put(`/api/suppliers/${editingSupplier._id}`, formData);
        toast.success('Supplier updated successfully');
      } else {
        await api.post('/api/suppliers', formData);
        toast.success('Supplier created successfully');
      }
      setShowModal(false);
      setEditingSupplier(null);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (isPaying) return;
    setIsPaying(true);
    if (!selectedSupplier) return;
    
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > selectedSupplier.outstandingAmount) {
      toast.error('Amount cannot exceed outstanding amount');
      return;
    }

    try {
      await api.post('/api/supplier-payments', {
        supplier: selectedSupplier._id,
        amount: amount,
        paymentMode: paymentMode,
        notes: paymentNotes
      });
      
      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully`);
      setShowPaymentModal(false);
      setSelectedSupplier(null);
      setPaymentAmount('');
      setPaymentMode('Cash');
      setPaymentNotes('');
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsPaying(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || { street: '', city: '', state: '', pincode: '' },
      gstNumber: supplier.gstNumber || '',
      categorySpecializations: supplier.categorySpecializations || []
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: { street: '', city: '', state: '', pincode: '' },
      gstNumber: '',
      categorySpecializations: []
    });
    setNewSpecialization({ category: '', material: '' });
  };

  const addSpecialization = () => {
    if (!newSpecialization.category || !newSpecialization.material) {
      toast.error('Please select both category and material');
      return;
    }
    const spec = `${newSpecialization.category} – ${newSpecialization.material}`;
    if (formData.categorySpecializations.includes(spec)) {
      toast.error('This specialization already exists');
      return;
    }
    setFormData({
      ...formData,
      categorySpecializations: [...formData.categorySpecializations, spec]
    });
    setNewSpecialization({ category: '', material: '' });
  };

  const removeSpecialization = (index) => {
    setFormData({
      ...formData,
      categorySpecializations: formData.categorySpecializations.filter((_, i) => i !== index)
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="suppliers-page">
      <div className="page-header">
        <div>
          <h1>Supplier Management</h1>
          <p>Manage your suppliers and vendors</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowModal(true); resetForm(); setEditingSupplier(null); }}>
          <FiPlus /> Add Supplier
        </button>
      </div>

      <div className="suppliers-filters">
        <div className="search-bar">
          <FiSearch />
          <input 
            type="text" 
            placeholder="Search by name or phone..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="filter-select"
          value={filterMaterial}
          onChange={(e) => setFilterMaterial(e.target.value)}
        >
          <option value="">All Materials</option>
          <option value="Gold">Gold</option>
          <option value="Silver">Silver</option>
          <option value="Diamond">Diamond</option>
          <option value="Platinum">Platinum</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading suppliers...</div>
      ) : (
        <div className="suppliers-grid">
          {filteredSuppliers.length === 0 ? (
             <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
               <p>No suppliers found matching your criteria.</p>
             </div>
          ) : (
            filteredSuppliers.map((supplier) => (
            <div key={supplier._id} className="supplier-card">
              <div className="supplier-card-header">
                <h3>{supplier.name}</h3>
                {supplier.categorySpecializations && supplier.categorySpecializations.length > 0 && (
                  <span className="supplier-badge">Specialist</span>
                )}
              </div>
              <p className="supplier-phone">{supplier.phone}</p>
              {supplier.email && <p className="supplier-email">{supplier.email}</p>}
              {supplier.categorySpecializations && supplier.categorySpecializations.length > 0 && (
                <div className="supplier-specializations">
                  <strong>Specializations:</strong>
                  <div className="specializations-tags">
                    {supplier.categorySpecializations.map((spec, idx) => (
                      <span key={idx} className="specialization-tag-small">{spec}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="supplier-stats">
                <div className="stat">
                  <span className="stat-label">Total Purchases</span>
                  <span className="stat-value">{formatCurrency(supplier.totalPurchases || 0)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Outstanding</span>
                  <span className="stat-value">{formatCurrency(supplier.outstandingAmount || 0)}</span>
                </div>
              </div>
              <div className="supplier-actions">
                <button onClick={() => handleEdit(supplier)}>
                  <FiEdit /> Edit
                </button>
              </div>
            </div>
          )))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingSupplier(null); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>GST Number</label>
                <input
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Category Specialization</label>
                <div className="specialization-input">
                  <select
                    value={newSpecialization.category}
                    onChange={(e) => setNewSpecialization({ ...newSpecialization, category: e.target.value })}
                  >
                    <option value="">Select Category</option>
                    <option value="Ring">Ring</option>
                    <option value="Nose Pin">Nose Pin</option>
                    <option value="Bichiya">Bichiya</option>
                    <option value="Earring">Earring</option>
                    <option value="Necklace">Necklace</option>
                    <option value="Bangle">Bangle</option>
                    <option value="Chain">Chain</option>
                    <option value="Pendant">Pendant</option>
                    <option value="Bracelet">Bracelet</option>
                    <option value="Other">Other</option>
                  </select>
                  <select
                    value={newSpecialization.material}
                    onChange={(e) => setNewSpecialization({ ...newSpecialization, material: e.target.value })}
                  >
                    <option value="">Select Material</option>
                    <option value="Gold">Gold</option>
                    <option value="Silver">Silver</option>
                    <option value="Diamond">Diamond</option>
                    <option value="Platinum">Platinum</option>
                  </select>
                  <button type="button" className="btn-add-spec" onClick={addSpecialization}>
                    Add
                  </button>
                </div>
                {formData.categorySpecializations.length > 0 && (
                  <div className="specializations-list">
                    {formData.categorySpecializations.map((spec, index) => (
                      <span key={index} className="specialization-tag">
                        {spec}
                        <button
                          type="button"
                          onClick={() => removeSpecialization(index)}
                          className="remove-spec"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => { setShowModal(false); setEditingSupplier(null); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {editingSupplier ? (isSubmitting ? 'Updating…' : 'Update') : (isSubmitting ? 'Creating…' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;

