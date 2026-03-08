import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { FiFilter, FiRefreshCw } from 'react-icons/fi';
import api from '../utils/api';
import { toast } from 'react-toastify';
import './Reports.css';

const Reports = () => {
  const [profitLoss, setProfitLoss] = useState(null);
  const [stockValuation, setStockValuation] = useState(null);
  const [aging, setAging] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [customerArrears, setCustomerArrears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    category: '',
    customer: ''
  });
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchCustomers();
    fetchReports();
  }, [filters]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/api/customers');
      setCustomers(response.data);
    } catch (error) {
      // Silent fail
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };

      const [plRes, stockRes, agingRes, customersRes] = await Promise.all([
        api.get('/api/reports/profit-loss', { params }),
        api.get('/api/reports/stock-valuation'),
        api.get('/api/reports/aging'),
        api.get('/api/customers')
      ]);

      setProfitLoss(plRes.data);
      setStockValuation(stockRes.data);
      setAging(agingRes.data);

      // Prepare customer arrears data
      const arrearsData = customersRes.data
        .filter(c => c.totalDue > 0)
        .map(c => ({
          name: c.name,
          amount: c.totalDue
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setCustomerArrears(arrearsData);

      // Prepare sales data for chart
      const invoicesRes = await api.get('/api/invoices', { params });
      const salesByDate = {};
      invoicesRes.data.forEach(inv => {
        const date = new Date(inv.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        // Use subtotal (Revenue) instead of total (Payment) to reflect actual sales volume
        salesByDate[date] = (salesByDate[date] || 0) + (inv.subtotal || 0);
      });
      
      const salesChartData = Object.entries(salesByDate)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30); // Last 30 days

      setSalesData(salesChartData);
    } catch (error) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const COLORS = ['#C6FF3A', '#7B61FF', '#FF9F43', '#FFD166', '#FF4D4D', '#00CFE8', '#1B2850'];

  const chartTheme = {
    grid: 'rgba(255, 255, 255, 0.05)',
    text: 'rgba(255, 255, 255, 0.5)',
    tooltip: {
      backgroundColor: '#1A1A1A',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: '#FFFFFF'
    }
  };

  if (loading) {
    return <div className="loading">Loading reports...</div>;
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p>Business insights and performance metrics</p>
        </div>
        <button className="btn-secondary" onClick={fetchReports}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="reports-filters">
        <div className="filter-group">
          <label>Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>
        <div className="filter-group">
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="">All Categories</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Diamond">Diamond</option>
            <option value="Platinum">Platinum</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Customer</label>
          <select
            value={filters.customer}
            onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="reports-grid">
        {/* Profit & Loss */}
        {profitLoss && (
          <div className="report-card pl-card">
            <h2>Profit & Loss Report</h2>
            <div className="pl-summary">
              <div className="pl-item">
                <span>Sales Revenue</span>
                <span className="value">{formatCurrency(profitLoss.sales.revenue)}</span>
              </div>
              <div className="pl-item">
                <span>Gross Profit</span>
                <span className="value text-primary">{formatCurrency(profitLoss.sales.grossProfit)}</span>
              </div>
              <div className="pl-item">
                <span>Operating Expenses</span>
                <span className="value text-danger">{formatCurrency(profitLoss.expenses)}</span>
              </div>
              <div className="pl-item pl-profit">
                <span>Net Profit</span>
                <span className="value highlight">{formatCurrency(profitLoss.netProfit)}</span>
              </div>
            </div>
            
            <div className="pl-breakdown">
              <div className="breakdown-item">
                <span>Making Charges</span>
                <strong>{formatCurrency(profitLoss.sales.breakdown.makingCharges)}</strong>
              </div>
              <div className="breakdown-item">
                <span>Wastage</span>
                <strong>{formatCurrency(profitLoss.sales.breakdown.wastage)}</strong>
              </div>
              <div className="breakdown-item">
                <span>Discounts</span>
                <strong>{formatCurrency(profitLoss.sales.breakdown.discounts)}</strong>
              </div>
              <div className="breakdown-item total">
                <span>Profit Margin</span>
                <strong>{profitLoss.profitMargin}%</strong>
              </div>
            </div>
          </div>
        )}

        {/* Sales Chart */}
        {salesData.length > 0 && (
          <div className="report-card chart-card">
            <h2>Sales Trend (Last 30 Days)</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke={chartTheme.text} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    stroke={chartTheme.text} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `₹${value/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={chartTheme.tooltip}
                    itemStyle={{ color: '#C6FF3A' }}
                    formatter={(value) => formatCurrency(value)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#C6FF3A" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#C6FF3A', strokeWidth: 2, stroke: '#121212' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Sales" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Stock Valuation */}
        {stockValuation && (
          <div className="report-card pie-card">
            <h2>Stock Valuation</h2>
            <div className="stock-summary-small">
              <div className="stock-item">
                <span>Total Value</span>
                <strong>{formatCurrency(stockValuation.totalValue)}</strong>
              </div>
              <div className="stock-item">
                <span>Total Cost</span>
                <strong>{formatCurrency(stockValuation.totalCost)}</strong>
              </div>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stockValuation.byCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="totalValue"
                  >
                    {stockValuation.byCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={chartTheme.tooltip}
                    formatter={(value) => formatCurrency(value)} 
                  />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Customer Arrears Chart */}
        {customerArrears.length > 0 && (
          <div className="report-card chart-card">
            <h2>Top 10 Customer Arrears</h2>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={customerArrears}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke={chartTheme.text} 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    angle={-45} 
                    textAnchor="end" 
                    height={80}
                  />
                  <YAxis 
                    stroke={chartTheme.text} 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={chartTheme.tooltip}
                    itemStyle={{ color: '#FF9F43' }}
                    formatter={(value) => formatCurrency(value)} 
                  />
                  <Bar dataKey="amount" fill="#FF9F43" radius={[4, 4, 0, 0]} name="Outstanding" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Aging Report */}
        {aging && (
          <div className="report-card aging-card">
            <h2>Aging Report (Outstanding Dues)</h2>
            <div className="aging-summary">
              <div className="aging-group">
                <span className="label">0-30 Days</span>
                <span className="amount">{formatCurrency(aging['0-30'].reduce((sum, item) => sum + item.amount, 0))}</span>
                <span className="count">{aging['0-30'].length} invoices</span>
              </div>
              <div className="aging-group">
                <span className="label">31-60 Days</span>
                <span className="amount">{formatCurrency(aging['31-60'].reduce((sum, item) => sum + item.amount, 0))}</span>
                <span className="count">{aging['31-60'].length} invoices</span>
              </div>
              <div className="aging-group warning">
                <span className="label">61-90 Days</span>
                <span className="amount">{formatCurrency(aging['61-90'].reduce((sum, item) => sum + item.amount, 0))}</span>
                <span className="count">{aging['61-90'].length} invoices</span>
              </div>
              <div className="aging-group danger">
                <span className="label">90+ Days</span>
                <span className="amount">{formatCurrency(aging['90+'].reduce((sum, item) => sum + item.amount, 0))}</span>
                <span className="count">{aging['90+'].length} invoices</span>
              </div>
            </div>
            
            {/* Aging Details Table */}
            {(aging['90+'].length > 0 || aging['61-90'].length > 0) && (
              <div className="aging-details-table">
                <h3>Critical Overdue Invoices (60+ Days)</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Days Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...aging['61-90'], ...aging['90+']].map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.invoice}</td>
                          <td>{item.customer?.name || 'N/A'}</td>
                          <td>{formatCurrency(item.amount)}</td>
                          <td className={item.days > 90 ? 'critical' : 'warning'}>{item.days} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
