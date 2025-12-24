import React, { useState, useEffect } from 'react';
import {
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
  FiPackage,
  FiAlertCircle,
  FiActivity,
  FiCreditCard,
  FiRefreshCw
} from 'react-icons/fi';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [orderMetrics, setOrderMetrics] = useState(null);
  const [deliveryAlerts, setDeliveryAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCashUsage, setShowCashUsage] = useState(false);
  const [showProfitDetail, setShowProfitDetail] = useState(false);
  const [profitDetail, setProfitDetail] = useState(null);
  const [profitTitle, setProfitTitle] = useState('');
  const [cashLedger, setCashLedger] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    fetchOrderData();
  }, []);

  const fetchOrderData = async () => {
    try {
        const [metricsRes, alertsRes] = await Promise.all([
            api.get('/api/orders/metrics/dashboard'),
            api.get('/api/orders/alerts/delivery')
        ]);
        setOrderMetrics(metricsRes.data);
        setDeliveryAlerts(alertsRes.data);
    } catch (error) {
        console.error("Failed to fetch order data", error);
    }
  };
  
  const fetchCashLedger = async () => {
    try {
      setLoadingLedger(true);
      const res = await api.get('/api/dashboard/cash-ledger', { params: { limit: 100 } });
      setCashLedger(res.data);
    } catch (error) {
      console.error("Failed to fetch cash ledger", error);
    } finally {
      setLoadingLedger(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/api/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="dashboard-error">Failed to load data</div>;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const moneyFlowCards = [
    {
      title: 'Total Cash in Shop',
      value: formatCurrency(stats.totalCashInShop),
      icon: FiDollarSign,
      color: '#10b981', // Green
      bgColor: '#ecfdf5'
    },
    {
      title: 'Bank Balance',
      value: formatCurrency(stats.bankBalance),
      icon: FiCreditCard,
      color: '#3b82f6', // Blue
      bgColor: '#eff6ff'
    },
    {
      title: 'Online Payments',
      value: formatCurrency(stats.onlinePayments),
      icon: FiActivity,
      color: '#8b5cf6', // Purple
      bgColor: '#f5f3ff'
    }
  ];

  const sourceData = [
    { name: 'Sales', value: stats.moneySource.sales },
    { name: 'Old Gold Buy/Exchange', value: stats.moneySource.oldGold },
    { name: 'Customer Payments', value: stats.moneySource.customerPayments },
    { name: 'Advances', value: stats.moneySource.advances }
  ];

  const usageData = [
    { name: 'Purchases', value: stats.moneyUsage.purchases },
    { name: 'Expenses', value: stats.moneyUsage.expenses }
  ];

  const COLORS = ['#D4AF37', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Complete Money Flow & Business Overview</p>
      </div>

      {/* Money Flow Section */}
      <h2 className="section-title">Money Flow</h2>
      <div className="stats-grid">
        {moneyFlowCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className="stat-card"
              style={{ borderTop: `4px solid ${card.color}`, cursor: index === 0 ? 'pointer' : 'default' }}
              onClick={() => { if (index === 0) { setShowCashUsage(true); fetchCashLedger(); } }}
            >
              <div className="stat-card-header">
                <div className="stat-icon" style={{ backgroundColor: card.bgColor, color: card.color }}>
                  <Icon />
                </div>
              </div>
              <div className="stat-card-body">
                <h3>{card.title}</h3>
                <p className="stat-value" style={{ color: card.color }}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Money Source Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sourceData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {sourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Money Usage / Outflow</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#ef4444" name="Amount (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


      {/* Order Management Section */}
      {orderMetrics && (
        <>
            <h2 className="section-title" style={{ marginTop: '2rem' }}>Order Management</h2>
            
            {/* Delivery Alerts */}
            {deliveryAlerts.length > 0 && (
                <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {deliveryAlerts.map(alert => (
                        <div key={alert._id} style={{ 
                            padding: '10px 15px', 
                            borderRadius: '8px', 
                            backgroundColor: new Date(alert.expectedDeliveryDate) < new Date() ? '#fee2e2' : '#fef3c7',
                            color: new Date(alert.expectedDeliveryDate) < new Date() ? '#991b1b' : '#92400e',
                            border: `1px solid ${new Date(alert.expectedDeliveryDate) < new Date() ? '#fecaca' : '#fde68a'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FiAlertCircle />
                                <div>
                                    <strong>{new Date(alert.expectedDeliveryDate) < new Date() ? 'Overdue' : 'Due Soon'}:</strong> Order #{alert.orderNumber} for {alert.customerDetails.name}
                                </div>
                            </div>
                            <div>{new Date(alert.expectedDeliveryDate).toLocaleDateString()}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                   <div className="stat-card-body">
                      <h3>Orders Today</h3>
                      <p className="stat-value">{orderMetrics.ordersToday}</p>
                   </div>
                </div>
                <div className="stat-card">
                   <div className="stat-card-body">
                      <h3>Pending Balance</h3>
                      <p className="stat-value" style={{ color: '#ef4444' }}>{formatCurrency(orderMetrics.pendingBalance)}</p>
                      <p className="stat-change">To be collected</p>
                   </div>
                </div>
                <div className="stat-card">
                   <div className="stat-card-body">
                      <h3>Total Advance</h3>
                      <p className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(orderMetrics.totalAdvance)}</p>
                      <p className="stat-change">Collected</p>
                   </div>
                </div>
                 <div className="stat-card">
                   <div className="stat-card-body">
                      <h3>Near Delivery</h3>
                      <p className="stat-value" style={{ color: '#f59e0b' }}>{orderMetrics.nearDelivery}</p>
                      <p className="stat-change">Within 24 hours</p>
                   </div>
                </div>
            </div>
            
             <div className="charts-grid" style={{ marginTop: '20px' }}>
                <div className="chart-card">
                  <h3>Order Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={orderMetrics.statusCounts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="_id" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>
        </>
      )}

      {/* Sales & Inventory Section */}
      <h2 className="section-title" style={{ marginTop: '2rem' }}>Sales & Inventory</h2>
      <div className="stats-grid">
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Today's Sales</h3>
              <p className="stat-value">{formatCurrency(stats.todaySales)}</p>
              <p className="stat-change">{stats.todaySalesCount} orders</p>
           </div>
        </div>
        <div className="stat-card" onClick={() => { setProfitDetail(stats.todayNetProfitDetail); setProfitTitle("Today's Net Profit Detail"); setShowProfitDetail(true); }}>
           <div className="stat-card-body">
              <h3>Today's Net Profit</h3>
              <p className="stat-value">{formatCurrency(stats.todayNetProfit || 0)}</p>
              <p className="stat-change">Revenue: {formatCurrency(stats.todayRevenue || 0)} | COGS: {formatCurrency(stats.todayCogs || 0)} | Expenses: {formatCurrency(stats.todayExpenses || 0)}</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Monthly Sales</h3>
              <p className="stat-value">{formatCurrency(stats.monthlySales)}</p>
              <p className="stat-change">{stats.monthlySalesCount} orders</p>
           </div>
        </div>
        <div className="stat-card" onClick={() => { setProfitDetail(stats.monthlyNetProfitDetail); setProfitTitle("Monthly Net Profit Detail"); setShowProfitDetail(true); }}>
           <div className="stat-card-body">
              <h3>Monthly Net Profit</h3>
              <p className="stat-value">{formatCurrency(stats.monthlyNetProfit || 0)}</p>
              <p className="stat-change">Revenue: {formatCurrency(stats.monthlyRevenue || 0)} | COGS: {formatCurrency(stats.monthlyCogs || 0)} | Expenses: {formatCurrency(stats.monthlyExpenses || 0)}</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Total Stock Value</h3>
              <p className="stat-value">{formatCurrency(stats.totalStockValue)}</p>
              <p className="stat-change">{stats.stockValue.length} categories</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Total Gold Stock Weight</h3>
              <p className="stat-value">{(stats.weights?.gold || 0).toFixed(2)} g</p>
              <p className="stat-change">Net weight × Quantity</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Total Silver Stock Weight</h3>
              <p className="stat-value">{(stats.weights?.silver || 0).toFixed(2)} g</p>
              <p className="stat-change">Net weight × Quantity</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Old Gold Weight</h3>
              <p className="stat-value">{(stats.oldMetalWeights?.gold || 0).toFixed(2)} g</p>
              <p className="stat-change">Pending/Adjusted records</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Old Silver Weight</h3>
              <p className="stat-value">{(stats.oldMetalWeights?.silver || 0).toFixed(2)} g</p>
              <p className="stat-change">Pending/Adjusted records</p>
           </div>
        </div>
        <div className="stat-card">
           <div className="stat-card-body">
              <h3>Pending Dues</h3>
              <p className="stat-value text-red">{formatCurrency(stats.pendingDues)}</p>
              <p className="stat-change">Outstanding</p>
           </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Sales Trend (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2} name="Sales (₹)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {showCashUsage && (
        <div className="ledger-modal-overlay" onClick={() => setShowCashUsage(false)}>
          <div className="ledger-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ledger-modal-header">
              <h2>Total Cash in Shop — Detailed Ledger</h2>
              <button className="ledger-modal-close" onClick={() => setShowCashUsage(false)}>×</button>
            </div>
            <div className="ledger-body">
              <div className="ledger-grid">
                <div>
                  <h3>Cash Inflows (Source)</h3>
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cashLedger?.inflows?.byCategory || []).map((row, i) => (
                        <tr key={i}>
                          <td>{row.category}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                      {(!cashLedger || (cashLedger.inflows?.byCategory || []).length === 0) && (
                        <tr><td colSpan="2" style={{ textAlign: 'center', color: '#666' }}>No inflows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3>Cash Outflows (Usage)</h3>
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>Destination</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cashLedger?.outflows?.byCategory || []).map((row, i) => (
                        <tr key={i}>
                          <td>{row.category}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                      {(!cashLedger || (cashLedger.outflows?.byCategory || []).length === 0) && (
                        <tr><td colSpan="2" style={{ textAlign: 'center', color: '#666' }}>No outflows</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <h3 style={{ marginTop: '1rem' }}>Recent Cash Movements</h3>
              <div className="ledger-grid">
                <div>
                  <h4>Inflows</h4>
                  {(cashLedger?.inflows?.details || []).slice(0, 10).map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      <div>
                        <div>{t.category}{t.referenceLabel ? ` • ${t.referenceLabel}` : ''}</div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>{new Date(t.date).toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>{formatCurrency(t.amount)}</div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>{t.description}</div>
                      </div>
                    </div>
                  ))}
                  {(!cashLedger || (cashLedger.inflows?.details || []).length === 0) && (
                    <div style={{ color: '#666' }}>No recent cash inflows</div>
                  )}
                </div>
                <div>
                  <h4>Outflows</h4>
                  {(cashLedger?.outflows?.details || []).slice(0, 10).map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #eee' }}>
                      <div>
                        <div>{t.category}{t.referenceLabel ? ` • ${t.referenceLabel}` : ''}</div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>{new Date(t.date).toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>{formatCurrency(t.amount)}</div>
                        <div style={{ fontSize: '0.9rem', color: '#666' }}>{t.description}</div>
                      </div>
                    </div>
                  ))}
                  {(!cashLedger || (cashLedger.outflows?.details || []).length === 0) && (
                    <div style={{ color: '#666' }}>No recent cash outflows</div>
                  )}
                </div>
              </div>
              
              <h3 style={{ marginTop: '1rem' }}>Transaction Details</h3>
              {loadingLedger && <div style={{ color: '#666' }}>Loading ledger…</div>}
              {!loadingLedger && cashLedger && (
                <table className="ledger-details-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashLedger.inflows.details.map((t, i) => (
                      <tr key={`in-${i}`}>
                        <td>In</td>
                        <td>{t.category}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(t.amount)}</td>
                        <td>{t.reference?.model} {t.referenceLabel ? `#${t.referenceLabel}` : ''}</td>
                        <td>{new Date(t.date).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    {cashLedger.outflows.details.map((t, i) => (
                      <tr key={`out-${i}`}>
                        <td>Out</td>
                        <td>{t.category}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(t.amount)}</td>
                        <td>{t.reference?.model} {t.referenceLabel ? `#${t.referenceLabel}` : ''}</td>
                        <td>{new Date(t.date).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowCashUsage(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {showProfitDetail && profitDetail && (
        <div className="modal-overlay" onClick={() => setShowProfitDetail(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{profitTitle}</h2>
              <button className="modal-close" onClick={() => setShowProfitDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              <h3>Revenue Breakdown</h3>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr><td>Making Charges</td><td style={{ textAlign: 'right' }}>{formatCurrency(profitDetail.revenueBreakdown.makingCharges || 0)}</td></tr>
                  <tr><td>Wastage</td><td style={{ textAlign: 'right' }}>{formatCurrency(profitDetail.revenueBreakdown.wastage || 0)}</td></tr>
                  <tr><td>Discounts</td><td style={{ textAlign: 'right' }}>{formatCurrency(profitDetail.revenueBreakdown.discounts || 0)}</td></tr>
                  <tr><td>Old Gold Adjustment</td><td style={{ textAlign: 'right' }}>{formatCurrency(profitDetail.revenueBreakdown.oldGoldAdjustment || 0)}</td></tr>
                </tbody>
              </table>
              
              <h3 style={{ marginTop: '1rem' }}>Sales by Category</h3>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Sales</th>
                    <th>COGS</th>
                  </tr>
                </thead>
                <tbody>
                  {(profitDetail.salesByCategory || []).map((row, i) => (
                    <tr key={i}>
                      <td>{row.category || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(row.salesAmount || 0)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(row.cogsAmount || 0)}</td>
                    </tr>
                  ))}
                  {(!profitDetail.salesByCategory || profitDetail.salesByCategory.length === 0) && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: '#666' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
              
              <h3 style={{ marginTop: '1rem' }}>Expenses by Category</h3>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(profitDetail.expensesByCategory || []).map((row, i) => (
                    <tr key={i}>
                      <td>{row.category || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(row.total || 0)}</td>
                    </tr>
                  ))}
                  {(!profitDetail.expensesByCategory || profitDetail.expensesByCategory.length === 0) && (
                    <tr><td colSpan="2" style={{ textAlign: 'center', color: '#666' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowProfitDetail(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
