'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  KeyRound,
  ListChecks,
  Loader2,
  LogOut,
  Package,
  Receipt,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppHeader } from './app-header';
import { outletApi } from '@/lib/nosh/api';
import { useAuthStore } from '@/lib/nosh/store';
import { onOrderStatusChanged, onOrderNew } from '@/lib/nosh/socket';
import { formatINR, formatDateTime, formatRelativeTime } from '@/lib/nosh/format';
import type { MenuItem, Order, OrderStatus, OutletKPIs } from '@/lib/nosh/types';

const ORDERS_KEY = ['nosh', 'outlet', 'orders'] as const;
const KPIS_KEY = ['nosh', 'outlet', 'kpis'] as const;
const MENU_KEY = ['nosh', 'outlet', 'menu'] as const;

type StaffTab = 'board' | 'stock' | 'profile';

export function OutletStaffView() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<StaffTab>('board');

  // Socket updates invalidate active queries
  useEffect(() => {
    const offNew = onOrderNew(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: KPIS_KEY });
    });
    const offChanged = onOrderStatusChanged(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: KPIS_KEY });
    });
    return () => {
      offNew();
      offChanged();
    };
  }, [qc]);

  const { data: kpis, isLoading: kpiLoading } = useQuery<OutletKPIs>({
    queryKey: KPIS_KEY,
    queryFn: () => outletApi.kpis(),
    refetchInterval: 15_000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ORDERS_KEY,
    queryFn: () => outletApi.listOrders(),
    refetchInterval: 30_000,
  });

  const { data: menuItems = [], isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: MENU_KEY,
    queryFn: () => outletApi.listMenu(),
  });

  return (
    <div className="page-wrapper min-h-screen flex flex-col bg-[#fafafa]">
      <AppHeader contextLabel="Kitchen terminal" />

      <main className="dashboard-container flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Top Header Row with Shift Badge and Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                {user?.outletStaff?.outlet?.name ?? user?.name ?? 'Kitchen Station'}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Terminal
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Staff Member: <strong className="text-gray-700">{user?.name}</strong> · Role: Line Kitchen Staff
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="outlet-tabs flex gap-1 p-1 bg-gray-100 rounded-xl" role="tablist">
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'board' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('board')}
              >
                <ChefHat size={14} /> Kitchen Board
              </button>
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'stock' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('stock')}
              >
                <SlidersHorizontal size={14} /> Menu Stock (86&apos;d)
              </button>
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'profile' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setActiveTab('profile')}
              >
                <UserIcon size={14} /> Shift &amp; Profile
              </button>
            </div>

            <button
              className="refresh-btn p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 shadow-sm"
              title="Refresh kitchen data"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ORDERS_KEY });
                qc.invalidateQueries({ queryKey: KPIS_KEY });
                qc.invalidateQueries({ queryKey: MENU_KEY });
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Tab 1: Kitchen Kanban Board */}
        {activeTab === 'board' && (
          <div className="space-y-6">
            <KitchenKPIBanner kpis={kpis} loading={kpiLoading} />
            <KitchenKanbanBoard orders={orders} loading={ordersLoading} />
          </div>
        )}

        {/* Tab 2: Menu Stock Toggle (86'd items) */}
        {activeTab === 'stock' && (
          <KitchenStockManagement menuItems={menuItems} loading={menuLoading} />
        )}

        {/* Tab 3: Staff Profile & Station */}
        {activeTab === 'profile' && (
          <KitchenStaffProfile orders={orders} />
        )}
      </main>
    </div>
  );
}

// ─── Kitchen KPI Row ─────────────────────────────────────────────────────────

function KitchenKPIBanner({ kpis, loading }: { kpis?: OutletKPIs; loading: boolean }) {
  const cards: { key: OrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'ACCEPTED', label: 'Accepted / Incoming', icon: <Receipt size={16} />, color: 'text-sky-600' },
    { key: 'PREPARING', label: 'In Prep', icon: <ChefHat size={16} />, color: 'text-amber-600' },
    { key: 'READY', label: 'Ready for Pickup', icon: <Package size={16} />, color: 'text-emerald-600' },
    { key: 'COMPLETED', label: 'Done Today', icon: <ListChecks size={16} />, color: 'text-zinc-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.key} className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide">
            <span>{c.label}</span>
            <span className={c.color}>{c.icon}</span>
          </div>
          <div className="mt-1 text-2xl font-black text-gray-900 tabular-nums">
            {loading ? '—' : (kpis?.[c.key] ?? 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Kitchen Kanban Board ─────────────────────────────────────────────────────

function KitchenKanbanBoard({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const qc = useQueryClient();
  const [verifyOrderId, setVerifyOrderId] = useState<string | null>(null);
  const [declineOrderId, setDeclineOrderId] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      outletApi.updateOrderStatus(id, status, reason),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: KPIS_KEY });
      toast.success(`Order ${updated.orderNumber} updated to ${updated.status}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update order';
      toast.error(msg);
    },
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl">
        <Loader2 className="size-8 animate-spin text-[#b10035]" />
        <p className="mt-2 text-sm text-gray-500 font-medium">Loading active kitchen orders…</p>
      </div>
    );
  }

  // Filter orders by Kanban stage
  const incoming = orders.filter((o) => o.status === 'PENDING' || o.status === 'ACCEPTED');
  const preparing = orders.filter((o) => o.status === 'PREPARING');
  const ready = orders.filter((o) => o.status === 'READY');

  return (
    <>
      <div className="order-board">
        {/* Column 1: Incoming / Accepted */}
        <div className="kanban-col-wrapper">
          <div className="order-column">
            <div className="column-header">
              <h3 className="column-title">
                <Receipt size={16} className="text-sky-600" /> Incoming ({incoming.length})
              </h3>
              <span className="order-count">{incoming.length}</span>
            </div>
            <div className="column-content">
              {incoming.length === 0 ? (
                <div className="empty-state">No incoming orders</div>
              ) : (
                incoming.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    primaryAction={{
                      label: order.status === 'PENDING' ? 'Accept Order' : 'Start Preparing',
                      action: () =>
                        statusMutation.mutate({
                          id: order.id,
                          status: order.status === 'PENDING' ? 'ACCEPTED' : 'PREPARING',
                        }),
                      className: 'bg-sky-600 hover:bg-sky-700 text-white',
                    }}
                    secondaryAction={{
                      label: 'Decline',
                      action: () => setDeclineOrderId(order.id),
                    }}
                    loading={statusMutation.isPending}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 2: In Preparation */}
        <div className="kanban-col-wrapper">
          <div className="order-column">
            <div className="column-header">
              <h3 className="column-title">
                <ChefHat size={16} className="text-amber-600" /> In Prep ({preparing.length})
              </h3>
              <span className="order-count bg-amber-600">{preparing.length}</span>
            </div>
            <div className="column-content">
              {preparing.length === 0 ? (
                <div className="empty-state">No orders in preparation</div>
              ) : (
                preparing.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    primaryAction={{
                      label: 'Mark as Ready',
                      action: () => statusMutation.mutate({ id: order.id, status: 'READY' }),
                      className: 'bg-amber-600 hover:bg-amber-700 text-white',
                    }}
                    loading={statusMutation.isPending}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Ready for Pickup */}
        <div className="kanban-col-wrapper">
          <div className="order-column">
            <div className="column-header">
              <h3 className="column-title">
                <Package size={16} className="text-emerald-600" /> Ready for Pickup ({ready.length})
              </h3>
              <span className="order-count bg-emerald-600">{ready.length}</span>
            </div>
            <div className="column-content">
              {ready.length === 0 ? (
                <div className="empty-state">No orders awaiting pickup</div>
              ) : (
                ready.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    primaryAction={{
                      label: 'Verify 4-Digit Code',
                      action: () => setVerifyOrderId(order.id),
                      className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                    }}
                    loading={statusMutation.isPending}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Verify Pickup Code Modal */}
      {verifyOrderId && (
        <VerifyPickupModal
          orderId={verifyOrderId}
          onClose={() => setVerifyOrderId(null)}
          onSuccess={() => {
            setVerifyOrderId(null);
            qc.invalidateQueries({ queryKey: ORDERS_KEY });
            qc.invalidateQueries({ queryKey: KPIS_KEY });
          }}
        />
      )}

      {/* Decline Order Modal */}
      {declineOrderId && (
        <DeclineOrderModal
          orderId={declineOrderId}
          onClose={() => setDeclineOrderId(null)}
          onSubmit={(reason) => {
            statusMutation.mutate({ id: declineOrderId, status: 'REJECTED', reason });
            setDeclineOrderId(null);
          }}
        />
      )}
    </>
  );
}

// ─── Kitchen Order Card ───────────────────────────────────────────────────────

function KitchenOrderCard({
  order,
  primaryAction,
  secondaryAction,
  loading,
}: {
  order: Order;
  primaryAction: { label: string; action: () => void; className: string };
  secondaryAction?: { label: string; action: () => void };
  loading?: boolean;
}) {
  return (
    <div className="outlet-order-card">
      <div className="order-card-header">
        <div>
          <span className="order-id">#{order.orderNumber}</span>
          <span className="block text-[11px] text-gray-500 font-medium">
            {order.user?.name ?? 'Student'}
          </span>
        </div>
        <div className="text-right">
          <span className="order-time">
            <Clock size={12} /> {formatRelativeTime(order.createdAt)}
          </span>
          {order.pickupCode && (
            <span className="block text-[10px] font-mono font-bold text-emerald-700">
              CODE: {order.pickupCode}
            </span>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="order-card-items">
        {order.items.map((item) => (
          <div key={item.id} className="order-item-row">
            <span className="item-qty">{item.quantity}×</span>
            <span className="item-name">{item.name}</span>
          </div>
        ))}
      </div>

      {/* Special Kitchen Notes */}
      {order.notes && (
        <div className="order-notes-box">
          <AlertCircle size={12} className="inline mr-1" />
          &ldquo;{order.notes}&rdquo;
        </div>
      )}

      {/* Actions */}
      <div className="order-actions-row">
        {secondaryAction && (
          <button
            type="button"
            className="action-btn btn-decline text-xs py-2 px-3 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 font-semibold"
            disabled={loading}
            onClick={secondaryAction.action}
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          type="button"
          className={`action-btn text-xs py-2 px-4 rounded-lg font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 ${primaryAction.className}`}
          disabled={loading}
          onClick={primaryAction.action}
        >
          {loading && <Loader2 size={12} className="animate-spin" />}
          {primaryAction.label}
        </button>
      </div>
    </div>
  );
}

// ─── Verify Pickup Modal ──────────────────────────────────────────────────────

function VerifyPickupModal({
  orderId,
  onClose,
  onSuccess,
}: {
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || code.trim().length !== 4) {
      setError('Please enter the complete 4-digit pickup code');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await outletApi.verifyPickup(orderId, code.trim());
      toast.success('Pickup verified! Order completed.');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid pickup code. Check student screen.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-sm">
        <div className="modal-card-header">
          <h2 className="modal-card-title">
            <KeyRound size={18} className="text-[#b10035]" /> Verify Pickup Code
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-card-body">
            <p className="text-xs text-gray-500">
              Ask the student to display their 4-digit numeric pickup code from their active order screen.
            </p>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="my-2">
              <input
                type="text"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="verify-pickup-input"
              />
            </div>
          </div>

          <div className="modal-card-footer">
            <button
              type="button"
              className="action-btn text-xs py-2 px-3 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || code.length !== 4}
              className="action-btn text-xs py-2 px-4 rounded-lg bg-[#b10035] hover:bg-[#900028] text-white font-bold disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              Confirm Handover
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Decline Order Modal ──────────────────────────────────────────────────────

function DeclineOrderModal({
  orderId,
  onClose,
  onSubmit,
}: {
  orderId: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('Item out of stock');
  const [notes, setNotes] = useState('');

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-sm">
        <div className="modal-card-header">
          <h2 className="modal-card-title text-red-600">
            <XCircle size={18} /> Decline Order
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-card-body">
          <p className="text-xs text-gray-500">
            Declining an order will notify the student and initiate an automatic refund.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white"
              >
                <option value="Item out of stock">Item out of stock (86&apos;d)</option>
                <option value="Kitchen at capacity">Kitchen at peak capacity</option>
                <option value="Closing station">Station closing soon</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Additional note (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Ran out of paneer for rolls"
                className="w-full text-xs p-2 border border-gray-200 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="modal-card-footer">
          <button
            type="button"
            className="action-btn text-xs py-2 px-3 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(`${reason}${notes ? ` - ${notes}` : ''}`)}
            className="action-btn text-xs py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
          >
            Confirm Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Kitchen Stock Quick Management (86'd items) ────────────────────────

function KitchenStockManagement({
  menuItems,
  loading,
}: {
  menuItems: MenuItem[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('ALL');

  const stockMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      outletApi.setItemAvailability(id, isAvailable),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: MENU_KEY });
      toast.success(`${updated.name} marked as ${updated.isAvailable ? 'In Stock' : '86\'d (Sold Out)'}`);
    },
    onError: () => toast.error('Failed to update item availability'),
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl">
        <Loader2 className="size-8 animate-spin text-[#b10035]" />
        <p className="mt-2 text-sm text-gray-500 font-medium">Loading menu items for stock toggle…</p>
      </div>
    );
  }

  // Extract categories
  const categories = Array.from(new Set(menuItems.map((m) => m.category?.name || 'Mains'))).sort();

  // Filter
  const filtered = menuItems.filter((item) => {
    const catName = item.category?.name || 'Mains';
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      catName.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCat === 'ALL' || catName === selectedCat;
    return matchesSearch && matchesCat;
  });

  const availableCount = menuItems.filter((m) => m.isAvailable).length;
  const soldOutCount = menuItems.length - availableCount;

  return (
    <div className="space-y-6">
      {/* Banner info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-[#b10035]" /> Instant Stock Toggles (86&apos;d Items)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Toggle switches to instantly 86 an ingredient or dish when it runs out. Changes reflect across all student carts immediately.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            {availableCount} In Stock
          </div>
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
            {soldOutCount} 86&apos;d (Sold Out)
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search dish name or ingredient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:border-[#b10035] focus:outline-none"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCat === 'ALL'
                ? 'bg-[#b10035] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setSelectedCat('ALL')}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCat === cat
                  ? 'bg-[#b10035] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Cards Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white border border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500 font-medium">No dishes match your filter</p>
        </div>
      ) : (
        <div className="stock-grid">
          {filtered.map((item) => {
            const isPending = stockMutation.isPending && (stockMutation.variables as { id: string } | undefined)?.id === item.id;
            const isVeg = item.vegetarian ?? item.isVeg ?? true;
            return (
              <div
                key={item.id}
                className={`stock-card ${!item.isAvailable ? 'out-of-stock' : ''}`}
              >
                <div className="stock-card-info">
                  <div className="stock-card-name">
                    <span
                      className={`inline-block size-2.5 rounded-full shrink-0 ${
                        isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <div className="stock-card-meta">{item.category?.name || 'Mains'}</div>
                  <div className="stock-card-price">{formatINR(item.price)}</div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <label className="stock-switch" aria-label={`Toggle availability for ${item.name}`}>
                    <input
                      type="checkbox"
                      checked={item.isAvailable}
                      disabled={isPending}
                      onChange={(e) =>
                        stockMutation.mutate({ id: item.id, isAvailable: e.target.checked })
                      }
                    />
                    <span className="stock-slider" />
                  </label>
                  <span
                    className={`text-[10px] font-bold ${
                      item.isAvailable ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {item.isAvailable ? 'In Stock' : '86\'d (Sold Out)'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Staff Profile & Station ──────────────────────────────────────────

function KitchenStaffProfile({ orders }: { orders: Order[] }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clear);

  const completedToday = orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-gradient-to-tr from-[#b10035] to-[#f43f5e] text-white flex items-center justify-center font-bold text-2xl shadow-md">
            {user?.name?.[0] ?? 'S'}
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">{user?.name}</h2>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <span className="mt-1 inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-gray-100 text-gray-700">
              Kitchen Line Staff
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block">Assigned Outlet</span>
            <span className="text-sm font-black text-gray-900 flex items-center gap-1.5 mt-0.5">
              <Store size={14} className="text-[#b10035]" />
              {user?.outletStaff?.outlet?.name ?? 'Main Campus Canteen'}
            </span>
          </div>

          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block">Shift Completed</span>
            <span className="text-sm font-black text-emerald-700 flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 size={14} />
              {completedToday} orders
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Account ID</span>
            <span className="font-mono text-gray-700 font-semibold">{user?.id?.slice(-8)}</span>
          </div>
          <div className="flex justify-between text-xs py-1.5 border-b border-gray-100">
            <span className="text-gray-500">Shift Started</span>
            <span className="text-gray-700 font-semibold">{formatDateTime(new Date().toISOString())}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            clearAuth();
            toast.success('Signed out from kitchen terminal');
          }}
          className="w-full py-2.5 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut size={14} /> End Shift &amp; Sign Out
        </button>
      </div>
    </div>
  );
}
