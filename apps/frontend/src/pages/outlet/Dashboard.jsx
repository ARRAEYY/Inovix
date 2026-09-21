import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { ordersService } from '../../services/orders/ordersService';
import { catalogService } from '../../services/catalog/catalogService';
import { useAuth } from '../../hooks/useAuth';

const STATUS_TABS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const STATUS_CLASSES = {
  PENDING: 'bg-warning/10 text-warning',
  ACCEPTED: 'bg-accent-light text-accent',
  PREPARING: 'bg-accent-light text-accent',
  READY: 'bg-success/10 text-success',
  COMPLETED: 'bg-muted text-muted-foreground',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

const TRANSITIONS = {
  PENDING: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

const ACTION_LABELS = {
  ACCEPTED: 'Accept',
  REJECTED: 'Reject',
  PREPARING: 'Start preparing',
  READY: 'Mark ready',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel',
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('PENDING');
  const [actionReason, setActionReason] = useState({});

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', 'outlet', 'list', { status: activeTab }],
    queryFn: () => ordersService.listOutletOrders({ status: activeTab, pageSize: 100 }),
    refetchInterval: 30_000,
  });

  const { data: outlets } = useQuery({
    queryKey: ['outlets', 'list'],
    queryFn: catalogService.getOutlets,
  });
  const myOutlet = outlets?.find((o) => o.id === user?.outletId);

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

  // KPI counters
  const allStatusCounts = STATUS_TABS.reduce((acc, s) => {
    acc[s] = 0;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Welcome back, {user?.name || 'Outlet'}</p>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{myOutlet?.name || 'Outlet Dashboard'}</h1>
            <p className="text-base text-muted-foreground mt-1">
              {myOutlet?.status ? `Status: ${myOutlet.status}` : 'Loading outlet…'}
            </p>
          </div>
          <button
            className="px-4 py-2 border border-border bg-card text-foreground text-sm font-semibold rounded-lg hover:bg-muted transition-colors"
            onClick={() => { logout(); navigate('/'); }}
          >
            Logout
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].map((s) => {
            const count = orders.filter((o) => o.status === s).length;
            return (
              <div key={s} className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s}</p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No orders in this status.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const timeline = (() => { try { return JSON.parse(order.timeline || '[]'); } catch { return []; } })();
              const allowedNext = TRANSITIONS[order.status] || [];

              return (
                <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-4 border-b border-border">
                    <div>
                      <h3 className="font-semibold text-foreground">#{order.orderNumber}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Pickup code: <span className="font-mono font-semibold text-foreground">{order.pickupCode}</span>
                      </p>
                      {order.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">Note: {order.notes}</p>
                      )}
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASSES[order.status]}`}>
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
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-dashed border-border">
                      <span className="text-xs text-muted-foreground">Total</span>
                      <span className="font-bold text-foreground">₹{Number(order.totalAmount)}</span>
                    </div>
                  </div>

                  {(allowedNext.includes('REJECTED') || allowedNext.includes('CANCELLED')) && (
                    <div className="px-5 pb-3">
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={actionReason[order.id] || ''}
                        onChange={(e) => setActionReason((p) => ({ ...p, [order.id]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                      />
                    </div>
                  )}

                  {allowedNext.length > 0 && (
                    <div className="px-5 pb-5 flex gap-2 flex-wrap">
                      {allowedNext.map((nextStatus) => {
                        const isReject = nextStatus === 'REJECTED' || nextStatus === 'CANCELLED';
                        return (
                          <button
                            key={nextStatus}
                            className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isReject ? 'border border-border bg-card text-destructive hover:bg-destructive/5' : 'bg-primary text-primary-foreground hover:bg-primary-hover'}`}
                            onClick={() => handleTransition(order.id, nextStatus)}
                            disabled={transitionMut.isPending}
                          >
                            {ACTION_LABELS[nextStatus]}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {timeline.length > 0 && (
                    <details className="px-5 pb-5 text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground transition-colors">
                        Timeline ({timeline.length} events)
                      </summary>
                      <ol className="mt-2 pl-5 list-decimal space-y-0.5">
                        {timeline.map((ev, idx) => (
                          <li key={idx}>
                            <span className="font-semibold text-foreground">{ev.status}</span>
                            {' — '}
                            {new Date(ev.at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
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
