import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';

// Mock data for previous orders
const MOCK_ORDERS = [
  {
    id: 'ORD-1234',
    outletName: 'The Courtyard Café',
    date: 'Today, 2:30 PM',
    timeframe: 'today',
    items: [
      { name: 'Cold Coffee', quantity: 1, price: 120 },
      { name: 'Grilled Sandwich', quantity: 1, price: 150 }
    ],
    total: 270,
    status: 'Completed'
  },
  {
    id: 'ORD-1235',
    outletName: 'inosa District',
    date: 'Yesterday, 8:15 PM',
    timeframe: 'yesterday',
    items: [
      { name: 'Masala Dosa', quantity: 2, price: 180 },
      { name: 'Filter Coffee', quantity: 2, price: 80 }
    ],
    total: 260,
    status: 'Completed'
  },
  {
    id: 'ORD-1236',
    outletName: 'Campus Thali Co.',
    date: '5 days ago, 1:00 PM',
    timeframe: 'past_week',
    items: [
      { name: 'Special North Thali', quantity: 1, price: 200 }
    ],
    total: 200,
    status: 'Completed'
  },
  {
    id: 'ORD-1237',
    outletName: 'Brew & Bites',
    date: '3 weeks ago, 10:30 AM',
    timeframe: 'older',
    items: [
      { name: 'Cappuccino', quantity: 1, price: 110 },
      { name: 'Blueberry Muffin', quantity: 1, price: 90 }
    ],
    total: 200,
    status: 'Completed'
  }
];

const FILTERS = ['All time', 'Today', 'Yesterday', 'Past Week'];

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [activeFilter, setActiveFilter] = useState('All time');

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'All time') return true;
    if (activeFilter === 'Today') return order.timeframe === 'today';
    if (activeFilter === 'Yesterday') return order.timeframe === 'yesterday';
    if (activeFilter === 'Past Week') return order.timeframe === 'past_week' || order.timeframe === 'yesterday' || order.timeframe === 'today';
    return true;
  });

  // Function to simulate having no orders
  const clearOrders = () => setOrders([]);

  return (
    <div className="page-wrapper bg-white">
      <Header title="Orders" showBack={false} />
      
      <main className="explore-container orders-container">
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
          </div>
          {orders.length > 0 && (
            <button className="pill" onClick={clearOrders} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              Test Empty State
            </button>
          )}
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
      </main>
      
      <MobileBottomNav />
    </div>
  );
};

export default Orders;
