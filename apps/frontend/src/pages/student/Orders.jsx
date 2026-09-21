import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../../components/layout/Header';
import { ordersService } from '../../services/orders/ordersService';

const FILTERS = ['All time', 'Today', 'Yesterday', 'Past Week'];

const STATUS_CLASSES = {
  PENDING: 'bg-warning/10 text-warning',
  ACCEPTED: 'bg-accent-light text-accent',
  PREPARING: 'bg-accent-light text-accent',
  READY: 'bg-success/10 text-success',
  COMPLETED: 'bg-muted text-muted-foreground',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-destructive/10 text-destructive',
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <button
            className="mb-4 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm"
            onClick={() => navigate('/student')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to outlets
          </button>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Your Orders</h1>
          <p className="text-base text-muted-foreground mt-1">View your past orders and reorder favorites</p>
        </div>

        {orders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeFilter === filter ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading your orders…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">No order history yet</h2>
            <p className="text-muted-foreground text-sm mb-6">Looks like you haven't placed any orders. Discover your favorite campus food now!</p>
            <button
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover transition-colors"
              onClick={() => navigate('/student')}
            >
              Order now
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => {
              const outletSnapshot = (() => { try { return JSON.parse(order.outletSnapshot || '{}'); } catch { return {}; } })();
              return (
                <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-4 border-b border-border">
                    <div>
                      <h3 className="font-semibold text-foreground">{outletSnapshot.name || 'Outlet'}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">#{order.orderNumber} · Pickup: <span className="font-mono font-medium text-foreground">{order.pickupCode}</span></p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[order.status] || 'bg-muted text-muted-foreground'}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="px-5 py-3 space-y-1">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <div>
                          <span className="text-muted-foreground">{item.quantity} ×</span>
                          <span className="text-foreground ml-2">{item.name}</span>
                        </div>
                        <span className="text-foreground">₹{Number(item.itemTotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="px-5 py-3 flex items-center justify-between border-t border-border bg-muted/30">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="text-lg font-bold text-foreground">₹{Number(order.totalAmount)}</span>
                    </div>
                    {order.status === 'COMPLETED' && (
                      <button
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors"
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
