import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import client from '../../services/api/client';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/api/orderService';
import { reviewService } from '../../services/api/reviewService';
import { cacheGet, cacheSet } from '../../services/cache/localCache';
import { authService } from '../../services/auth/authService';
import { toast } from 'react-hot-toast';
import Skeleton from '../../components/common/Skeleton';

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

// Visual order progress (§11): Placed → Accepted → Preparing → Ready →
// Completed. The current step uses the Nosh primary color; done steps get
// a check. Rejected/cancelled orders get an explanatory banner instead.
const STEPS = [
  { key: 'PENDING', label: 'Placed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
  { key: 'COMPLETED', label: 'Completed' },
];

const OrderStepper = ({ order }) => {
  const raw = order.rawStatus;

  if (raw === 'REJECTED' || raw === 'CANCELLED') {
    const entry = (order.timeline || []).filter(t => t.status === raw).slice(-1)[0] || {};
    const isRejected = raw === 'REJECTED';
    const moneyBack = order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'PAID';
    return (
      <div className="order-blocked-banner" role="status">
        <p className="order-blocked-title">
          {isRejected ? 'Order rejected by the outlet' : 'Order cancelled'}
        </p>
        {isRejected && entry.reason && <p className="order-blocked-reason">Reason: {entry.reason}</p>}
        {!isRejected && entry.reason && <p className="order-blocked-reason">{entry.reason}</p>}
        <p className="order-blocked-next">
          {isRejected && moneyBack
            ? 'Your payment will be refunded automatically — no action needed.'
            : 'No action needed. You can place a new order anytime.'}
        </p>
      </div>
    );
  }

  const idx = STEPS.findIndex(s => s.key === raw);
  return (
    <div className="order-stepper" aria-label={`Order progress: ${order.status}`}>
      {STEPS.map((s, i) => (
        <div
          key={s.key}
          className={`stepper-step ${i < idx || raw === 'COMPLETED' ? 'done' : ''} ${i === idx && raw !== 'COMPLETED' ? 'current' : ''}`}
        >
          <span className="stepper-dot" aria-hidden="true">{i < idx || raw === 'COMPLETED' ? '✓' : i + 1}</span>
          <span className="stepper-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
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
    items: (o.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: Number(i.price), menuItemId: i.menuItemId, image: i.imageUrl || i.image || null })),
    total: Math.round(Number(o.totalAmount)),
    subtotal: Math.round(Number(o.subtotal || 0)),
    discount: Math.round(Number(o.discount || 0)),
    platformFee: Math.round(Number(o.platformFee || 0)),
    status: STATUS_LABELS[o.status] || o.status,
    rawStatus: o.status,   // for cancel/reorder logic
    orderType: o.orderType === 'DINE_IN' ? 'Dine in' : 'Takeaway',
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
  const { user } = useAuth();
  // Stale-while-revalidate: render the last-seen order list instantly and
  // refresh underneath, so repeat visits don't wait on the network.
  const ORDERS_CACHE_KEY = user ? `orders:${user.id}` : null;
  const ORDERS_MAX_AGE_MS = 60 * 1000;
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchOrders = async () => {
    if (!ORDERS_CACHE_KEY) return;
    const cached = cacheGet(ORDERS_CACHE_KEY, ORDERS_MAX_AGE_MS);
    if (cached) {
      setOrders(cached.map(mapOrder));
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await orderService.getMyOrders();
      const raw = res.data || [];
      cacheSet(ORDERS_CACHE_KEY, raw);
      setOrders(raw.map(mapOrder));
      setError(null);
    } catch (err) {
      // Only surface the error when there was nothing cached to show.
      if (!cached) setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [ORDERS_CACHE_KEY]);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order? You\'ll get a full refund.')) return;
    try {
      setCancellingId(orderId);
      await orderService.cancelOrder(orderId);
      toast('Order cancelled. Refund will be processed automatically.');
      fetchOrders();
    } catch (err) {
      toast(err.message || 'Could not cancel the order');
    } finally {
      setCancellingId(null);
    }
  };

  const handleReorder = (order) => {
    if (!order.outletId) {
      toast('Cannot reorder — outlet not found.');
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

  const [reviewingId, setReviewingId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  // Food-wise ratings — one optional 1-5 per item of the order being rated.
  const [itemRatings, setItemRatings] = useState({});

  const handleSubmitReview = async (orderId, outletId) => {
    try {
      const itemReviews = Object.entries(itemRatings)
        .filter(([, rating]) => rating > 0)
        .map(([menuItemId, rating]) => ({ menuItemId, rating }));
      await client.post('/reviews', {
        outletId, orderId, rating: reviewRating, comment: reviewComment,
        ...(itemReviews.length > 0 ? { itemReviews } : {}),
      });
      reviewService.invalidateAll();
      toast.success('Review submitted!');
      setReviewingId(null); setReviewRating(5); setReviewComment('');
    } catch (err) { toast(err.response?.data?.message || 'Failed to submit review'); }
  };

  const [disputeOrderId, setDisputeOrderId] = useState(null);
  const [disputeType, setDisputeType] = useState('ORDER_ISSUE');
  const [disputeDesc, setDisputeDesc] = useState('');

  const handleReportIssue = async (orderId, outletId) => {
    try {
      await client.post('/disputes', { orderId, outletId, type: disputeType, description: disputeDesc });
      toast.success('Issue reported. Our team will look into it.');
      setDisputeOrderId(null); setDisputeDesc(''); setDisputeType('ORDER_ISSUE');
    } catch (err) { toast(err.response?.data?.message || 'Failed to report issue'); }
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

  // Status icon + label for the compact card header (§orders-v2)
  const STATUS_PRESENTATION = {
    PENDING:    { tone: 'amber',  glyph: 'clock',  label: 'Order placed' },
    ACCEPTED:   { tone: 'blue',   glyph: 'check',  label: 'Accepted' },
    PREPARING:  { tone: 'orange', glyph: 'clock',  label: 'Preparing' },
    READY:      { tone: 'accent', glyph: 'bell',   label: 'Ready for pickup' },
    COMPLETED:  { tone: 'green',  glyph: 'check',  label: 'Completed' },
    REJECTED:   { tone: 'red',    glyph: 'x',      label: 'Order rejected' },
    CANCELLED:  { tone: 'red',    glyph: 'x',      label: 'Order cancelled' },
  };

  const StatusGlyph = ({ glyph }) => {
    if (glyph === 'check') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>;
    }
    if (glyph === 'x') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
    }
    if (glyph === 'bell') {
      return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
    }
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline></svg>;
  };

  const logout = async () => {
    await authService.logout();
    navigate('/');
  };

  return (
    <div className="page-wrapper bg-white">
      <Header title="Orders" showBack={false} />

      <main className="explore-container orders-container">
        <div className="orders-layout">
          {/* Account sidebar — desktop only (§orders-v2) */}
          <aside className="orders-sidebar desktop-only">
            <div className="orders-user-card">
              <div className="orders-user-avatar">{(user?.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
              <div>
                <p className="orders-user-name">{user?.name || 'Student'}</p>
                <p className="orders-user-email">{user?.email}</p>
              </div>
            </div>
            <nav className="orders-side-nav" aria-label="Account">
              <span className="orders-side-link active">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                My Orders
              </span>
              <button className="orders-side-link" onClick={() => navigate('/student/profile?view=account')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Account
              </button>
              <button className="orders-side-link" onClick={() => navigate('/student/profile?view=settings')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Settings
              </button>
              <button className="orders-side-link" onClick={() => navigate('/student/profile?view=help')}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Help
              </button>
              <button className="orders-side-link danger" onClick={logout}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Logout
              </button>
            </nav>
          </aside>

          {/* Orders list */}
          <section className="orders-main">
            <h1 className="page-title">My Orders</h1>

            {loading ? (
              <div className="skeleton-row" aria-busy="true" style={{ marginTop: '1rem' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.9rem' }}>
                    <Skeleton height="16px" width="55%" />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <Skeleton height="52px" width="52px" borderRadius="8px" />
                      <Skeleton height="52px" width="52px" borderRadius="8px" />
                      <Skeleton height="52px" width="52px" borderRadius="8px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="state-block">
                <p className="state-title">Something went wrong</p>
                <p className="state-sub">{error}</p>
                <button className="primary-btn" onClick={fetchOrders}>Try Again</button>
              </div>
            ) : filteredOrders.length === 0 ? (
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
              <>
                {orders.length > 0 && (
                  <div className="filter-pills" style={{ marginBottom: '0.9rem' }}>
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

                <div className="orders-list">
                  {filteredOrders.map(order => {
                    const pres = STATUS_PRESENTATION[order.rawStatus] || STATUS_PRESENTATION.PENDING;
                    const expanded = expandedId === order.id;
                    const thumbItems = order.items.slice(0, 5);
                    const moreCount = order.items.length - thumbItems.length;
                    return (
                      <div key={order.id} className={`ocard ${expanded ? 'expanded' : ''}`}>
                        {/* Compact header row — click to expand details */}
                        <div
                          className="ocard-head"
                          onClick={() => setExpandedId(expanded ? null : order.id)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={expanded}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : order.id); } }}
                        >
                          <span className={`ostatus-icon ${pres.tone}`} aria-hidden="true"><StatusGlyph glyph={pres.glyph} /></span>
                          <div className="ocard-titles">
                            <p className="ocard-title">{pres.label}</p>
                            <p className="ocard-meta">
                              {order.outletName} · ₹{order.total} · {order.date} · {order.orderType}
                            </p>
                          </div>
                          <svg className={`ocard-chevron ${expanded ? 'open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </div>

                        {/* Item thumbnails — compact, horizontal, +X more */}
                        <div className="thumbs-row">
                          {thumbItems.map((item, idx) => (
                            <div key={idx} className="thumb" title={`${item.quantity} × ${item.name}`}>
                              {item.image ? (
                                <img src={item.image} alt={item.name} loading="lazy" />
                              ) : (
                                <span className="thumb-fallback" aria-hidden="true">{item.name.charAt(0)}</span>
                              )}
                              <span className="thumb-qty">{item.quantity}×</span>
                            </div>
                          ))}
                          {moreCount > 0 && <div className="thumb thumb-more">+{moreCount}</div>}
                        </div>

                        {/* Expanded details — order summary (§orders-v2) */}
                        {expanded && (
                          <div className="ocard-expanded">
                            <OrderStepper order={order} />

                            {showPickupCode(order.rawStatus) && order.pickupCode && (
                              <div className="pickup-panel">
                                <span className="pickup-label">PICKUP CODE</span>
                                <span className="pickup-code">{order.pickupCode}</span>
                                <span className="pickup-note">Show this at the outlet counter</span>
                              </div>
                            )}

                            <p className="osummary-heading">{order.items.length} item{order.items.length !== 1 ? 's' : ''} in this order</p>
                            <div className="osummary-items">
                              {order.items.map((item, idx) => (
                                <div key={idx} className="osummary-item">
                                  <div className="osummary-thumb">
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} loading="lazy" />
                                    ) : (
                                      <span className="thumb-fallback" aria-hidden="true">{item.name.charAt(0)}</span>
                                    )}
                                  </div>
                                  <div className="osummary-item-info">
                                    <p className="osummary-item-name">{item.name}</p>
                                    <p className="osummary-item-qty">{item.quantity} × ₹{item.price}</p>
                                  </div>
                                  <span className="osummary-item-total">₹{item.price * item.quantity}</span>
                                </div>
                              ))}
                            </div>

                            {/* Bill details */}
                            <p className="osummary-heading">Bill details</p>
                            <div className="bill-details">
                              <div className="bill-row"><span>Item total</span><span>₹{order.subtotal}</span></div>
                              {order.discount > 0 && (
                                <div className="bill-row discount"><span>Discount</span><span>−₹{order.discount}</span></div>
                              )}
                              <div className="bill-row"><span>Platform fee</span><span>₹{order.platformFee}</span></div>
                              <div className="bill-row total"><span>Total</span><span>₹{order.total}</span></div>
                            </div>

                            {/* Order details */}
                            <p className="osummary-heading">Order details</p>
                            <div className="order-meta-block">
                              <p className="ometa-label">Order id</p>
                              <p className="ometa-value">
                                {order.orderNumber}
                                <button
                                  className="copy-btn"
                                  title="Copy order id"
                                  aria-label="Copy order id"
                                  onClick={() => { navigator.clipboard?.writeText(order.orderNumber); toast.success('Order id copied'); }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                              </p>
                              <p className="ometa-label">Payment</p>
                              <p className="ometa-value">{order.paymentStatus === 'PAID' ? 'Paid via Razorpay' : order.paymentStatus === 'REFUNDED' ? 'Refunded' : 'Payment pending'}</p>
                              <p className="ometa-label">Order type</p>
                              <p className="ometa-value">{order.orderType}</p>
                              <p className="ometa-label">Order placed</p>
                              <p className="ometa-value">{order.date}</p>
                            </div>

                            <div className="ocard-actions">
                              {order.rawStatus === 'PENDING' && (
                                <button
                                  className="order-secondary-btn danger"
                                  onClick={() => handleCancel(order.id)}
                                  disabled={cancellingId === order.id}
                                >
                                  {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                                </button>
                              )}
                              {order.outletId && (
                                <button
                                  className="order-again-btn"
                                  onClick={() => navigate(`/student/outlet/${order.outletId}`)}
                                >
                                  Order again
                                </button>
                              )}
                              {order.rawStatus === 'COMPLETED' && (
                                <button
                                  className="order-secondary-btn amber"
                                  onClick={() => setReviewingId(reviewingId === order.id ? null : order.id)}>
                                  {reviewingId === order.id ? 'Close' : 'Rate ⭐'}
                                </button>
                              )}
                            </div>

                            {reviewingId === order.id && (
                              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                  {[1,2,3,4,5].map(s => (
                                    <button key={s} onClick={() => setReviewRating(s)}
                                      aria-label={`${s} star`}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: s <= reviewRating ? '#f59e0b' : '#d1d5db' }}>★</button>
                                  ))}
                                </div>
                                {order.items.filter(it => it.menuItemId).length > 0 && (
                                  <div style={{ margin: '0.25rem 0 0.6rem 0' }}>
                                    <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Rate the food (optional):</p>
                                    {order.items.filter(it => it.menuItemId).map(it => (
                                      <div key={it.menuItemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {it.name} × {it.quantity}
                                        </span>
                                        <span style={{ display: 'flex', gap: '0.1rem', flexShrink: 0 }}>
                                          {[1,2,3,4,5].map(star => (
                                            <button key={star}
                                              onClick={() => setItemRatings(prev => ({ ...prev, [it.menuItemId]: star }))}
                                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0 1px', color: star <= (itemRatings[it.menuItemId] || 0) ? '#f59e0b' : '#d1d5db' }}>★</button>
                                          ))}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <textarea placeholder="Share your experience (optional)..." value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical', marginBottom: '0.5rem' }} />
                                <button className="primary-btn" style={{ maxWidth: '150px' }}
                                  onClick={() => handleSubmitReview(order.id, order.outletId)}>Submit Review</button>
                              </div>
                            )}

                            <button onClick={() => setDisputeOrderId(disputeOrderId === order.id ? null : order.id)}
                              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: '0.5rem' }}>
                              {disputeOrderId === order.id ? '▾ Cancel report' : '▸ Report an issue'}
                            </button>
                            {disputeOrderId === order.id && (
                              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                                <select value={disputeType} onChange={(e) => setDisputeType(e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                  <option value='ORDER_ISSUE'>Order issue (wrong/missing items)</option>
                                  <option value='PAYMENT_ISSUE'>Payment issue</option>
                                  <option value='REFUND_REQUEST'>Refund request</option>
                                  <option value='OTHER'>Other</option>
                                </select>
                                <textarea placeholder='Describe the issue...' value={disputeDesc}
                                  onChange={(e) => setDisputeDesc(e.target.value)}
                                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', minHeight: '60px', resize: 'vertical', marginBottom: '0.5rem' }} />
                                <button className='primary-btn' style={{ maxWidth: '150px' }}
                                  onClick={() => handleReportIssue(order.id, order.outletId)}>Submit Report</button>
                              </div>
                            )}

                            {order.timeline.length > 0 && (
                              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                                <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Timeline</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {order.timeline.map((t, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                      <span>{TIMELINE_LABELS[t.status] || t.status}</span>
                                      <span style={{ color: '#9ca3af' }}>·</span>
                                      <span>{t.at ? new Date(t.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Orders;
