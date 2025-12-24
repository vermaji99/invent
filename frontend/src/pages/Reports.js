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

  const COLORS = ['#D4AF37', '#F4D03F', '#B8860B', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

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

      {/* Profit & Loss */}
      {profitLoss && (
        <div className="report-card">
          <h2>Profit & Loss Report</h2>
          <div className="pl-summary">
            <div className="pl-item">
              <span>Sales Revenue</span>
              <span>{formatCurrency(profitLoss.sales.revenue)}</span>
            </div>
            <div className="pl-item">
              <span>Cost of Goods Sold (COGS)</span>
              <span>{formatCurrency(profitLoss.sales.cogs)}</span>
            </div>
            <div className="pl-item">
              <span>Gross Profit</span>
              <span className="text-green-600 font-bold">{formatCurrency(profitLoss.sales.grossProfit)}</span>
            </div>
            <div className="pl-item">
              <span>Operating Expenses</span>
              <span>{formatCurrency(profitLoss.expenses)}</span>
            </div>
            <div className="pl-item pl-profit">
              <span>Net Profit</span>
              <span>{formatCurrency(profitLoss.netProfit)}</span>
            </div>
            <div className="pl-item">
              <span>Profit Margin</span>
              <span>{profitLoss.profitMargin}%</span>
            </div>
          </div>
          <div className="pl-details mt-4 text-sm text-gray-600 border-t pt-2">
            <p><strong>Breakdown:</strong></p>
            <div className="flex justify-between">
              <span>Making Charges: {formatCurrency(profitLoss.sales.breakdown.makingCharges)}</span>
              <span>Wastage: {formatCurrency(profitLoss.sales.breakdown.wastage)}</span>
              <span>Discounts: {formatCurrency(profitLoss.sales.breakdown.discounts)}</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              * Total Purchases (Cash Flow): {formatCurrency(profitLoss.purchases)}
            </div>
          </div>
        </div>
      )}

      {/* Sales Chart */}
      {salesData.length > 0 && (
        <div className="report-card">
          <h2>Sales Trend (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#D4AF37" strokeWidth={2} name="Sales" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stock Valuation */}
      {stockValuation && (
        <div className="report-card">
          <h2>Stock Valuation</h2>
          <div className="stock-summary">
            <div className="stock-item">
              <span>Total Stock Value</span>
              <span>{formatCurrency(stockValuation.totalValue)}</span>
            </div>
            <div className="stock-item">
              <span>Total Cost</span>
              <span>{formatCurrency(stockValuation.totalCost)}</span>
            </div>
            <div className="stock-item">
              <span>Potential Profit</span>
              <span>{formatCurrency(stockValuation.potentialProfit)}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stockValuation.byCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="totalValue"
              >
                {stockValuation.byCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Customer Arrears Chart */}
      {customerArrears.length > 0 && (
        <div className="report-card">
          <h2>Top 10 Customer Arrears</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={customerArrears}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="amount" fill="#f59e0b" name="Outstanding Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aging Report */}
      {aging && (
        <div className="report-card">
          <h2>Aging Report (Outstanding Dues)</h2>
          <div className="aging-summary">
            <div className="aging-group">
              <h3>0-30 Days</h3>
              <p className="aging-amount">{formatCurrency(aging['0-30'].reduce((sum, item) => sum + item.amount, 0))}</p>
              <span>{aging['0-30'].length} invoices</span>
            </div>
            <div className="aging-group">
              <h3>31-60 Days</h3>
              <p className="aging-amount">{formatCurrency(aging['31-60'].reduce((sum, item) => sum + item.amount, 0))}</p>
              <span>{aging['31-60'].length} invoices</span>
            </div>
            <div className="aging-group">
              <h3>61-90 Days</h3>
              <p className="aging-amount">{formatCurrency(aging['61-90'].reduce((sum, item) => sum + item.amount, 0))}</p>
              <span>{aging['61-90'].length} invoices</span>
            </div>
            <div className="aging-group">
              <h3>90+ Days</h3>
              <p className="aging-amount aging-critical">{formatCurrency(aging['90+'].reduce((sum, item) => sum + item.amount, 0))}</p>
              <span>{aging['90+'].length} invoices</span>
            </div>
          </div>
          
          {/* Aging Details Table */}
          <div className="aging-details">
            {(aging['90+'].length > 0 || aging['61-90'].length > 0) && (
              <div className="aging-table-section">
                <h3>Critical Overdue Invoices (60+ Days)</h3>
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
                        <td className={item.days > 90 ? 'critical' : ''}>{item.days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
