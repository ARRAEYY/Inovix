/**
 * Outlet dashboard — for OUTLET_STAFF / OUTLET_ADMIN roles.
 *
 * Layout: header + KPI row + orders table.
 *   - KPI row: counts per status (PENDING/ACCEPTED/PREPARING/READY/COMPLETED)
 *     via GET /api/v1/outlet/orders/kpis
 *   - Orders table: the outlet's recent orders with status + action buttons
 *     (ACCEPT → PREPARE → READY → COMPLETE) via PATCH /api/v1/outlet/orders/:id/status
 *   - Live updates via Socket.IO (order:new + order:status:changed) invalidate
 *     the orders + KPI queries.
 */

'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Clock,
  ListChecks,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppHeader } from './app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import { outletApi } from '@/lib/nosh/api';
import { onOrderStatusChanged, onOrderNew } from '@/lib/nosh/socket';
import {
  formatINR,
  formatRelativeTime,
  orderStatusPill,
  parseJSON,
} from '@/lib/nosh/format';
import { toastMutationError } from '@/hooks/nosh/providers';
import type { Order, OrderStatus, OutletKPIs } from '@/lib/nosh/types';

const ORDERS_KEY = ['nosh', 'outlet', 'orders'] as const;
const KPI_KEY = ['nosh', 'outlet', 'kpis'] as const;

export function OutletView() {
  const qc = useQueryClient();

  // Subscribe to realtime updates — invalidate both queries.
  useEffect(() => {
    const offNew = onOrderNew(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: KPI_KEY });
    });
    const offChanged = onOrderStatusChanged(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: KPI_KEY });
    });
    return () => {
      offNew();
      offChanged();
    };
  }, [qc]);

  const { data: kpis, isLoading: kpiLoading } = useQuery<OutletKPIs>({
    queryKey: KPI_KEY,
    queryFn: () => outletApi.kpis(),
    refetchInterval: 15_000, // Poll as a backstop in case socket is behind a proxy.
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ORDERS_KEY,
    queryFn: () => outletApi.listOrders(),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50/40 via-background to-background dark:from-orange-950/10">
      <AppHeader contextLabel="Outlet dashboard" />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        <KPIRow kpis={kpis} loading={kpiLoading} />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4 text-orange-500" /> Live orders
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ORDERS_KEY });
                  qc.invalidateQueries({ queryKey: KPI_KEY });
                }}
              >
                <RefreshCw className="size-3.5" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <OrdersTable orders={orders} loading={ordersLoading} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function KPIRow({ kpis, loading }: { kpis?: OutletKPIs; loading: boolean }) {
  const cards: {
    key: OrderStatus;
    label: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    { key: 'PENDING', label: 'Pending', icon: <Clock className="size-4" />, accent: 'text-amber-600' },
    { key: 'ACCEPTED', label: 'Accepted', icon: <CheckCircle2 className="size-4" />, accent: 'text-sky-600' },
    { key: 'PREPARING', label: 'Preparing', icon: <ChefHat className="size-4" />, accent: 'text-orange-600' },
    { key: 'READY', label: 'Ready', icon: <Package className="size-4" />, accent: 'text-emerald-600' },
    { key: 'COMPLETED', label: 'Completed', icon: <ListChecks className="size-4" />, accent: 'text-zinc-600' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.key} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
              <span className={c.accent}>{c.icon}</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-12 mt-2" />
            ) : (
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {kpis?.[c.key] ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrdersTable({ orders, loading }: { orders?: Order[]; loading: boolean }) {
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      outletApi.updateOrderStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData<Order[]>(ORDERS_KEY, (prev) =>
        prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev,
      );
      qc.invalidateQueries({ queryKey: KPI_KEY });
      toast.success(`Order ${updated.orderNumber} → ${updated.status}`);
    },
    onError: (e) => toastMutationError(e, 'Could not update order status'),
  });

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <div className="size-14 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
          <AlertCircle className="size-7 text-orange-500" />
        </div>
        <p className="font-medium">No active orders</p>
        <p className="text-sm text-muted-foreground">
          New orders will appear here the moment a student checks out.
        </p>
      </div>
    );
  }

  // Sort: pending first, then by created_at desc.
  const sorted = [...orders].sort((a, b) => {
    const rank = (s: OrderStatus) =>
      ({ PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, REJECTED: 5, CANCELLED: 6 }[
        s
      ] ?? 99);
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <ScrollArea className="max-h-[calc(100vh-380px)]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[120px]">Order</TableHead>
            <TableHead className="w-[110px]">Placed</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="w-[80px] text-right">Total</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[180px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((order) => (
            <OutletOrderRow
              key={order.id}
              order={order}
              updatingId={
                statusMutation.isPending
                  ? (statusMutation.variables as { id: string; status: OrderStatus } | undefined)?.id
                  : undefined
              }
              onStatus={(status) => statusMutation.mutate({ id: order.id, status })}
            />
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function OutletOrderRow({
  order,
  onStatus,
  updatingId,
}: {
  order: Order;
  onStatus: (s: OrderStatus) => void;
  updatingId?: string;
}) {
  const pill = orderStatusPill(order.status);
  const outlet = parseJSON<{ name?: string }>(order.outletSnapshot, {});
  void outlet;
  const itemsSummary = order.items
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(', ');
  const isUpdating = updatingId === order.id;

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <div className="leading-tight">
          <div>{order.orderNumber}</div>
          {order.pickupCode && (
            <div className="text-[10px] text-muted-foreground">
              Pickup: <span className="font-semibold">{order.pickupCode}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatRelativeTime(order.createdAt)}
      </TableCell>
      <TableCell className="text-xs">
        <div className="line-clamp-2 max-w-[280px]">{itemsSummary}</div>
        {order.notes && (
          <div className="text-[10px] text-muted-foreground mt-0.5 italic line-clamp-1">
            “{order.notes}”
          </div>
        )}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {formatINR(order.totalAmount)}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`${pill.className} border`}>
          {pill.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <ActionButtons
          status={order.status}
          onStatus={onStatus}
          updating={isUpdating}
        />
      </TableCell>
    </TableRow>
  );
}

function ActionButtons({
  status,
  onStatus,
  updating,
}: {
  status: OrderStatus;
  onStatus: (s: OrderStatus) => void;
  updating: boolean;
}) {
  // Primary progression button + the disabled-state for terminal statuses.
  const next: { label: string; to: OrderStatus; className: string } | null =
    status === 'PENDING'
      ? { label: 'Accept', to: 'ACCEPTED', className: 'bg-sky-500 hover:bg-sky-600 text-white' }
      : status === 'ACCEPTED'
      ? { label: 'Prepare', to: 'PREPARING', className: 'bg-orange-500 hover:bg-orange-600 text-white' }
      : status === 'PREPARING'
      ? { label: 'Ready', to: 'READY', className: 'bg-emerald-500 hover:bg-emerald-600 text-white' }
      : status === 'READY'
      ? { label: 'Complete', to: 'COMPLETED', className: 'bg-zinc-700 hover:bg-zinc-800 text-white' }
      : null;

  if (!next) {
    return (
      <span className="text-xs text-muted-foreground italic">No actions</span>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => onStatus(next.to)}
      disabled={updating}
      className={`gap-1.5 ${next.className}`}
    >
      {updating ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {next.label}
    </Button>
  );
}
