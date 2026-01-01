import React, { useState, useEffect } from 'react';
import { FiSave, FiRefreshCw, FiUser, FiLock, FiSettings, FiUsers, FiTrash2, FiEdit2, FiPlus, FiX } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('gold-price');
  const [goldPrice, setGoldPrice] = useState({
    rate24K: '',
    rate22K: '',
    rate18K: '',
    gstPercent: '3'
  });
  const [shopDetails, setShopDetails] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    gstNumber: '',
    panNumber: ''
  });
  const [invoiceSettings, setInvoiceSettings] = useState({
    footerText: 'Thank you for your business!',
    showGST: true,
    showTerms: true,
    termsText: 'Goods once sold will not be taken back or exchanged.'
  });
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'salesman',
    phone: ''
  });
  const [loading, setLoading] = useState(true);

  // Loading states for actions
  const [isSubmittingGold, setIsSubmittingGold] = useState(false);
  const [isFetchingGold, setIsFetchingGold] = useState(false);
  const [isSubmittingShop, setIsSubmittingShop] = useState(false);
  const [isSubmittingInvoiceSettings, setIsSubmittingInvoiceSettings] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    fetchSettings();
    fetchUserProfile();
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const [goldRes, settingsRes] = await Promise.all([
        api.get('/api/gold-price'),
        api.get('/api/settings')
      ]);

      setGoldPrice({
        rate24K: goldRes.data.rate24K,
        rate22K: goldRes.data.rate22K,
        rate18K: goldRes.data.rate18K,
        gstPercent: goldRes.data.gstPercent || '3'
      });

      if (settingsRes.data) {
        if (settingsRes.data.shopDetails) {
          setShopDetails(prev => ({ ...prev, ...settingsRes.data.shopDetails }));
        }
        if (settingsRes.data.invoiceSettings) {
          setInvoiceSettings(prev => ({ ...prev, ...settingsRes.data.invoiceSettings }));
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/api/users/me');
      setUserProfile({
        name: response.data.name,
        email: response.data.email,
        phone: response.data.phone || ''
      });
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error(error);
      if (error.response?.status !== 403) {
        toast.error('Failed to load users');
      }
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingUser) return;
    try {
      setIsSubmittingUser(true);
      if (editingUser) {
        await api.put(`/api/users/${editingUser._id}`, {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          phone: userData.phone
        });
        toast.success('User updated successfully');
      } else {
        await api.post('/api/auth/register', userData);
        toast.success('User created successfully');
      }
      setShowUserModal(false);
      resetUserForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save user');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (deletingUserId) return;
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        setDeletingUserId(userId);
        await api.delete(`/api/users/${userId}`);
        toast.success('User deleted successfully');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete user');
      } finally {
        setDeletingUserId(null);
      }
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserData({
      name: '',
      email: '',
      password: '',
      role: 'salesman',
      phone: ''
    });
  };

  const openEditUserModal = (user) => {
    setEditingUser(user);
    setUserData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || ''
    });
    setShowUserModal(true);
  };

  const handleGoldPriceSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingGold) return;
    try {
      setIsSubmittingGold(true);
      await api.post('/api/gold-price', goldPrice);
      toast.success('Gold price updated successfully');
      fetchSettings();
    } catch (error) {
      toast.error('Failed to update gold price');
    } finally {
      setIsSubmittingGold(false);
    }
  };

  const handleFetchFromAPI = async () => {
    if (isFetchingGold) return;
    try {
      setIsFetchingGold(true);
      const response = await api.post('/api/gold-price/fetch');
      setGoldPrice({
        rate24K: response.data.rate24K,
        rate22K: response.data.rate22K,
        rate18K: response.data.rate18K,
        gstPercent: response.data.gstPercent || '3'
      });
      toast.success('Gold price fetched from API');
    } catch (error) {
      toast.error('Failed to fetch gold price from API');
    } finally {
      setIsFetchingGold(false);
    }
  };

  const handleShopDetailsSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingShop) return;
    try {
      setIsSubmittingShop(true);
      await api.put('/api/settings', { shopDetails });
      toast.success('Shop details saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save shop details');
    } finally {
      setIsSubmittingShop(false);
    }
  };

  const handleInvoiceSettingsSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingInvoiceSettings) return;
    try {
      setIsSubmittingInvoiceSettings(true);
      await api.put('/api/settings', { invoiceSettings });
      toast.success('Invoice settings saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save invoice settings');
    } finally {
      setIsSubmittingInvoiceSettings(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (isSubmittingProfile) return;
    try {
      setIsSubmittingProfile(true);
      await api.put('/api/users/me', userProfile);
      toast.success('Profile updated successfully');
      fetchUserProfile();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (isSubmittingPassword) return;
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setIsSubmittingPassword(true);
      await api.put('/api/users/me/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage system settings and preferences</p>
      </div>

      <div className="settings-tabs">
        <button
          className={activeTab === 'gold-price' ? 'active' : ''}
          onClick={() => setActiveTab('gold-price')}
        >
          <FiSettings /> Gold Price
        </button>
        <button
          className={activeTab === 'shop' ? 'active' : ''}
          onClick={() => setActiveTab('shop')}
        >
          <FiSettings /> Shop Details
        </button>
        <button
          className={activeTab === 'invoice' ? 'active' : ''}
          onClick={() => setActiveTab('invoice')}
        >
          <FiSettings /> Invoice Format
        </button>
        <button
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          <FiUser /> Profile
        </button>
        {user?.role === 'admin' && (
          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            <FiUsers /> Users
          </button>
        )}
        <button
          className={activeTab === 'password' ? 'active' : ''}
          onClick={() => setActiveTab('password')}
        >
          <FiLock /> Change Password
        </button>
      </div>

      {/* Gold Price Settings */}
      {activeTab === 'gold-price' && (
        <div className="settings-card">
          <h2>Gold Price Settings</h2>
          <form onSubmit={handleGoldPriceSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>24K Rate (₹/g) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={goldPrice.rate24K}
                  onChange={(e) => setGoldPrice({ ...goldPrice, rate24K: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>22K Rate (₹/g) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={goldPrice.rate22K}
                  onChange={(e) => setGoldPrice({ ...goldPrice, rate22K: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>18K Rate (₹/g) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={goldPrice.rate18K}
                  onChange={(e) => setGoldPrice({ ...goldPrice, rate18K: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>GST Percent (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={goldPrice.gstPercent}
                  onChange={(e) => setGoldPrice({ ...goldPrice, gstPercent: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleFetchFromAPI} disabled={isFetchingGold}>
                <FiRefreshCw className={isFetchingGold ? 'spin' : ''} /> {isFetchingGold ? 'Fetching...' : 'Fetch from API'}
              </button>
              <button type="submit" className="btn-primary" disabled={isSubmittingGold}>
                <FiSave /> {isSubmittingGold ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shop Details */}
      {activeTab === 'shop' && (
        <div className="settings-card">
          <h2>Shop Details</h2>
          <form onSubmit={handleShopDetailsSubmit}>
            <div className="form-group">
              <label>Shop Name *</label>
              <input
                type="text"
                value={shopDetails.name}
                onChange={(e) => setShopDetails({ ...shopDetails, name: e.target.value })}
                required
                placeholder="Your Shop Name"
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <textarea
                value={shopDetails.address}
                onChange={(e) => setShopDetails({ ...shopDetails, address: e.target.value })}
                rows="3"
                placeholder="Shop address"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={shopDetails.phone}
                  onChange={(e) => setShopDetails({ ...shopDetails, phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={shopDetails.email}
                  onChange={(e) => setShopDetails({ ...shopDetails, email: e.target.value })}
                  placeholder="Email address"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>GST Number</label>
                <input
                  type="text"
                  value={shopDetails.gstNumber}
                  onChange={(e) => setShopDetails({ ...shopDetails, gstNumber: e.target.value })}
                  placeholder="GST Number"
                />
              </div>
              <div className="form-group">
                <label>PAN Number</label>
                <input
                  type="text"
                  value={shopDetails.panNumber}
                  onChange={(e) => setShopDetails({ ...shopDetails, panNumber: e.target.value })}
                  placeholder="PAN Number"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmittingShop}>
                <FiSave /> {isSubmittingShop ? 'Saving...' : 'Save Shop Details'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoice Settings */}
      {activeTab === 'invoice' && (
        <div className="settings-card">
          <h2>Invoice Format Settings</h2>
          <form onSubmit={handleInvoiceSettingsSubmit}>
            <div className="form-group">
              <label>Footer Text</label>
              <input
                type="text"
                value={invoiceSettings.footerText}
                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerText: e.target.value })}
                placeholder="Thank you for your business!"
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showGST}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showGST: e.target.checked })}
                />
                Show GST on Invoice
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={invoiceSettings.showTerms}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showTerms: e.target.checked })}
                />
                Show Terms & Conditions
              </label>
            </div>
            {invoiceSettings.showTerms && (
              <div className="form-group">
                <label>Terms & Conditions Text</label>
                <textarea
                  value={invoiceSettings.termsText}
                  onChange={(e) => setInvoiceSettings({ ...invoiceSettings, termsText: e.target.value })}
                  rows="4"
                  placeholder="Terms and conditions text"
                />
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmittingInvoiceSettings}>
                <FiSave /> {isSubmittingInvoiceSettings ? 'Saving...' : 'Save Invoice Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <div className="settings-card">
          <h2>Admin Profile</h2>
          <form onSubmit={handleProfileUpdate}>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                value={userProfile.email}
                onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={userProfile.phone}
                onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmittingProfile}>
                <FiSave /> {isSubmittingProfile ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Management */}
      {activeTab === 'users' && user?.role === 'admin' && (
        <div className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2>User Management</h2>
            <button className="btn-primary" onClick={() => { resetUserForm(); setShowUserModal(true); }}>
              <FiPlus /> Add User
            </button>
          </div>

          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`role-badge ${u.role}`}>
                        {u.role.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>{u.phone || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon" 
                          onClick={() => openEditUserModal(u)}
                          title="Edit User"
                        >
                          <FiEdit2 />
                        </button>
                        {u._id !== user._id && (
                          <button 
                            className="btn-icon delete" 
                            onClick={() => handleDeleteUser(u._id)}
                            title="Delete User"
                            disabled={deletingUserId === u._id}
                            style={{ opacity: deletingUserId === u._id ? 0.5 : 1, cursor: deletingUserId === u._id ? 'not-allowed' : 'pointer' }}
                          >
                            {deletingUserId === u._id ? <FiRefreshCw className="spin" /> : <FiTrash2 />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Password Change */}
      {activeTab === 'password' && (
        <div className="settings-card">
          <h2>Change Password</h2>
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Current Password *</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
                placeholder="Enter current password"
              />
            </div>
            <div className="form-group">
              <label>New Password *</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                placeholder="Enter new password (min 6 characters)"
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Confirm New Password *</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={isSubmittingPassword}>
                <FiLock /> {isSubmittingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button className="close-btn" onClick={() => setShowUserModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={userData.name}
                  onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={userData.email}
                  onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                  required
                />
              </div>
              {!editingUser && (
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={userData.password}
                    onChange={(e) => setUserData({ ...userData, password: e.target.value })}
                    required={!editingUser}
                    minLength={6}
                  />
                </div>
              )}
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={userData.role}
                  onChange={(e) => setUserData({ ...userData, role: e.target.value })}
                  className="form-select"
                  style={{
                    padding: '0.75rem',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '1rem',
                    width: '100%'
                  }}
                >
                  <option value="salesman">Salesman</option>
                  <option value="accountant">Accountant</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={userData.phone}
                  onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmittingUser}>
                  {isSubmittingUser ? 'Processing...' : (editingUser ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
