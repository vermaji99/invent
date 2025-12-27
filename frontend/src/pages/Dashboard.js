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
  const [profitSummary, setProfitSummary] = useState(null);
  const [cashLedger, setCashLedger] = useState(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsColumns, setDetailsColumns] = useState([]);
  const [detailsRows, setDetailsRows] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
    fetchOrderData();
  }, []);

  useEffect(() => {
    const anyModalOpen = showProfitDetail || showCashUsage || showDetails;
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowProfitDetail(false);
        setShowCashUsage(false);
        setShowDetails(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [showProfitDetail, showCashUsage, showDetails]);

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
  
  const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const toYMD = (d) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  };
  const startEndFor = (type) => {
    const now = new Date();
    if (type === 'today') {
      return { start: toYMD(now), end: toYMD(now) };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toYMD(start), end: toYMD(end) };
  };
  const openDetails = (title, columns, rows) => {
    setDetailsTitle(title);
    setDetailsColumns(columns);
    setDetailsRows(rows);
    setShowDetails(true);
  };
  const fetchSalesDetails = async (range) => {
    try {
      setLoadingDetails(true);
      const { start, end } = startEndFor(range);
      const res = await api.get('/api/invoices', { params: { startDate: start, endDate: end } });
      const rows = (res.data || []).map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer?.name || '',
        items: (inv.items || []).length,
        subtotal: inv.subtotal || 0,
        discount: inv.discount || 0,
        gst: inv.gst || 0,
        total: inv.total || 0,
        paidAmount: inv.paidAmount || 0,
        dueAmount: inv.dueAmount || 0,
        date: inv.createdAt
      }));
      openDetails(range === 'today' ? "Today's Sales — Details" : 'Monthly Sales — Details', [
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'customer', label: 'Customer' },
        { key: 'items', label: 'Items' },
        { key: 'subtotal', label: 'Subtotal', fmt: fmtINR },
        { key: 'discount', label: 'Discount', fmt: fmtINR },
        { key: 'gst', label: 'GST', fmt: fmtINR },
        { key: 'total', label: 'Total', fmt: fmtINR },
        { key: 'paidAmount', label: 'Paid', fmt: fmtINR },
        { key: 'dueAmount', label: 'Due', fmt: fmtINR },
        { key: 'date', label: 'Date', fmt: (v) => new Date(v).toLocaleString('en-IN') }
      ], rows);
    } catch (e) {
      toast.error('Failed to load sales details');
    } finally {
      setLoadingDetails(false);
    }
  };
  const fetchStockDetails = async () => {
    try {
      setLoadingDetails(true);
      const res = await api.get('/api/products');
      const rows = (res.data || []).map(p => ({
        name: p.name,
        category: p.category,
        quantity: p.quantity || 0,
        netWeight: p.netWeight || 0,
        purchasePrice: p.purchasePrice || 0,
        totalValue: (p.purchasePrice || 0) * (p.quantity || 0)
      }));
      openDetails('Total Stock Value — Details', [
        { key: 'name', label: 'Product' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Qty' },
        { key: 'netWeight', label: 'Net Wt (g)' },
        { key: 'purchasePrice', label: 'Purchase Price', fmt: fmtINR },
        { key: 'totalValue', label: 'Total Value', fmt: fmtINR }
      ], rows);
    } catch (e) {
      toast.error('Failed to load stock details');
    } finally {
      setLoadingDetails(false);
    }
  };
  const fetchWeightDetails = async (category) => {
    try {
      setLoadingDetails(true);
      const res = await api.get('/api/products', { params: { category } });
      const rows = (res.data || []).map(p => ({
        name: p.name,
        quantity: p.quantity || 0,
        netWeight: p.netWeight || 0,
        totalNet: (p.netWeight || 0) * (p.quantity || 0)
      }));
      openDetails(`Total ${category} Stock Weight — Details`, [
        { key: 'name', label: 'Product' },
        { key: 'quantity', label: 'Qty' },
        { key: 'netWeight', label: 'Net Wt (g)' },
        { key: 'totalNet', label: 'Net×Qty (g)' }
      ], rows);
    } catch (e) {
      toast.error('Failed to load weight details');
    } finally {
      setLoadingDetails(false);
    }
  };
  const fetchOldMetalDetails = async (type) => {
    try {
      setLoadingDetails(true);
      const res = await api.get('/api/old-gold');
      const rowsAll = (res.data || []).map(og => ({
        customer: og.customer?.name || '',
        weight: og.weight || 0,
        purity: og.purity || '',
        rate: og.rate || 0,
        totalValue: og.totalValue || 0,
        status: og.status || '',
        adjustedInvoice: og.adjustedAgainst?.invoice?.invoiceNumber || '',
        date: og.createdAt
      }));
      const rows = rowsAll.filter(r => {
        const p = String(r.purity || '').toUpperCase();
        if (type === 'Gold') return /K\b/.test(p);
        return /925/.test(p);
      });
      openDetails(`Old ${type} Weight — Details`, [
        { key: 'customer', label: 'Customer' },
        { key: 'weight', label: 'Weight (g)' },
        { key: 'purity', label: 'Purity' },
        { key: 'rate', label: 'Rate', fmt: fmtINR },
        { key: 'totalValue', label: 'Total Value', fmt: fmtINR },
        { key: 'status', label: 'Status' },
        { key: 'adjustedInvoice', label: 'Adjusted Invoice #' },
        { key: 'date', label: 'Date', fmt: (v) => new Date(v).toLocaleString('en-IN') }
      ], rows);
    } catch (e) {
      toast.error('Failed to load old metal details');
    } finally {
      setLoadingDetails(false);
    }
  };
  const fetchPendingDues = async () => {
    try {
      setLoadingDetails(true);
      const [pendingRes, partialRes] = await Promise.all([
        api.get('/api/invoices', { params: { status: 'Pending' } }),
        api.get('/api/invoices', { params: { status: 'Partial' } })
      ]);
      const merge = [...(pendingRes.data || []), ...(partialRes.data || [])];
      const rows = merge.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer?.name || '',
        total: inv.total || 0,
        paidAmount: inv.paidAmount || 0,
        dueAmount: inv.dueAmount || 0,
        status: inv.status || '',
        date: inv.createdAt
      }));
      openDetails('Pending Dues — Details', [
        { key: 'invoiceNumber', label: 'Invoice #' },
        { key: 'customer', label: 'Customer' },
        { key: 'total', label: 'Total', fmt: fmtINR },
        { key: 'paidAmount', label: 'Paid', fmt: fmtINR },
        { key: 'dueAmount', label: 'Due', fmt: fmtINR },
        { key: 'status', label: 'Status' },
        { key: 'date', label: 'Date', fmt: (v) => new Date(v).toLocaleString('en-IN') }
      ], rows);
    } catch (e) {
      toast.error('Failed to load pending dues');
    } finally {
      setLoadingDetails(false);
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
        <div className="stat-card" onClick={() => fetchSalesDetails('today')}>
           <div className="stat-card-body">
              <h3>Today's Sales</h3>
              <p className="stat-value">{formatCurrency(stats.todaySales)}</p>
              <p className="stat-change">{stats.todaySalesCount} orders</p>
           </div>
        </div>
        <div
          className="profit-card"
          onClick={() => {
            setProfitDetail(stats.todayNetProfitDetail);
            setProfitTitle("Today's Net Profit Detail");
            setProfitSummary({
              revenue: stats.todayRevenue || 0,
              cogs: stats.todayCogs || 0,
              expenses: stats.todayExpenses || 0,
              net: stats.todayNetProfit || 0
            });
            setShowProfitDetail(true);
          }}
        >
          <div className="profit-card-header">Today's Net Profit</div>
          <div className="profit-card-body">
            <div className="profit-main">{formatCurrency(stats.todayNetProfit || 0)}</div>
            <div className="profit-kpi-grid">
              <div className="profit-kpi">
                <div>Revenue</div>
                <div className="num">{formatCurrency(stats.todayRevenue || 0)}</div>
              </div>
              <div className="profit-kpi">
                <div>COGS</div>
                <div className="num">{formatCurrency(stats.todayCogs || 0)}</div>
              </div>
              <div className="profit-kpi">
                <div>Expenses</div>
                <div className="num">{formatCurrency(stats.todayExpenses || 0)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card" onClick={() => fetchSalesDetails('month')}>
           <div className="stat-card-body">
              <h3>Monthly Sales</h3>
              <p className="stat-value">{formatCurrency(stats.monthlySales)}</p>
              <p className="stat-change">{stats.monthlySalesCount} orders</p>
           </div>
        </div>
        <div
          className="profit-card"
          onClick={() => {
            setShowCashUsage(false);
            setProfitDetail(stats.monthlyNetProfitDetail);
            setProfitTitle("Monthly Net Profit Detail");
            setProfitSummary({
              revenue: stats.monthlyRevenue || 0,
              cogs: stats.monthlyCogs || 0,
              expenses: stats.monthlyExpenses || 0,
              net: stats.monthlyNetProfit || 0
            });
            setShowProfitDetail(true);
          }}
        >
          <div className="profit-card-header">Monthly Net Profit</div>
          <div className="profit-card-body">
            <div className="profit-main">{formatCurrency(stats.monthlyNetProfit || 0)}</div>
            <div className="profit-kpi-grid">
              <div className="profit-kpi">
                <div>Revenue</div>
                <div className="num">{formatCurrency(stats.monthlyRevenue || 0)}</div>
              </div>
              <div className="profit-kpi">
                <div>COGS</div>
                <div className="num">{formatCurrency(stats.monthlyCogs || 0)}</div>
              </div>
              <div className="profit-kpi">
                <div>Expenses</div>
                <div className="num">{formatCurrency(stats.monthlyExpenses || 0)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="stat-card" onClick={fetchStockDetails}>
           <div className="stat-card-body">
              <h3>Total Stock Value</h3>
              <p className="stat-value">{formatCurrency(stats.totalStockValue)}</p>
              <p className="stat-change">{stats.stockValue.length} categories</p>
           </div>
        </div>
        <div className="stat-card" onClick={() => fetchWeightDetails('Gold')}>
           <div className="stat-card-body">
              <h3>Total Gold Stock Weight</h3>
              <p className="stat-value">{(stats.weights?.gold || 0).toFixed(2)} g</p>
              <p className="stat-change">Net weight × Quantity</p>
           </div>
        </div>
        <div className="stat-card" onClick={() => fetchWeightDetails('Silver')}>
           <div className="stat-card-body">
              <h3>Total Silver Stock Weight</h3>
              <p className="stat-value">{(stats.weights?.silver || 0).toFixed(2)} g</p>
              <p className="stat-change">Net weight × Quantity</p>
           </div>
        </div>
        <div className="stat-card" onClick={() => fetchOldMetalDetails('Gold')}>
           <div className="stat-card-body">
              <h3>Old Gold Weight</h3>
              <p className="stat-value">{(stats.oldMetalWeights?.gold || 0).toFixed(2)} g</p>
              <p className="stat-change">Pending/Adjusted records</p>
           </div>
        </div>
        <div className="stat-card" onClick={() => fetchOldMetalDetails('Silver')}>
           <div className="stat-card-body">
              <h3>Old Silver Weight</h3>
              <p className="stat-value">{(stats.oldMetalWeights?.silver || 0).toFixed(2)} g</p>
              <p className="stat-change">Pending/Adjusted records</p>
           </div>
        </div>
        <div className="stat-card" onClick={fetchPendingDues}>
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
          <div className="modal-content profit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{profitTitle}</h2>
              <button className="modal-close" onClick={() => setShowProfitDetail(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="profit-summary-grid">
                <div className="summary-card">
                  <div>Revenue</div>
                  <div className="num">{formatCurrency((profitSummary?.revenue) || 0)}</div>
                </div>
                <div className="summary-card">
                  <div>COGS</div>
                  <div className="num">{formatCurrency((profitSummary?.cogs) || 0)}</div>
                </div>
                <div className="summary-card">
                  <div>Expenses</div>
                  <div className="num">{formatCurrency((profitSummary?.expenses) || 0)}</div>
                </div>
                <div className="summary-card">
                  <div>Net Profit</div>
                  <div className="num">{formatCurrency((profitSummary?.net) || 0)}</div>
                </div>
              </div>
              <hr className="section-divider" />
              <h3 className="profit-section-title">Revenue Breakdown</h3>
              <div className="table-responsive">
                <table className="profit-table">
                  <colgroup>
                    <col />
                    <col style={{ width: '220px' }} />
                  </colgroup>
                  <tbody>
                    <tr><td>Making Charges</td><td>{formatCurrency(profitDetail.revenueBreakdown.makingCharges || 0)}</td></tr>
                    <tr><td>Wastage</td><td>{formatCurrency(profitDetail.revenueBreakdown.wastage || 0)}</td></tr>
                    <tr><td>Discounts</td><td>{formatCurrency(profitDetail.revenueBreakdown.discounts || 0)}</td></tr>
                    <tr><td>Old Gold Adjustment</td><td>{formatCurrency(profitDetail.revenueBreakdown.oldGoldAdjustment || 0)}</td></tr>
                  </tbody>
                </table>
              </div>
              <hr className="section-divider" />
              
              <h3 className="profit-section-title">Sales by Category</h3>
              <div className="table-responsive">
                <table className="profit-table">
                  <colgroup>
                    <col />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '220px' }} />
                  </colgroup>
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
                        <td>{formatCurrency(row.salesAmount || 0)}</td>
                        <td>{formatCurrency(row.cogsAmount || 0)}</td>
                      </tr>
                    ))}
                    {(!profitDetail.salesByCategory || profitDetail.salesByCategory.length === 0) && (
                      <tr><td colSpan="3" className="table-empty">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <h3 className="profit-section-title">Expenses by Category</h3>
              <div className="table-responsive">
                <table className="profit-table">
                  <colgroup>
                    <col />
                    <col style={{ width: '220px' }} />
                  </colgroup>
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
                        <td>{formatCurrency(row.total || 0)}</td>
                      </tr>
                    ))}
                    {(!profitDetail.expensesByCategory || profitDetail.expensesByCategory.length === 0) && (
                      <tr><td colSpan="2" className="table-empty">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowProfitDetail(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
      {showDetails && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{detailsTitle}</h2>
              <button className="modal-close" onClick={() => setShowDetails(false)}>×</button>
            </div>
            <div className="modal-body">
              {loadingDetails && <div style={{ color: '#666' }}>Loading…</div>}
              {!loadingDetails && (
                <div className="table-responsive">
                  <table className="profit-table">
                    <thead>
                      <tr>
                        {detailsColumns.map((c, i) => (<th key={i}>{c.label}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailsRows.map((r, ri) => (
                        <tr key={ri}>
                          {detailsColumns.map((c, ci) => {
                            const val = r[c.key];
                            const out = c.fmt ? c.fmt(val) : val;
                            return <td key={ci}>{out}</td>;
                          })}
                        </tr>
                      ))}
                      {detailsRows.length === 0 && (
                        <tr><td colSpan={detailsColumns.length} className="table-empty">No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowDetails(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
