import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api/client';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const navigate = useNavigate();

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/overview');
      setData(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading platform overview...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p style={{ padding: '24px' }}>No data available</p></AdminLayout>;

  const { metrics, users, outletOverview, recentOrders, attentionNeeded } = data;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Dashboard
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Overview of your Nosh platform.
            </p>
          </div>
          <button onClick={fetchDashboard} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        {/* Overview Stats Grid */}
        <div className="dashboard-metrics-grid">
          <div className="metric-card">
            <p className="metric-title">Gross value (Today)</p>
            <h2 className="metric-value">{formatCurrency(metrics.revenueToday)}</h2>
            <p className="metric-trend positive">+12.4% today</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Gross value (This Month)</p>
            <h2 className="metric-value">{formatCurrency(metrics.revenueThisMonth)}</h2>
            <p className="metric-trend positive">+8.5% this month</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Total gross value</p>
            <h2 className="metric-value">{formatCurrency(metrics.revenueTotal)}</h2>
            <p className="metric-trend positive">Platform lifetime</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Active outlets</p>
            <h2 className="metric-value">{metrics.activeOutlets}</h2>
            <p className="metric-trend positive">+3 this month</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Orders today</p>
            <h2 className="metric-value">{metrics.ordersToday.toLocaleString()}</h2>
            <p className="metric-trend positive">+8.2%</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Refund rate</p>
            <h2 className="metric-value">0.8%</h2>
            <p className="metric-trend positive">Healthy</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Total users</p>
            <h2 className="metric-value">{metrics.totalUsers.toLocaleString()}</h2>
            <p className="metric-trend positive">+150 this month</p>
          </div>

          <div className="metric-card">
            <p className="metric-title">Orders this week</p>
            <h2 className="metric-value">{metrics.ordersThisWeek.toLocaleString()}</h2>
            <p className="metric-trend positive">+4.1%</p>
          </div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* User Overview */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: '800' }}>User Overview</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={userRowStyle}>
                <span style={userLabelStyle}>Students</span>
                <span style={userValueStyle}>{users.students.toLocaleString()}</span>
              </div>
              <div style={userRowStyle}>
                <span style={userLabelStyle}>Outlet Staff</span>
                <span style={userValueStyle}>{users.outletStaff.toLocaleString()}</span>
              </div>
              <div style={userRowStyle}>
                <span style={userLabelStyle}>Outlet Admins</span>
                <span style={userValueStyle}>{users.outletAdmins.toLocaleString()}</span>
              </div>
              <div style={userRowStyle}>
                <span style={userLabelStyle}>Super Admins</span>
                <span style={userValueStyle}>{users.superAdmins.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Requires Attention */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: '800' }}>Requires Attention</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {attentionNeeded.map((alert, idx) => (
                <div 
                  key={alert.id} 
                  onClick={() => navigate(alert.path)}
                  style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: idx !== attentionNeeded.length - 1 ? '1px solid #f3f4f6' : 'none',
                  cursor: 'pointer'
                }}>
                  <span style={{ fontWeight: '600', color: '#111827', fontSize: '0.95rem' }}>{alert.message}</span>
                  <span style={{ color: '#b10035', fontWeight: '600', fontSize: '1.2rem', paddingRight: '8px' }}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Outlet Overview */}
        <div style={{...cardStyle, padding: 0, overflow: 'hidden'}}>
          <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Outlet Overview</h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Orders Today</th>
                  <th style={thStyle}>Staff</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {outletOverview.slice(0, 5).map((outlet, idx) => (
                  <tr key={outlet.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: '#111827' }}>{outlet.name}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: outlet.status === 'OPEN' ? '#ecfdf5' : outlet.status === 'BUSY' ? '#fffbeb' : '#fef2f2',
                        color: outlet.status === 'OPEN' ? '#10b981' : outlet.status === 'BUSY' ? '#f59e0b' : '#b10035'
                      }}>
                        {outlet.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#4b5563' }}>{outlet.ordersToday} orders</td>
                    <td style={{ padding: '16px 24px', color: '#4b5563' }}>{outlet.staffCount} staff</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span onClick={() => navigate('/admin/outlets')} style={{ color: '#b10035', fontWeight: '500', cursor: 'pointer' }}>View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Orders */}
        <div style={{...cardStyle, padding: 0, overflow: 'hidden'}}>
          <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Recent Orders</h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Order ID</th>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order, idx) => {
                  const isReady = order.status === 'READY';
                  const isCompleted = order.status === 'COMPLETED';
                  const statusBg = isCompleted ? '#f9fafb' : isReady ? '#ecfdf5' : '#fef2f2';
                  const statusColor = isCompleted ? '#6b7280' : isReady ? '#10b981' : '#b10035';
                  
                  const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={order.id} style={{ borderBottom: idx !== recentOrders.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>
                        #{order.id.split('_')[1] || order.id}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#374151' }}>{order.studentName}</td>
                      <td style={{ padding: '16px 24px', color: '#374151' }}>{order.outletName}</td>
                      <td style={{ padding: '16px 24px', color: '#111827', fontWeight: '500' }}>{formatCurrency(order.total)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: statusBg,
                          color: statusColor,
                          textTransform: 'capitalize'
                        }}>
                          {order.status === 'PLACED' ? 'New' : order.status.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '0.9rem' }}>{timeStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
};

// Extracted styles
const cardStyle = {
  background: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  padding: '24px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};



const statValueStyle = {
  margin: '0 0 4px 0',
  fontSize: '2rem',
  fontWeight: '800',
  color: '#111827',
  letterSpacing: '-0.5px'
};

const statLabelStyle = {
  margin: 0,
  color: '#6b7280',
  fontSize: '0.75rem',
  fontWeight: '700',
  letterSpacing: '0.5px'
};

const secondaryStatLabelStyle = {
  margin: '0 0 8px 0',
  color: '#4b5563',
  fontSize: '0.95rem',
  fontWeight: '600'
};

const secondaryStatValueStyle = {
  margin: 0,
  fontSize: '1.5rem',
  fontWeight: '800',
  color: '#111827'
};

const userRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  paddingBottom: '8px',
  borderBottom: '1px solid #f3f4f6'
};

const userLabelStyle = {
  color: '#4b5563',
  fontWeight: '500'
};

const userValueStyle = {
  color: '#111827',
  fontWeight: '700'
};

const thStyle = {
  padding: '16px 24px',
  fontWeight: '600',
  color: '#4b5563',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

// Global animation for refresh icon
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes spin { 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(styleSheet);

export default AdminDashboard;
