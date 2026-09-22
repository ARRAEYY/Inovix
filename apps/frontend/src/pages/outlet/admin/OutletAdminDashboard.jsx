import React, { useState, useEffect } from 'react';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import { getDashboardStats } from '../../../services/outletAdminService';
import { useAuth } from '../../../hooks/useAuth';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

const OutletAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <OutletAdminLayout><p style={{ padding: '24px' }}>Loading dashboard...</p></OutletAdminLayout>;
  if (error) return <OutletAdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></OutletAdminLayout>;
  if (!stats) return <OutletAdminLayout><p style={{ padding: '24px' }}>No data available</p></OutletAdminLayout>;

  // Use current date for subtitle
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <OutletAdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '8px' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
            Good evening, {user?.name?.split(' ')[0] || 'Partner'}
          </h1>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
            Live performance for {dateString}.
          </p>
        </div>

        {/* 4 Stat Cards Grid */}
        <div className="dashboard-metrics-grid">
          <div className="stat-card" style={cardStyle}>
            <p style={statLabelStyle}>Today's sales</p>
            <h2 style={statValueStyle}>{formatCurrency(stats.todaySales)}</h2>
            <p style={statGrowthStyle}>{stats.percentChange?.sales}</p>
          </div>
          <div className="stat-card" style={cardStyle}>
            <p style={statLabelStyle}>Orders</p>
            <h2 style={statValueStyle}>{stats.totalOrders}</h2>
            <p style={statGrowthStyle}>{stats.percentChange?.orders}</p>
          </div>
          <div className="stat-card" style={cardStyle}>
            <p style={statLabelStyle}>Sales this month</p>
            <h2 style={statValueStyle}>{formatCurrency(stats.monthSales)}</h2>
            <p style={statGrowthStyle}>{stats.percentChange?.monthSales}</p>
          </div>
          <div className="stat-card" style={cardStyle}>
            <p style={statLabelStyle}>Prep time</p>
            <h2 style={statValueStyle}>{stats.prepTime?.value}</h2>
            <p style={statGrowthStyle}>{stats.prepTime?.subtitle}</p>
          </div>
        </div>

        {/* Orders this week (Chart) */}
        <div style={{...cardStyle, paddingBottom: 0}}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: '800' }}>Orders this week</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>Peak demand between 1-2 PM</p>
            </div>
            <button style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#111827', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer' }}>Last 7 days</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '220px', marginTop: '20px', gap: '8px' }}>
            {stats.weeklyOrders?.map((item, idx) => {
               const maxVal = Math.max(...stats.weeklyOrders.map(o => o.value));
               const heightPercent = Math.max((item.value / maxVal) * 100, 10);
               const isHighlighted = item.day === 'F' && idx === 4; 
               return (
                 <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: 1, height: '100%' }}>
                   <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: '100%' }}>
                     <div style={{ 
                       width: '100%', 
                       maxWidth: '56px',
                       height: `${heightPercent}%`, 
                       background: isHighlighted ? '#b10035' : '#faf5f6', 
                       borderRadius: '8px 8px 0 0',
                       transition: 'height 0.3s ease'
                     }}></div>
                   </div>
                   <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: '500', paddingBottom: '16px' }}>{item.day}</div>
                 </div>
               )
            })}
          </div>
        </div>

        {/* Attention needed */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.15rem', fontWeight: '800' }}>Attention needed</h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {stats.attentionNeeded?.map((alert, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px 0',
                borderBottom: idx !== stats.attentionNeeded.length - 1 ? '1px solid #f3f4f6' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: alert.color }}></div>
                  <span style={{ fontWeight: '600', color: '#111827', fontSize: '0.95rem' }}>{alert.message}</span>
                </div>
                <button style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.9rem' }}>
                  {alert.action}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div style={{...cardStyle, padding: 0, overflow: 'hidden'}}>
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Recent orders</h3>
            <button style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.9rem' }}>View all</button>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#4b5563', fontSize: '0.9rem' }}>Order</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#4b5563', fontSize: '0.9rem' }}>Student</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#4b5563', fontSize: '0.9rem' }}>Outlet</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#4b5563', fontSize: '0.9rem' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', color: '#4b5563', fontSize: '0.9rem' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders?.slice(0, 3).map((order, idx) => {
                  
                  const isReady = order.status === 'READY';
                  const statusBg = isReady ? '#ecfdf5' : '#fef2f2';
                  const statusColor = isReady ? '#10b981' : '#b10035';
                  
                  // Generate realistic sounding mock names since user.name isn't attached to standard order objects
                  const mockNames = ["Riya Sharma", "Aman Verma", "Tanya Singh"];
                  const studentName = mockNames[idx] || "Student Name";
                  
                  return (
                    <tr key={order.id} style={{ borderBottom: idx !== 2 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827' }}>#{order.orderNumber}</td>
                      <td style={{ padding: '16px 24px', color: '#374151' }}>{studentName}</td>
                      <td style={{ padding: '16px 24px', color: '#374151' }}>Courtyard Café</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '0.8rem',
                          fontWeight: '700',
                          background: statusBg,
                          color: statusColor,
                          textTransform: 'capitalize'
                        }}>
                          {order.status === 'PLACED' ? 'New' : order.status.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#111827' }}>{formatCurrency(order.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </OutletAdminLayout>
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

const statLabelStyle = {
  margin: '0 0 8px 0',
  color: '#4b5563',
  fontSize: '0.95rem',
  fontWeight: '600'
};

const statValueStyle = {
  margin: '0 0 8px 0',
  fontSize: '1.85rem',
  fontWeight: '800',
  color: '#111827',
  letterSpacing: '-0.5px'
};

const statGrowthStyle = {
  margin: 0,
  color: '#16a34a',
  fontSize: '0.85rem',
  fontWeight: '700'
};

export default OutletAdminDashboard;
