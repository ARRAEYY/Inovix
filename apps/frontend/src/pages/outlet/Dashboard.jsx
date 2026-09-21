import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronDown, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/layout/Header';
import { ordersService } from '../../services/orders/ordersService';
import { catalogService } from '../../services/catalog/catalogService';
import { useAuth } from '../../hooks/useAuth';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';

const STATUS_TABS = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const STATUS_CLASSES = {
  PENDING: 'bg-warning/10 text-warning border-warning/20',
  ACCEPTED: 'bg-accent/10 text-accent border-accent/20',
  PREPARING: 'bg-accent/10 text-accent border-accent/20',
  READY: 'bg-success/10 text-success border-success/20',
  COMPLETED: 'bg-muted text-muted-foreground border-border',
  REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
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
  ACCEPTED: { label: 'Accept', icon: Check, kind: 'primary' },
  REJECTED: { label: 'Reject', icon: X, kind: 'destructive' },
  PREPARING: { label: 'Start prep', icon: Clock, kind: 'primary' },
  READY: { label: 'Mark ready', icon: Check, kind: 'primary' },
  COMPLETED: { label: 'Complete', icon: Check, kind: 'primary' },
  CANCELLED: { label: 'Cancel', icon: X, kind: 'destructive' },
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

  // For KPIs — fetch all status counts by getting "ALL" via separate tab queries
  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders', 'outlet', 'all'],
    queryFn: () => ordersService.listOutletOrders({ pageSize: 200 }),
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
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['orders', 'outlet', 'list'] });
      qc.invalidateQueries({ queryKey: ['orders', 'outlet', 'all'] });
      toast.success(`Order moved to ${variables.status}`, {
        description: `Pickup code ${orders.find(o => o.id === variables.orderId)?.pickupCode || ''}`,
      });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Transition failed');
    },
  });

  const handleTransition = (orderId, newStatus) => {
    const reason = newStatus === 'REJECTED' || newStatus === 'CANCELLED'
      ? (actionReason[orderId] || '')
      : undefined;
    transitionMut.mutate({ orderId, status: newStatus, reason });
  };

  const kpis = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].map((s) => ({
    status: s,
    count: allOrders.filter((o) => o.status === s).length,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between mb-8"
        >
          <div>
            <p className="text-sm text-muted-foreground mb-1">Welcome back, {user?.name || 'Outlet'}</p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
              {myOutlet?.name || 'Outlet Dashboard'}
            </h1>
            <p className="text-base text-muted-foreground mt-2">
              {myOutlet?.status ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${myOutlet.status === 'OPEN' ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                  Status: {myOutlet.status}
                </span>
              ) : 'Loading outlet…'}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 border border-border bg-card text-foreground text-sm font-semibold rounded-lg hover:bg-muted transition-colors inline-flex items-center gap-2"
            onClick={() => { logout(); navigate('/'); }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </motion.button>
        </motion.div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {kpis.map((kpi, idx) => (
            <motion.div
              key={kpi.status}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{kpi.status}</p>
              <p className="text-3xl font-bold text-foreground">
                <AnimatedNumber value={kpi.count} />
              </p>
            </motion.div>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              className={`relative px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'bg-card border border-border text-foreground hover:bg-muted'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 -z-10 rounded-xl bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Orders */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading orders…</div>
        ) : orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-24"
          >
            <div className="inline-flex w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
              <Clock className="text-muted-foreground" size={24} />
            </div>
            <p className="text-muted-foreground">No orders in this status.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {orders.map((order) => {
                const timeline = (() => { try { return JSON.parse(order.timeline || '[]'); } catch { return []; } })();
                const allowedNext = TRANSITIONS[order.status] || [];

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-5 flex items-start justify-between gap-4 border-b border-border">
                      <div>
                        <h3 className="font-semibold text-foreground">#{order.orderNumber}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pickup code: <span className="font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">{order.pickupCode}</span>
                        </p>
                        {order.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">Note: {order.notes}</p>
                        )}
                      </div>
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${STATUS_CLASSES[order.status]}`}>
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
                        <span className="font-bold text-foreground text-base">₹{Number(order.totalAmount)}</span>
                      </div>
                    </div>

                    {(allowedNext.includes('REJECTED') || allowedNext.includes('CANCELLED')) && (
                      <div className="px-5 pb-3">
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={actionReason[order.id] || ''}
                          onChange={(e) => setActionReason((p) => ({ ...p, [order.id]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary"
                        />
                      </div>
                    )}

                    {allowedNext.length > 0 && (
                      <div className="px-5 pb-5 flex gap-2 flex-wrap">
                        {allowedNext.map((nextStatus) => {
                          const cfg = ACTION_LABELS[nextStatus];
                          const Icon = cfg.icon;
                          const isPrimary = cfg.kind === 'primary';
                          return (
                            <motion.button
                              key={nextStatus}
                              whileTap={{ scale: 0.97 }}
                              className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${
                                isPrimary
                                  ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm'
                                  : 'border border-destructive/30 bg-card text-destructive hover:bg-destructive/5'
                              }`}
                              onClick={() => handleTransition(order.id, nextStatus)}
                              disabled={transitionMut.isPending}
                            >
                              <Icon className="w-4 h-4" />
                              {cfg.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {timeline.length > 0 && (
                      <details className="px-5 pb-5 text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                          <ChevronDown className="w-3 h-3" />
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
