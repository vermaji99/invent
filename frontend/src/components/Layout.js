import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiHome,
  FiPackage,
  FiUsers,
  FiFileText,
  FiShoppingCart,
  FiTruck,
  FiShoppingBag,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX,
  FiSearch,
  FiCreditCard,
  FiClipboard
} from 'react-icons/fi';
import GoldPriceBar from './GoldPriceBar';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const location = useLocation();

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [location]);

  // Handle window resize - keep sidebar closed/state persistent or just rely on manual toggle
  // We removed auto-open logic to support overlay mode
  /*
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  */

  const menuItems = [
    { path: '/', icon: FiHome, label: 'Dashboard' },
    { path: '/orders', icon: FiClipboard, label: 'Orders' },
    { path: '/products', icon: FiPackage, label: 'Inventory' },
    { path: '/billing', icon: FiShoppingCart, label: 'Billing' },
    { path: '/customers', icon: FiUsers, label: 'Customers' },
    { path: '/invoices', icon: FiFileText, label: 'Invoices' },
    { path: '/suppliers', icon: FiTruck, label: 'Suppliers' },
    { path: '/purchases', icon: FiShoppingBag, label: 'Purchases' },
    { path: '/old-gold', icon: FiDollarSign, label: 'Old Gold' },
    { path: '/expenses', icon: FiCreditCard, label: 'Expenses' },
    { path: '/reports', icon: FiBarChart2, label: 'Reports' },
    { path: '/settings', icon: FiSettings, label: 'Settings' }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    document.body.classList.add('motion-override');
    return () => {
      document.body.classList.remove('motion-override');
    };
  }, []);

  return (
    <div className="layout">
      <GoldPriceBar />
      
      <div className="mobile-header">
        <button 
          className="mobile-sidebar-toggle" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <FiMenu />
        </button>
        <div className="mobile-logo">
          <div className="brand-title">VSKK</div>
          <div className="brand-subtitle">Vaibhav Swarn Kala Kendra</div>
        </div>
      </div>

      <div className="layout-container">
        {sidebarOpen && (
          <div 
            className="sidebar-overlay" 
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <div className="logo">
              <div className="brand-title">VSKK</div>
              <div className="brand-subtitle">Vaibhav Swarn Kala Kendra</div>
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>

          <div className="search-bar">
            <FiSearch />
            <input
              type="text"
              placeholder="Quick search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <nav className="sidebar-nav">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                >
                  <Icon />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
              {sidebarOpen && (
                <div className="user-details">
                  <div className="user-name">{user?.name}</div>
                  <div className="user-role">{user?.role}</div>
                </div>
              )}
            </div>
            <button className="logout-btn" onClick={logout}>
              <FiLogOut />
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </aside>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

