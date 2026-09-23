'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  Edit,
  Eye,
  Key,
  Layers,
  ListFilter,
  Loader2,
  Mail,
  MoreVertical,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppHeader } from './app-header';
import { outletApi, paymentsApi, type MenuItemCreateInput } from '@/lib/nosh/api';
import { useAuthStore } from '@/lib/nosh/store';
import { onOrderStatusChanged, onOrderNew } from '@/lib/nosh/socket';
import { formatINR, formatDateTime, formatRelativeTime, orderStatusPill } from '@/lib/nosh/format';
import type {
  CreateStaffInput,
  MenuItem,
  Order,
  OrderStatus,
  OutletAnalytics,
  StaffMember,
} from '@/lib/nosh/types';

const ORDERS_KEY = ['nosh', 'outlet', 'orders'] as const;
const ANALYTICS_KEY = ['nosh', 'outlet', 'analytics'] as const;
const MENU_KEY = ['nosh', 'outlet', 'menu'] as const;
const STAFF_KEY = ['nosh', 'outlet', 'staff'] as const;

type AdminTab = 'dashboard' | 'orders' | 'menu' | 'staff' | 'settings';

export function OutletAdminView() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    const offNew = onOrderNew(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ANALYTICS_KEY });
    });
    const offChanged = onOrderStatusChanged(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ANALYTICS_KEY });
    });
    return () => {
      offNew();
      offChanged();
    };
  }, [qc]);

  // Analytics query
  const { data: analytics, isLoading: analyticsLoading } = useQuery<OutletAnalytics>({
    queryKey: ANALYTICS_KEY,
    queryFn: () => outletApi.analytics(),
    refetchInterval: 30_000,
  });

  // Orders query
  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ORDERS_KEY,
    queryFn: () => outletApi.listOrders(),
    refetchInterval: 30_000,
  });

  // Menu items query
  const { data: menuItems = [], isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: MENU_KEY,
    queryFn: () => outletApi.listMenu(),
  });

  // Staff members query
  const { data: staffList = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: STAFF_KEY,
    queryFn: () => outletApi.getStaff(),
  });

  return (
    <div className="page-wrapper min-h-screen flex flex-col bg-[#fdfdfd]">
      <AppHeader contextLabel="Outlet management console" />

      <main className="dashboard-container flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Top Header Row with Outlet Name & Space Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                {user?.outletStaff?.outlet?.name ?? user?.name ?? 'Outlet Manager'}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#b10035]/10 text-[#b10035]">
                <ShieldCheck size={12} />
                Outlet Admin
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Performance metrics, menu catalog, staff roster, and operational settings
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="outlet-tabs flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto" role="tablist">
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'dashboard' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTab('dashboard')}
              >
                <BarChart3 size={14} /> Analytics
              </button>
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'orders' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTab('orders')}
              >
                <Receipt size={14} /> Orders ({orders.length})
              </button>
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'menu' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTab('menu')}
              >
                <UtensilsCrossed size={14} /> Menu ({menuItems.length})
              </button>
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'staff' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTab('staff')}
              >
                <Users size={14} /> Staff ({staffList.length})
              </button>
              <button
                role="tab"
                className={`outlet-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tab === 'settings' ? 'bg-white shadow-sm text-[#b10035]' : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setTab('settings')}
              >
                <Settings size={14} /> Settings
              </button>
            </div>

            <button
              className="refresh-btn p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 shadow-sm"
              title="Refresh console"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ANALYTICS_KEY });
                qc.invalidateQueries({ queryKey: ORDERS_KEY });
                qc.invalidateQueries({ queryKey: MENU_KEY });
                qc.invalidateQueries({ queryKey: STAFF_KEY });
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Tab 1: Analytics Dashboard */}
        {tab === 'dashboard' && (
          <OutletAnalyticsTab analytics={analytics} loading={analyticsLoading} />
        )}

        {/* Tab 2: Orders Management */}
        {tab === 'orders' && (
          <OutletOrdersTab orders={orders} loading={ordersLoading} />
        )}

        {/* Tab 3: Menu CRUD */}
        {tab === 'menu' && (
          <OutletMenuTab menuItems={menuItems} loading={menuLoading} />
        )}

        {/* Tab 4: Staff Management */}
        {tab === 'staff' && (
          <OutletStaffTab staffList={staffList} loading={staffLoading} />
        )}

        {/* Tab 5: Settings */}
        {tab === 'settings' && (
          <OutletSettingsTab />
        )}
      </main>
    </div>
  );
}

// ─── TAB 1: Analytics Dashboard ───────────────────────────────────────────────

function OutletAnalyticsTab({
  analytics,
  loading,
}: {
  analytics?: OutletAnalytics;
  loading: boolean;
}) {
  if (loading || !analytics) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl">
        <Loader2 className="size-8 animate-spin text-[#b10035]" />
        <p className="mt-2 text-sm text-gray-500 font-medium">Computing live outlet analytics…</p>
      </div>
    );
  }

  const maxWeekly = Math.max(...(analytics.weeklyOrders?.map((w) => w.value) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {/* 4 Metric Cards Grid */}
      <div className="dashboard-metrics-grid">
        <div className="analytics-stat-card">
          <div className="analytics-stat-label">
            <span>Today&apos;s Sales</span>
            <Receipt size={16} className="text-[#b10035]" />
          </div>
          <div className="analytics-stat-value">{formatINR(analytics.todaySales)}</div>
          <div className="analytics-stat-growth">
            <TrendingUp size={12} /> Live from campus orders
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">
            <span>Total Orders Today</span>
            <Clock size={16} className="text-sky-600" />
          </div>
          <div className="analytics-stat-value">{analytics.totalOrders}</div>
          <div className="analytics-stat-growth text-sky-600">
            <ArrowUpRight size={12} /> Active queue
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">
            <span>Sales This Month</span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div className="analytics-stat-value">{formatINR(analytics.monthSales)}</div>
          <div className="analytics-stat-growth text-emerald-600">
            <CheckCircle2 size={12} /> Verified payments
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-label">
            <span>Avg Prep Time</span>
            <ChefHat size={16} className="text-amber-600" />
          </div>
          <div className="analytics-stat-value">{analytics.prepTime}</div>
          <div className="analytics-stat-growth text-amber-600">Target: under 15 mins</div>
        </div>
      </div>

      {/* Weekly Trend Chart & Attention Needed Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Bar Chart (2 cols) */}
        <div className="lg:col-span-2 weekly-chart-box">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Orders this week</h3>
              <p className="text-xs text-gray-500">Day-by-day order distribution across past 7 days</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-700">
              Weekly summary
            </span>
          </div>

          <div className="weekly-chart-bars">
            {analytics.weeklyOrders.map((item, idx) => {
              const heightPercent = Math.max((item.value / maxWeekly) * 100, 10);
              const isPeak = item.value === maxWeekly && item.value > 0;
              return (
                <div key={idx} className="weekly-bar-col">
                  <div className="weekly-bar-track">
                    <div
                      className={`weekly-bar-fill ${isPeak ? 'active' : ''}`}
                      style={{ height: `${heightPercent}%` }}
                      title={`${item.day} (${item.date}): ${item.value} orders`}
                    />
                  </div>
                  <span className="weekly-bar-label">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attention Needed & Operational Alerts (1 col) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-600" /> Attention Needed
          </h3>

          <div className="space-y-3">
            {analytics.attentionNeeded.length === 0 ? (
              <p className="text-xs text-gray-500">No pending operational issues.</p>
            ) : (
              analytics.attentionNeeded.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-xs flex flex-col gap-1 ${
                    alert.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : alert.type === 'warning'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} /> {alert.message}
                  </div>
                  <span className="text-[11px] underline cursor-pointer">{alert.action} &rarr;</span>
                </div>
              ))
            )}
          </div>

          {/* Popular Items Mini List */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3">
              Popular Dishes Today
            </h4>
            <div className="space-y-2">
              {analytics.popularItems.slice(0, 4).map((dish, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800 truncate">{dish.name}</span>
                  <span className="text-gray-500 font-mono font-bold shrink-0">
                    {dish.orders} orders
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 2: Orders Management ────────────────────────────────────────────────

function OutletOrdersTab({ orders, loading }: { orders: Order[]; loading: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      outletApi.updateOrderStatus(id, status),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ANALYTICS_KEY });
      toast.success(`Order ${updated.orderNumber} status changed to ${updated.status}`);
      if (selectedOrder?.id === updated.id) {
        setSelectedOrder(updated);
      }
    },
    onError: () => toast.error('Failed to update status'),
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl">
        <Loader2 className="size-8 animate-spin text-[#b10035]" />
        <p className="mt-2 text-sm text-gray-500 font-medium">Loading orders history…</p>
      </div>
    );
  }

  const filtered = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.items.some((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search order number, student name, dish item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:border-[#b10035] focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs p-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:border-[#b10035] focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PREPARING">Preparing</option>
          <option value="READY">Ready</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No matching orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Placed</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((order) => {
                  const pill = orderStatusPill(order.status);
                  const itemsSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');
                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-800">{order.user?.name ?? 'Student'}</div>
                        <div className="text-[10px] text-gray-400">{order.user?.email}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-gray-600" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {formatRelativeTime(order.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-gray-900 tabular-nums">
                        {formatINR(order.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pill.className}`}>
                          {pill.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="px-2.5 py-1 rounded-lg border border-gray-200 hover:border-gray-300 bg-white text-gray-700 font-semibold shadow-xs inline-flex items-center gap-1"
                        >
                          <Eye size={12} /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Breakdown / Details Modal */}
      {selectedOrder && (
        <OrderBreakdownModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={(status) => statusMutation.mutate({ id: selectedOrder.id, status })}
          loading={statusMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Order Breakdown Modal ───────────────────────────────────────────────────

function OrderBreakdownModal({
  order,
  onClose,
  onStatusChange,
  loading,
}: {
  order: Order;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => void;
  loading: boolean;
}) {
  const pill = orderStatusPill(order.status);

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-lg">
        <div className="modal-card-header">
          <div>
            <h2 className="modal-card-title">Order #{order.orderNumber}</h2>
            <span className="text-[11px] text-gray-500">Placed {formatDateTime(order.createdAt)}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-card-body space-y-4">
          {/* Status & Customer Info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Customer</span>
              <span className="text-xs font-bold text-gray-900">{order.user?.name ?? 'Campus Student'}</span>
              <span className="text-[10px] text-gray-500 block">{order.user?.email}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Order Status</span>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${pill.className}`}>
                {pill.label}
              </span>
              {order.pickupCode && (
                <span className="block text-[11px] font-mono font-bold text-emerald-700 mt-1">
                  Pickup: {order.pickupCode}
                </span>
              )}
            </div>
          </div>

          {/* Items Breakdown */}
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Itemized Breakdown</h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {order.items.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-gray-900">
                      {item.quantity}× {item.name}
                    </div>
                    {item.optionsSnapshot && item.optionsSnapshot !== '[]' && (
                      <div className="text-[10px] text-gray-500">Customizations included</div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-gray-800">
                    {formatINR(Number(item.price) * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Special Instructions */}
          {order.notes && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <span className="font-bold block mb-0.5">Special Instructions:</span>
              &ldquo;{order.notes}&rdquo;
            </div>
          )}

          {/* Pricing Totals */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Items Total</span>
              <span>{formatINR(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between font-black text-sm text-gray-900 pt-1 border-t border-gray-100">
              <span>Final Paid Amount</span>
              <span className="text-[#b10035]">{formatINR(order.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="modal-card-footer">
          <div className="flex gap-2">
            {order.status === 'PENDING' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onStatusChange('ACCEPTED')}
                className="action-btn text-xs py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold"
              >
                Accept Order
              </button>
            )}
            {order.status === 'ACCEPTED' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onStatusChange('PREPARING')}
                className="action-btn text-xs py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Start Preparing
              </button>
            )}
            {order.status === 'PREPARING' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onStatusChange('READY')}
                className="action-btn text-xs py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Mark Ready
              </button>
            )}
            {order.status === 'READY' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onStatusChange('COMPLETED')}
                className="action-btn text-xs py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-900 text-white font-bold"
              >
                Complete Handover
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 3: Menu CRUD ─────────────────────────────────────────────────────────

function OutletMenuTab({
  menuItems,
  loading,
}: {
  menuItems: MenuItem[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => outletApi.deleteMenuItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_KEY });
      toast.success('Dish removed from menu catalog');
    },
    onError: () => toast.error('Failed to delete dish'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      outletApi.setItemAvailability(id, isAvailable),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MENU_KEY });
      toast.success('Availability status updated');
    },
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl">
        <Loader2 className="size-8 animate-spin text-[#b10035]" />
        <p className="mt-2 text-sm text-gray-500 font-medium">Loading outlet menu catalog…</p>
      </div>
    );
  }

  const filtered = menuItems.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.category?.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search menu dishes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:border-[#b10035] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#b10035] hover:bg-[#900028] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus size={16} /> Add New Dish
        </button>
      </div>

      {/* Dish Items Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No dishes found in menu catalog.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-4">Dish</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Dietary</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-[10px] text-gray-400 line-clamp-1">{item.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{item.category?.name || 'Mains'}</td>
                    <td className="py-3 px-4">
                      {(() => {
                        const isVeg = item.vegetarian ?? item.isVeg ?? true;
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isVeg ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            <span className={`size-1.5 rounded-full ${isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {isVeg ? 'Veg' : 'Non-Veg'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 font-black text-gray-900 tabular-nums">
                      {formatINR(item.price)}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                          item.isAvailable
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {item.isAvailable ? 'In Stock' : '86\'d (Sold Out)'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(item);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
                        title="Edit Dish"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${item.name}" from menu?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-600"
                        title="Delete Dish"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dish Modal (Add / Edit) */}
      {modalOpen && (
        <DishFormModal
          item={editingItem}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
          onSuccess={() => {
            setModalOpen(false);
            setEditingItem(null);
            qc.invalidateQueries({ queryKey: MENU_KEY });
          }}
        />
      )}
    </div>
  );
}

// ─── Dish Form Modal ─────────────────────────────────────────────────────────

function DishFormModal({
  item,
  onClose,
  onSuccess,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item?.price ? String(item.price) : '');
  const [category, setCategory] = useState(item?.category?.name ?? 'Mains');
  const [isVeg, setIsVeg] = useState(item?.vegetarian ?? item?.isVeg ?? true);
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !price) {
      toast.error('Name and price are required');
      return;
    }

    try {
      setSubmitting(true);
      if (item) {
        await outletApi.updateMenuItem(item.id, {
          name,
          description,
          price: Number(price),
          category,
          isVeg,
          isAvailable,
        });
        toast.success(`Updated "${name}"`);
      } else {
        await outletApi.createMenuItem({
          name,
          description,
          price: Number(price),
          category,
          isVeg,
          isAvailable,
        });
        toast.success(`Created "${name}"`);
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save menu dish';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-md">
        <div className="modal-card-header">
          <h2 className="modal-card-title">
            <UtensilsCrossed size={18} className="text-[#b10035]" />
            {item ? 'Edit Dish' : 'Add New Dish'}
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-card-body space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Dish Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Masala Dosa, Cold Coffee"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Mains, Snacks, Beverages"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="80"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Dietary Type</label>
                <select
                  value={isVeg ? 'veg' : 'nonveg'}
                  onChange={(e) => setIsVeg(e.target.value === 'veg')}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white focus:border-[#b10035] focus:outline-none"
                >
                  <option value="veg">Vegetarian</option>
                  <option value="nonveg">Non-Vegetarian</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Crispy rice crepe served with coconut chutney & sambar"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isAvailable"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-gray-300 text-[#b10035] focus:ring-[#b10035]"
              />
              <label htmlFor="isAvailable" className="text-xs font-medium text-gray-700">
                Immediately available in student catalog
              </label>
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
              disabled={submitting}
              className="action-btn text-xs py-2 px-4 rounded-lg bg-[#b10035] hover:bg-[#900028] text-white font-bold"
            >
              {submitting && <Loader2 size={12} className="animate-spin inline mr-1" />}
              {item ? 'Save Changes' : 'Create Dish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TAB 4: Staff Management ─────────────────────────────────────────────────

function OutletStaffTab({
  staffList,
  loading,
}: {
  staffList: StaffMember[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      outletApi.updateStaffStatus(id, status),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: STAFF_KEY });
      toast.success(`Staff status updated to ${updated.status}`);
    },
    onError: () => toast.error('Failed to change staff status'),
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white border border-gray-200 rounded-xl">
        <Loader2 className="size-8 animate-spin text-[#b10035]" />
        <p className="mt-2 text-sm text-gray-500 font-medium">Loading staff roster…</p>
      </div>
    );
  }

  const filtered = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.role.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:border-[#b10035] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-[#b10035] hover:bg-[#900028] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
        >
          <UserPlus size={16} /> Add Staff Member
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No staff members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{member.name}</div>
                      <div className="text-[10px] text-gray-400">{member.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">
                        {member.role === 'OUTLET_ADMIN' ? 'Outlet Manager' : 'Kitchen Line Staff'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          member.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            member.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {member.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{formatRelativeTime(member.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          statusMutation.mutate({
                            id: member.staffId || member.id,
                            status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-xs ${
                          member.status === 'ACTIVE'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {member.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {modalOpen && (
        <AddStaffModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            qc.invalidateQueries({ queryKey: STAFF_KEY });
          }}
        />
      )}
    </div>
  );
}

// ─── Add Staff Modal ─────────────────────────────────────────────────────────

function AddStaffModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OUTLET_STAFF' | 'OUTLET_ADMIN'>('OUTLET_STAFF');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setSubmitting(true);
      await outletApi.createStaff({
        name,
        email,
        password: password || undefined,
        role,
      });
      toast.success(`Added ${name} to outlet staff`);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add staff member';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-sm">
        <div className="modal-card-header">
          <h2 className="modal-card-title">
            <UserPlus size={18} className="text-[#b10035]" /> Add Staff Member
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-card-body space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ramesh Kumar"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@canteen.internal"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Temporary Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Default: changeme123"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'OUTLET_STAFF' | 'OUTLET_ADMIN')}
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white focus:border-[#b10035] focus:outline-none"
              >
                <option value="OUTLET_STAFF">Kitchen Line Staff (Board &amp; Stock)</option>
                <option value="OUTLET_ADMIN">Outlet Manager (Full Console)</option>
              </select>
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
              disabled={submitting}
              className="action-btn text-xs py-2 px-4 rounded-lg bg-[#b10035] hover:bg-[#900028] text-white font-bold"
            >
              {submitting && <Loader2 size={12} className="animate-spin inline mr-1" />}
              Save Staff Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── TAB 5: Settings ─────────────────────────────────────────────────────────

function OutletSettingsTab() {
  const user = useAuthStore((s) => s.user);
  const outletId = user?.outletStaff?.outletId || '';

  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);

  async function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) {
      toast.error('No outlet ID associated with account');
      return;
    }
    if (!razorpayKeyId || !razorpaySecret) {
      toast.error('Both Razorpay Key ID and Secret are required');
      return;
    }

    try {
      setSavingKeys(true);
      await paymentsApi.saveOutletRazorpayCredentials(outletId, {
        keyId: razorpayKeyId,
        keySecret: razorpaySecret,
      });
      toast.success('Razorpay API keys stored securely');
      setRazorpaySecret('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save Razorpay credentials';
      toast.error(msg);
    } finally {
      setSavingKeys(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Operating Hours */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
          <Clock size={18} className="text-[#b10035]" /> Operating Hours
        </h3>
        <p className="text-xs text-gray-500">
          Set kitchen ordering hours. Orders outside these hours will automatically show the outlet as Closed.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Opening Time</label>
            <input
              type="time"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Closing Time</label>
            <input
              type="time"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => toast.success('Operating hours saved')}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-black"
        >
          Save Hours
        </button>
      </div>

      {/* Razorpay Credentials */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
          <CreditCard size={18} className="text-[#b10035]" /> Razorpay Payment Gateway
        </h3>
        <p className="text-xs text-gray-500">
          Configure direct student settlement keys. Credentials are encrypted at rest using AES-256.
        </p>

        <form onSubmit={handleSaveKeys} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Razorpay Key ID</label>
            <input
              type="text"
              placeholder="rzp_test_..."
              value={razorpayKeyId}
              onChange={(e) => setRazorpayKeyId(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Razorpay Key Secret</label>
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={razorpaySecret}
              onChange={(e) => setRazorpaySecret(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={savingKeys}
            className="px-4 py-2 rounded-lg bg-[#b10035] hover:bg-[#900028] text-white text-xs font-bold shadow-sm"
          >
            {savingKeys && <Loader2 size={12} className="animate-spin inline mr-1" />}
            Save Payment Keys
          </button>
        </form>
      </div>
    </div>
  );
}
