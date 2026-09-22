import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchData = async () => {
    try {
      // For a super admin dashboard, we might want to just fetch the overview to get everything, 
      // or implement dedicated endpoints. We'll use the endpoints we have.
      const [ordersRes, outletsRes, usersRes] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/admin/outlets'),
        api.get('/admin/users')
      ]);
      
      setOrders(ordersRes.data.data);
      setOutlets(outletsRes.data.data);
      setUsers(usersRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getOutletName = (id) => outlets.find(o => o.id === id)?.name || 'Unknown Outlet';
  const getUserName = (id) => users.find(u => u.id === id)?.name || 'Unknown Student';

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase()) || 
                          getOutletName(o.outletId).toLowerCase().includes(search.toLowerCase()) ||
                          getUserName(o.userId).toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filter === 'All') return true;
    if (filter === 'New') return o.status === 'PLACED';
    
    return o.status === filter.toUpperCase();
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading orders...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Orders
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Monitor orders across the Nosh platform.
            </p>
          </div>
          <button 
            onClick={fetchData}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px', overflowX: 'auto', flexWrap: 'nowrap' }}>
              {['All', 'New', 'Preparing', 'Ready', 'Completed', 'Cancelled'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    background: filter === f ? 'white' : 'transparent',
                    color: filter === f ? '#111827' : '#6b7280',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            
            <input 
              type="text" 
              placeholder="Search order ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '250px', fontSize: '0.9rem' }}
            />
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
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, idx) => {
                  const isReady = order.status === 'READY';
                  const isCompleted = order.status === 'COMPLETED';
                  const isCancelled = order.status === 'CANCELLED';
                  
                  let statusBg = '#fef2f2'; // Preparing/Placed
                  let statusColor = '#b10035';
                  
                  if (isReady) { statusBg = '#ecfdf5'; statusColor = '#10b981'; }
                  if (isCompleted) { statusBg = '#f9fafb'; statusColor = '#6b7280'; }
                  if (isCancelled) { statusBg = '#fef2f2'; statusColor = '#dc2626'; }
                  
                  const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={order.id} style={{ borderBottom: idx !== filteredOrders.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>
                        #{order.id.split('_')[1] || order.id}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#374151' }}>{getUserName(order.userId)}</td>
                      <td style={{ padding: '16px 24px', color: '#374151' }}>{getOutletName(order.outletId)}</td>
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
                      <td style={{ padding: '16px 24px' }}>
                        <button onClick={() => setSelectedOrder(order)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>View Details</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Order Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>Order #{selectedOrder.id.split('_')[1] || selectedOrder.id}</h2>
              <span style={{ 
                padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '700', textTransform: 'capitalize',
                background: selectedOrder.status === 'COMPLETED' ? '#f9fafb' : selectedOrder.status === 'READY' ? '#ecfdf5' : '#fef2f2',
                color: selectedOrder.status === 'COMPLETED' ? '#6b7280' : selectedOrder.status === 'READY' ? '#10b981' : '#b10035'
              }}>
                {selectedOrder.status === 'PLACED' ? 'New' : selectedOrder.status.toLowerCase()}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: '#4b5563', fontSize: '0.95rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', background: '#f9fafb', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>Customer Info</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{getUserName(selectedOrder.userId)}</div>
                  <div>ID: {selectedOrder.userId}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>Outlet Info</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{getOutletName(selectedOrder.outletId)}</div>
                  <div>ID: {selectedOrder.outletId}</div>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>Order Items</h3>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: idx !== selectedOrder.items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827' }}>{item.quantity}x {item.name || item.menuItemId}</div>
                        {item.notes && <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>Note: {item.notes}</div>}
                      </div>
                      <div style={{ fontWeight: '600', color: '#111827' }}>{formatCurrency(item.price * item.quantity)}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontWeight: '700', color: '#111827', fontSize: '1.1rem' }}>
                    <div>Total</div>
                    <div>{formatCurrency(selectedOrder.total)}</div>
                  </div>
                </div>
              </div>
              
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: '600' }}>Placed At:</span> {new Date(selectedOrder.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button onClick={() => setSelectedOrder(null)} style={{ padding: '10px 24px', background: '#b10035', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: 'white' }}>Close Details</button>
            </div>
          </div>
        </div>
      )}

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

const thStyle = {
  padding: '16px 24px',
  fontWeight: '600',
  color: '#4b5563',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

export default Orders;
