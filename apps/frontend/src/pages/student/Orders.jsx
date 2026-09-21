import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../../components/layout/Header';
import { ordersService } from '../../services/orders/ordersService';

const FILTERS = ['All time', 'Today', 'Yesterday', 'Past Week'];

const STATUS_BADGE = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const Orders = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All time');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'student', 'list'],
    queryFn: () => ordersService.listMyOrders({ pageSize: 50 }),
  });

  const filtered = orders.filter((order) => {
    if (activeFilter === 'All time') return true;
    const created = new Date(order.createdAt);
    const now = new Date();
    const diffH = (now - created) / (1000 * 60 * 60);
    if (activeFilter === 'Today') return diffH < 24;
    if (activeFilter === 'Yesterday') return diffH >= 24 && diffH < 48;
    if (activeFilter === 'Past Week') return diffH < 24 * 7;
    return true;
  });

  return (
    <div className="page-wrapper">
      <Header />

      <main className="explore-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button
              onClick={() => navigate('/student')}
              title="Back to outlets"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                color: 'var(--text-gray)', marginBottom: '1.25rem', display: 'block',
              }}
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
            {FILTERS.map((filter) => (
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

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>Loading your orders…</div>
        ) : filtered.length === 0 ? (
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
            {filtered.map((order) => {
              const outletSnapshot = (() => { try { return JSON.parse(order.outletSnapshot || '{}'); } catch { return {}; } })();
              return (
                <div key={order.id} className={`order-card ${STATUS_BADGE[order.status] || ''}`}>
                  <div className="order-header">
                    <div>
                      <h3 className="order-outlet">{outletSnapshot.name || 'Outlet'}</h3>
                      <p className="order-date">
                        {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="order-number">#{order.orderNumber} · Pickup: {order.pickupCode}</p>
                    </div>
                    <div className={`order-status ${STATUS_BADGE[order.status] || ''}`}>
                      {order.status}
                    </div>
                  </div>

                  <div className="order-items-container">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="order-item">
                        <span className="item-quantity">{item.quantity} ×</span>
                        <span className="item-name">{item.name}</span>
                        <span className="item-price">₹{Number(item.itemTotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="order-footer">
                    <div className="order-total">
                      <span className="total-label">Total</span>
                      <span className="total-amount">₹{Number(order.totalAmount)}</span>
                    </div>
                    {order.status === 'COMPLETED' && (
                      <button
                        className="order-again-btn"
                        onClick={() => navigate(`/student/outlet/${order.outletId}`)}
                      >
                        Order again
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Orders;
