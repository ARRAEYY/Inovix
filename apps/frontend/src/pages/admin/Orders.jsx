import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';
import { toast } from 'react-hot-toast';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount || 0);
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
  const [refundModalOrder, setRefundModalOrder] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Super admin manual adjustment');
  const [refunding, setRefunding] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, outletsRes, usersRes] = await Promise.all([
        api.get('/admin/orders?pageSize=100'),
        api.get('/admin/outlets'),
        api.get('/admin/users?pageSize=100')
      ]);
      
      setOrders(ordersRes.data.data?.items || []);
      setOutlets(outletsRes.data.data || []);
      setUsers(usersRes.data.data?.items || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleLiveOrderUpdate = () => {
      fetchData();
    };
    window.addEventListener('nosh:order-updated', handleLiveOrderUpdate);
    window.addEventListener('nosh:order-new', handleLiveOrderUpdate);

    return () => {
      window.removeEventListener('nosh:order-updated', handleLiveOrderUpdate);
      window.removeEventListener('nosh:order-new', handleLiveOrderUpdate);
    };
  }, []);

  const getOutletName = (order) => {
    if (order.outlet?.name) return order.outlet.name;
    const found = outlets.find(o => o.id === order.outletId);
    if (found?.name) return found.name;
    try {
      return JSON.parse(order.outletSnapshot || '{}').name || 'Unknown Outlet';
    } catch {
      return 'Unknown Outlet';
    }
  };

  const getUserName = (order) => {
    if (order.student?.name) return order.student.name;
    if (order.student?.email) return order.student.email;
    const found = users.find(u => u.id === order.studentId);
    return found?.name || found?.email || 'Student';
  };

  const handleOpenRefundModal = (order) => {
    const paymentAmount = Number(order.payment?.amount || order.totalAmount || 0);
    const alreadyRefunded = (order.payment?.refunds || [])
      .filter(r => r.status === 'COMPLETED' || r.status === 'PENDING')
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const maxRefundable = Math.max(0, paymentAmount - alreadyRefunded);

    setRefundModalOrder({
      ...order,
      paymentAmount,
      alreadyRefunded,
      maxRefundable,
    });
    setRefundAmount(String(Math.round(maxRefundable)));
    setRefundReason('Super admin manual resolution');
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundModalOrder) return;

    const amt = Number(refundAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }
    if (amt > refundModalOrder.maxRefundable) {
      toast.error(`Refund amount cannot exceed ₹${refundModalOrder.maxRefundable}`);
      return;
    }

    try {
      setRefunding(true);
      await api.post('/admin/refunds', {
        orderId: refundModalOrder.id,
        amount: amt,
        reason: refundReason.trim() || 'Super admin manual adjustment',
      });
      toast.success(`Refund of ₹${amt} initiated successfully`);
      setRefundModalOrder(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund processing failed');
    } finally {
      setRefunding(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const outletName = getOutletName(o).toLowerCase();
    const userName = getUserName(o).toLowerCase();
    const orderNum = (o.orderNumber || '').toLowerCase();
    const orderId = (o.id || '').toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = orderId.includes(q) || orderNum.includes(q) || outletName.includes(q) || userName.includes(q);

    if (!matchesSearch) return false;

    if (filter === 'All') return true;
    if (filter === 'New') return o.status === 'PENDING' || o.status === 'PLACED';

    return o.status === filter.toUpperCase();
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading orders...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Orders Management
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Monitor, audit, and issue manual refunds across all orders in real time.
            </p>
          </div>
          <button 
            onClick={fetchData}
            style={{ padding: '10px 18px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
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
              placeholder="Search by order #, student, or outlet..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '300px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Order #</th>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => {
                    const isReady = order.status === 'READY';
                    const isCompleted = order.status === 'COMPLETED';
                    const isCancelled = order.status === 'CANCELLED';
                    
                    let statusBg = '#fffbeb';
                    let statusColor = '#d97706';
                    
                    if (isReady) { statusBg = '#ecfdf5'; statusColor = '#059669'; }
                    if (isCompleted) { statusBg = '#f3f4f6'; statusColor = '#4b5563'; }
                    if (isCancelled) { statusBg = '#fef2f2'; statusColor = '#dc2626'; }
                    
                    const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const displayId = order.orderNumber || (order.id.includes('_') ? order.id.split('_')[1] : order.id.slice(-6));
                    const isPaid = order.payment?.status === 'PAID';
                    const hasRefunds = (order.payment?.refunds || []).length > 0;

                    return (
                      <tr key={order.id} style={{ borderBottom: idx !== filteredOrders.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827', fontSize: '0.9rem' }}>
                          #{displayId}
                        </td>
                        <td style={{ padding: '16px 24px', color: '#374151', fontWeight: '500' }}>{getUserName(order)}</td>
                        <td style={{ padding: '16px 24px', color: '#374151' }}>{getOutletName(order)}</td>
                        <td style={{ padding: '16px 24px', color: '#111827', fontWeight: '600' }}>{formatCurrency(Number(order.totalAmount))}</td>
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
                            {order.status === 'PENDING' ? 'New' : order.status.toLowerCase()}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: order.payment?.status === 'PAID' ? '#ecfdf5' : order.payment?.status === 'REFUNDED' ? '#eff6ff' : '#f9fafb',
                            color: order.payment?.status === 'PAID' ? '#059669' : order.payment?.status === 'REFUNDED' ? '#2563eb' : '#6b7280'
                          }}>
                            {order.payment?.status || 'UNPAID'}
                            {hasRefunds && ' (Refunded)'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '0.85rem' }}>{timeStr}</td>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button onClick={() => setSelectedOrder(order)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                            {isPaid && (
                              <button onClick={() => handleOpenRefundModal(order)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}>
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Refund Modal */}
      {refundModalOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '1.4rem', fontWeight: '800', color: '#111827' }}>Issue Manual Refund</h2>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '0.9rem' }}>
              Order #{refundModalOrder.orderNumber || refundModalOrder.id.slice(-6)} · {getUserName(refundModalOrder)}
            </p>

            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '14px', marginBottom: '20px', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Total Paid:</span>
                <strong style={{ color: '#111827' }}>{formatCurrency(refundModalOrder.paymentAmount)}</strong>
              </div>
              {refundModalOrder.alreadyRefunded > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Already Refunded:</span>
                  <span style={{ color: '#d97706', fontWeight: 600 }}>{formatCurrency(refundModalOrder.alreadyRefunded)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '6px' }}>
                <span style={{ color: '#111827', fontWeight: 600 }}>Max Refundable:</span>
                <strong style={{ color: '#059669' }}>{formatCurrency(refundModalOrder.maxRefundable)}</strong>
              </div>
            </div>

            <form onSubmit={handleRefundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>
                  Refund Amount (₹)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  max={refundModalOrder.maxRefundable}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>
                  Reason for Refund
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Student cancelled, quality issue"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setRefundModalOrder(null)}
                  disabled={refunding}
                  style={{ padding: '10px 18px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', opacity: refunding ? 0.7 : 1 }}
                >
                  {refunding ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>Order #{selectedOrder.orderNumber || selectedOrder.id.slice(-6)}</h2>
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
                  <div style={{ fontWeight: '600', color: '#111827' }}>{getUserName(selectedOrder)}</div>
                  <div style={{ fontSize: '0.85rem' }}>ID: {selectedOrder.studentId}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>Outlet Info</div>
                  <div style={{ fontWeight: '600', color: '#111827' }}>{getOutletName(selectedOrder)}</div>
                  <div style={{ fontSize: '0.85rem' }}>ID: {selectedOrder.outletId}</div>
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
                      <div style={{ fontWeight: '600', color: '#111827' }}>{formatCurrency(Number(item.price) * item.quantity)}</div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontWeight: '700', color: '#111827', fontSize: '1.1rem' }}>
                    <div>Total</div>
                    <div>{formatCurrency(Number(selectedOrder.totalAmount))}</div>
                  </div>
                </div>
              </div>
              
              <div style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span><strong>Placed At:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</span>
                <span><strong>Payment ID:</strong> {selectedOrder.payment?.razorpayPaymentId || selectedOrder.payment?.id || 'N/A'}</span>
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

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: '#111827'
};

export default Orders;
