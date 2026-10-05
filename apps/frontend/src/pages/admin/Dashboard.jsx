import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api/client';
import Skeleton from '../../components/common/Skeleton';

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

  const fetchDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await api.get('/admin/overview');
      setData(response.data.data);
      setError(null);
    } catch (err) {
      if (!isSilent) setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    // Listen to real-time socket events for platform-wide orders
    const handleLiveOrderUpdate = () => {
      fetchDashboard(true);
    };

    window.addEventListener('nosh:order-updated', handleLiveOrderUpdate);
    window.addEventListener('nosh:order-new', handleLiveOrderUpdate);

    // 15-second background polling fallback to guarantee fresh metrics
    const interval = setInterval(() => {
      fetchDashboard(true);
    }, 15000);

    return () => {
      window.removeEventListener('nosh:order-updated', handleLiveOrderUpdate);
      window.removeEventListener('nosh:order-new', handleLiveOrderUpdate);
      clearInterval(interval);
    };
  }, [fetchDashboard]);

  if (loading) return <AdminLayout><div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '1rem' }}><Skeleton height='80px' /><Skeleton height='80px' /><Skeleton height='80px' /></div></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p style={{ padding: '24px' }}>No data available</p></AdminLayout>;

  const { metrics = {}, users = {}, outletOverview = [], recentOrders = [], attentionNeeded = [] } = data || {};

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
                Dashboard
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '16px',
                background: '#ecfdf5',
                color: '#059669',
                fontSize: '0.75rem',
                fontWeight: '700',
                letterSpacing: '0.5px'
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }}></span>
                LIVE
              </span>
            </div>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Overview of your Nosh platform.
            </p>
          </div>
          <button onClick={() => fetchDashboard(false)} style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        {/* Primary KPIs — the four numbers that matter most */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>

          <div style={metricCardStyle}>
            <p style={{ margin: '0 0 6px 0', color: '#6b7280', fontSize: '0.85rem', fontWeight: '600' }}>Gross value today</p>
            <h2 style={{ margin: 0, fontSize: '1.7rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>{formatCurrency(metrics.revenueToday)}</h2>
          </div>

          <div style={metricCardStyle}>
            <p style={{ margin: '0 0 6px 0', color: '#6b7280', fontSize: '0.85rem', fontWeight: '600' }}>Orders today</p>
            <h2 style={{ margin: 0, fontSize: '1.7rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>{Number(metrics.ordersToday || 0).toLocaleString()}</h2>
          </div>

          <div style={metricCardStyle}>
            <p style={{ margin: '0 0 6px 0', color: '#6b7280', fontSize: '0.85rem', fontWeight: '600' }}>Active outlets</p>
            <h2 style={{ margin: 0, fontSize: '1.7rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>{metrics.activeOutlets}</h2>
          </div>

          <div style={metricCardStyle}>
            <p style={{ margin: '0 0 6px 0', color: '#6b7280', fontSize: '0.85rem', fontWeight: '600' }}>Total users</p>
            <h2 style={{ margin: 0, fontSize: '1.7rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>{metrics.totalUsers.toLocaleString()}</h2>
          </div>

        </div>

        {/* Secondary metrics — compact strip, no giant cards (§16) */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px 32px', alignItems: 'center',
          background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '14px 20px',
        }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            This month <strong style={{ color: '#111827', marginLeft: 6 }}>{formatCurrency(metrics.revenueThisMonth)}</strong>
          </span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Lifetime <strong style={{ color: '#111827', marginLeft: 6 }}>{formatCurrency(metrics.revenueTotal)}</strong>
          </span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Orders this week <strong style={{ color: '#111827', marginLeft: 6 }}>{metrics.ordersThisWeek.toLocaleString()}</strong>
          </span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Refund rate <strong style={{ color: '#111827', marginLeft: 6 }}>{metrics.refundRate || '0.0%'}</strong>
          </span>
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

const metricCardStyle = {
  ...cardStyle,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start'
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

export default AdminDashboard;
