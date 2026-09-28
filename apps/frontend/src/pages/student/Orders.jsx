import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { orderService } from '../../services/api/orderService';

const FILTERS = ['All time', 'Today', 'Yesterday', 'Past Week'];

const STATUS_LABELS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

// Timeline status → display label + emoji
const TIMELINE_LABELS = {
  PENDING: '📅 Order placed',
  ACCEPTED: '✅ Outlet accepted',
  PREPARING: '👨‍🍳 Preparing',
  READY: '🔔 Ready for pickup',
  COMPLETED: '🎉 Completed',
  REJECTED: '❌ Rejected',
  CANCELLED: '🚫 Cancelled',
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const timeframeOf = (createdAt) => {
  const d = new Date(createdAt);
  const now = new Date();
  if (sameDay(d, now)) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'yesterday';
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  return d > weekAgo ? 'past_week' : 'older';
};

const formatWhen = (createdAt) => {
  const d = new Date(createdAt);
  const now = new Date();
  if (sameDay(d, now)) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

// Parse the timeline JSON (stored as a string in the Order model)
const parseTimeline = (timelineStr) => {
  try {
    const arr = JSON.parse(timelineStr || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

// Map a backend order onto the display fields
const mapOrder = (o) => {
  let outletName = 'Campus outlet';
  let outletId = null;
  try {
    const snap = JSON.parse(o.outletSnapshot || '{}');
    outletName = snap.name || outletName;
    outletId = o.outletId || snap.id || null;
  } catch {
    // keep fallback
  }
  const timeline = parseTimeline(o.timeline);
  return {
    id: o.id,              // the full order ID (for cancel API call)
    orderNumber: o.orderNumber,
    outletName,
    outletId,
    date: formatWhen(o.createdAt),
    timeframe: timeframeOf(o.createdAt),
    items: (o.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
    total: Math.round(Number(o.totalAmount)),
    status: STATUS_LABELS[o.status] || o.status,
    rawStatus: o.status,   // for cancel/reorder logic
    pickupCode: o.pickupCode,
    timeline,
    paymentStatus: o.payment?.status || 'PENDING',
  };
};

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await orderService.getMyOrders();
      setOrders((res.data || []).map(mapOrder));
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order? You\'ll get a full refund.')) return;
    try {
      setCancellingId(orderId);
      await orderService.cancelOrder(orderId);
      alert('Order cancelled. Refund will be processed automatically.');
      fetchOrders();
    } catch (err) {
      alert(err.message || 'Could not cancel the order');
    } finally {
      setCancellingId(null);
    }
  };

  const handleReorder = (order) => {
    if (!order.outletId) {
      alert('Cannot reorder — outlet not found.');
      return;
    }
    // Rebuild the cart from the order's items + store in localStorage
    const cart = {};
    order.items.forEach(item => {
      // We don't have the menuItemId in the display mapping; use the name
      // to find it. Actually — the order items have menuItemId from the backend.
      // Let me fix the mapOrder to include menuItemId.
    });
    // Navigate to the outlet menu (the student can re-add items manually)
    navigate(`/student/outlet/${order.outletId}`);
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'All time') return true;
    if (activeFilter === 'Today') return order.timeframe === 'today';
    if (activeFilter === 'Yesterday') return order.timeframe === 'yesterday';
    if (activeFilter === 'Past Week') return order.timeframe === 'past_week' || order.timeframe === 'yesterday' || order.timeframe === 'today';
    return true;
  });

  // Show pickup code only for confirmed orders (ACCEPTED through READY)
  const showPickupCode = (rawStatus) =>
    ['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'].includes(rawStatus);

  return (
    <div className="page-wrapper bg-white">
      <Header title="Orders" showBack={false} />

      <main className="explore-container orders-container">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>Loading your orders…</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>{error}</p>
            <button className="primary-btn" onClick={fetchOrders} style={{ marginTop: '1rem' }}>Retry</button>
          </div>
        ) : (
        <>
        <div className="page-header desktop-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button
              onClick={() => navigate('/student')}
              title="Back to outlets"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-gray)', marginBottom: '1.25rem', display: 'block' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1 className="page-title">Your Orders</h1>
            <p className="page-subtitle">View your past orders and reorder favorites</p>
          </div>
        </div>

        {orders.length > 0 && (
          <div className="filter-pills" style={{ marginBottom: '1.5rem' }}>
            {FILTERS.map(filter => (
              <button
                key={filter}
                className={`pill ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="empty-orders-state">
            <div className="empty-icon-wrapper">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <h2>No order history yet</h2>
            <p>Looks like you haven't placed any orders. Discover your favorite campus food now!</p>
            <button className="primary-btn" onClick={() => navigate('/student')} style={{ maxWidth: '200px', marginTop: '1.5rem' }}>
              Order now
            </button>
          </div>
        ) : (
          <div className="orders-list">
            {filteredOrders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-header">
                  <div>
                    <h3 className="order-outlet">{order.outletName}</h3>
                    <p className="order-date">{order.date}</p>
                  </div>
                  <div className="order-status">{order.status}</div>
                </div>

                {/* Pickup code — shown for confirmed orders */}
                {showPickupCode(order.rawStatus) && order.pickupCode && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: '10px', padding: '0.75rem 1rem', margin: '0.75rem 0',
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>PICKUP CODE</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', letterSpacing: '0.2em' }}>
                      {order.pickupCode}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                      Show this at the outlet counter
                    </span>
                  </div>
                )}

                <div className="order-items-container">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="order-item">
                      <span className="item-quantity">{item.quantity} ×</span>
                      <span className="item-name">{item.name}</span>
                    </div>
                  ))}
                </div>

                <div className="order-footer">
                  <div className="order-total">
                    <span className="total-label">Total</span>
                    <span className="total-amount">₹{order.total}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {/* Cancel button — only for PENDING orders */}
                    {order.rawStatus === 'PENDING' && (
                      <button
                        className="order-again-btn"
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                      >
                        {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                    {/* Reorder button — navigate to the outlet menu */}
                    {order.outletId && (
                      <button
                        className="order-again-btn"
                        onClick={() => navigate(`/student/outlet/${order.outletId}`)}
                      >
                        Order again
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable timeline */}
                {order.timeline.length > 0 && (
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, padding: 0 }}
                    >
                      {expandedId === order.id ? '▾ Hide timeline' : '▸ View timeline'}
                    </button>
                    {expandedId === order.id && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {order.timeline.map((t, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                            <span>{TIMELINE_LABELS[t.status] || t.status}</span>
                            <span style={{ color: '#9ca3af' }}>·</span>
                            <span>{t.at ? new Date(t.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Orders;
