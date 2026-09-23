/**
 * Student orders list — shows the user's past + active orders.
 * Supports cancelling PENDING orders (POST /api/v1/orders/:id/cancel).
 * Live-updates via Socket.IO when an outlet changes a status — the
 * useEffect subscription invalidates the orders query.
 */

'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Loader2,
  Package,
  ReceiptText,
  RotateCcw,
  XCircle,
  CheckCircle2,
  ChefHat,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ordersApi } from '@/lib/nosh/api';
import { onOrderStatusChanged } from '@/lib/nosh/socket';
import {
  formatINR,
  formatRelativeTime,
  orderStatusPill,
  parseJSON,
} from '@/lib/nosh/format';
import { toastMutationError } from '@/hooks/nosh/providers';
import type { Order } from '@/lib/nosh/types';

const ORDERS_KEY = ['nosh', 'orders'] as const;

export function StudentOrders() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ORDERS_KEY,
    queryFn: () => ordersApi.list(),
  });

  // Live updates: invalidate when any order status changes.
  useEffect(() => {
    return onOrderStatusChanged(() => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
    });
  }, [qc]);

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.cancel(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      toast.success('Order cancelled — refund initiated');
    },
    onError: (e) => toastMutationError(e, 'Could not cancel order'),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="size-14 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
            <ReceiptText className="size-7 text-orange-500" />
          </div>
          <div>
            <p className="font-medium">No orders yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Place your first order from an outlet menu — it will appear here in real time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="max-h-[calc(100vh-220px)]">
      <ul className="space-y-3 pr-1">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onCancel={() => cancelMutation.mutate(order.id)}
            cancelling={
              cancelMutation.isPending && cancelMutation.variables === order.id
            }
          />
        ))}
      </ul>
    </ScrollArea>
  );
}

function OrderCard({
  order,
  onCancel,
  cancelling,
}: {
  order: Order;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pill = orderStatusPill(order.status);
  const outlet = parseJSON<{ name?: string }>(order.outletSnapshot, {});
  const outletName = outlet.name ?? 'Outlet';
  const total = formatINR(order.totalAmount);
  const paymentStatus = order.payment?.status;

  const statusIcon = {
    PENDING: <Clock className="size-3.5" />,
    ACCEPTED: <CheckCircle2 className="size-3.5" />,
    PREPARING: <ChefHat className="size-3.5" />,
    READY: <Package className="size-3.5" />,
    COMPLETED: <CheckCircle2 className="size-3.5" />,
    REJECTED: <AlertCircle className="size-3.5" />,
    CANCELLED: <XCircle className="size-3.5" />,
  }[order.status];

  return (
    <Card key={order.id} className="overflow-hidden">
      <CardHeader className="pb-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {order.orderNumber}
              </span>
            </CardTitle>
            <div className="mt-1 text-sm text-muted-foreground">
              {outletName} · {formatRelativeTime(order.createdAt)}
            </div>
          </div>
          <Badge className={`gap-1.5 ${pill.className} border`} variant="outline">
            {statusIcon}
            {pill.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-1 space-y-2">
        <div className="text-sm">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors text-xs"
          >
            {order.items.length} item{order.items.length === 1 ? '' : 's'}
            {expanded ? ' · hide' : ' · show'}
          </button>
          <ul className={expanded ? 'mt-2 space-y-1.5' : 'hidden'}>
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-3 text-xs">
                <span className="truncate">
                  <span className="font-mono text-muted-foreground">{it.quantity}×</span>{' '}
                  {it.name}
                </span>
                <span className="text-muted-foreground">{formatINR(it.itemTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{total}</span>
            {paymentStatus && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {paymentStatus}
              </Badge>
            )}
            {order.pickupCode && (
              <span className="font-mono text-[11px]">
                Pickup: <span className="font-semibold">{order.pickupCode}</span>
              </span>
            )}
          </div>
          {order.status === 'PENDING' && (
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={cancelling}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {cancelling ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="size-3.5" /> Cancel
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

