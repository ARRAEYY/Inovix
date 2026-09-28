import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { orderService } from '../../services/api/orderService';

const FILTERS = ['All time', 'Today', 'Yesterday', 'Past Week'];

// Backend status enum → the display label the card renders.
const STATUS_LABELS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Derive the timeframe bucket the filter tabs use.
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

// Map a backend order onto the fields the order card renders.
const mapOrder = (o) => {
  let outletName = 'Campus outlet';
  try {
    outletName = JSON.parse(o.outletSnapshot || '{}').name || outletName;
  } catch {
    // keep fallback
  }
  return {
    id: o.orderNumber,
    outletName,
    date: formatWhen(o.createdAt),
    timeframe: timeframeOf(o.createdAt),
    items: (o.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
    total: Math.round(Number(o.totalAmount)),
    status: STATUS_LABELS[o.status] || o.status,
  };
};

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All time');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await orderService.getMyOrders();
        setOrders((res.data || []).map(mapOrder));
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load orders');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'All time') return true;
    if (activeFilter === 'Today') return order.timeframe === 'today';
    if (activeFilter === 'Yesterday') return order.timeframe === 'yesterday';
    if (activeFilter === 'Past Week') return order.timeframe === 'past_week' || order.timeframe === 'yesterday' || order.timeframe === 'today';
    return true;
  });

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
          </div>
        ) : (
        <>
        <div className="page-header desktop-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button 
              onClick={() => navigate('/student')}
              title="Back to outlets"
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                padding: '0', 
                color: 'var(--text-gray)',
                marginBottom: '1.25rem',
                display: 'block'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1 className="page-title">Your Orders</h1>
            <p className="page-subtitle">View your past orders and reorder favorites</p>
          </div></div>

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
                  <button className="order-again-btn" onClick={() => alert('Order again feature coming soon!')}>
                    Order again
                  </button>
                </div>
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
