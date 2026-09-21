import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { ordersService } from '../../services/orders/ordersService';
import { catalogService } from '../../services/catalog/catalogService';
import { useAuth } from '../../hooks/useAuth';

const STATUS_TABS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const STATUS_COLOR = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// What action buttons to show per current status (spec §8.6 transitions)
const TRANSITIONS = {
  PENDING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('PENDING');
  const [actionReason, setActionReason] = useState({}); // orderId -> reason text

  // Fetch the outlet's orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'outlet', 'list', { status: activeTab }],
    queryFn: () => ordersService.listOutletOrders({ status: activeTab === 'ALL' ? undefined : activeTab, pageSize: 100 }),
    refetchInterval: 30_000, // 30s polling fallback if socket.io fails
  });

  // Get my outlet info (for the header)
  const { data: outlets } = useQuery({
    queryKey: ['outlets', 'list'],
    queryFn: catalogService.getOutlets,
  });
  const myOutlet = outlets?.find((o) => o.id === user?.outletId);

  // Status transition mutation
  const transitionMut = useMutation({
    mutationFn: ({ orderId, status, reason }) =>
      ordersService.updateOutletOrderStatus(orderId, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', 'outlet', 'list'] });
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Transition failed');
    },
  });

  const handleTransition = (orderId, newStatus) => {
    const reason = newStatus === 'REJECTED' || newStatus === 'CANCELLED'
      ? (actionReason[orderId] || '')
      : undefined;
    transitionMut.mutate({ orderId, status: newStatus, reason });
  };

  return (
    <div className="page-wrapper">
      <Header />
      <main className="explore-container" style={{ maxWidth: '1400px' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="welcome-greeting">Welcome back, {user?.name || 'Outlet'}</p>
            <h1 className="page-title">{myOutlet?.name || 'Outlet Dashboard'}</h1>
            <p className="page-subtitle">
              {myOutlet?.status ? `Status: ${myOutlet.status}` : 'Loading outlet…'}
            </p>
          </div>
          <button className="pill" onClick={() => { logout(); navigate('/'); }} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            Logout
          </button>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].map((s) => (
            <div key={s} className="outlet-card" style={{ padding: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '0.25rem' }}>{s}</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                {orders.filter((o) => o.status === s).length}
              </p>
            </div>
          ))}
        </div>

        {/* Status tabs */}
        <div className="filter-pills" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              className={`pill ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-light)' }}>Loading orders…</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-light)' }}>
            <p>No orders in this status.</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => {
              const outletSnapshot = (() => { try { return JSON.parse(order.outletSnapshot || '{}'); } catch { return {}; } })();
              const timeline = (() => { try { return JSON.parse(order.timeline || '[]'); } catch { return []; } })();
              const lastEvent = timeline[timeline.length - 1];
              const allowedNext = TRANSITIONS[order.status] || [];

              return (
                <div key={order.id} className={`order-card ${STATUS_COLOR[order.status] || ''}`}>
                  <div className="order-header">
                    <div>
                      <h3 className="order-outlet">#{order.orderNumber}</h3>
                      <p className="order-date">
                        {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="order-number">Pickup code: <strong>{order.pickupCode}</strong></p>
                      {order.notes && <p style={{ marginTop: '0.25rem', color: 'var(--text-gray)', fontSize: '0.85rem' }}>Note: {order.notes}</p>}
                    </div>
                    <div className={`order-status ${STATUS_COLOR[order.status] || ''}`}>
                      {order.status}
                    </div>
                  </div>

                  <div className="order-items-container">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="order-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <span className="item-quantity">{item.quantity} ×</span>
                          <span className="item-name" style={{ marginLeft: '0.5rem' }}>{item.name}</span>
                        </div>
                        <span className="item-price">₹{Number(item.itemTotal)}</span>
                      </div>
                    ))}
                    <div className="order-total" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)' }}>
                      <span className="total-label">Total</span>
                      <span className="total-amount">₹{Number(order.totalAmount)}</span>
                    </div>
                  </div>

                  {(allowedNext.includes('REJECTED') || allowedNext.includes('CANCELLED')) && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={actionReason[order.id] || ''}
                        onChange={(e) => setActionReason((p) => ({ ...p, [order.id]: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--input-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  {allowedNext.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      {allowedNext.map((nextStatus) => (
                        <button
                          key={nextStatus}
                          className={nextStatus === 'REJECTED' || nextStatus === 'CANCELLED' ? 'checkout-btn schedule-btn' : 'checkout-btn order-now-btn'}
                          onClick={() => handleTransition(order.id, nextStatus)}
                          disabled={transitionMut.isPending}
                          style={{ flex: '1 1 auto', minWidth: '120px' }}
                        >
                          {nextStatus === 'ACCEPTED' && 'Accept'}
                          {nextStatus === 'REJECTED' && 'Reject'}
                          {nextStatus === 'PREPARING' && 'Start preparing'}
                          {nextStatus === 'READY' && 'Mark ready'}
                          {nextStatus === 'COMPLETED' && 'Complete'}
                          {nextStatus === 'CANCELLED' && 'Cancel'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timeline */}
                  {timeline.length > 0 && (
                    <details style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                      <summary style={{ cursor: 'pointer' }}>Timeline ({timeline.length} events)</summary>
                      <ol style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        {timeline.map((ev, idx) => (
                          <li key={idx}>
                            <strong>{ev.status}</strong> — {new Date(ev.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                            {ev.by ? ` (by ${ev.by})` : ''}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
