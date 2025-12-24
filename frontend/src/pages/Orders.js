import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiEye, FiFilter } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Orders.css';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      
      const response = await api.get('/api/orders', { params });
      setOrders(response.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    return `status-badge status-${status.toLowerCase()}`;
  };

  const getPaymentClass = (status) => {
    return `payment-${status.toLowerCase()}`;
  };

  return (
    <div className="orders-container">
      <div className="orders-header">
        <h2>Order Management</h2>
        <button className="add-btn" onClick={() => navigate('/orders/create')}>
          <FiPlus /> New Order
        </button>
      </div>

      <div className="orders-filters">
        <div className="search-bar">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by Order #, Name or Phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <FiFilter />
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="READY">Ready</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="orders-table-container">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
        ) : (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Expected Delivery</th>
                <th>Total</th>
                <th>Advance</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No orders found</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id}>
                    <td>{order.orderNumber}</td>
                    <td>
                      <div>{order.customerDetails.name}</div>
                      <small style={{ color: 'var(--text-secondary)' }}>{order.customerDetails.phone}</small>
                    </td>
                    <td>{order.items.length} items</td>
                    <td>{new Date(order.expectedDeliveryDate).toLocaleDateString()}</td>
                    <td>₹{order.totalAmount.toLocaleString()}</td>
                    <td>₹{order.advanceAmount.toLocaleString()}</td>
                    <td style={{ fontWeight: 'bold', color: order.remainingAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      ₹{order.remainingAmount.toLocaleString()}
                    </td>
                    <td>
                      <span className={getStatusClass(order.orderStatus)}>
                        {order.orderStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={getPaymentClass(order.paymentStatus)}>
                        {order.paymentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="action-btn"
                        onClick={() => navigate(`/orders/${order._id}`)}
                        title="View Details"
                      >
                        <FiEye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Orders;
