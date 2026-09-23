/**
 * Cart Sheet — a right-side drawer that shows the active cart for the
 * currently-selected outlet. Supports:
 *   - quantity +/− controls (calls PATCH /api/v1/cart/items/:id)
 *   - remove item (DELETE /api/v1/cart/items/:id)
 *   - clear cart (DELETE /api/v1/cart)
 *   - checkout (POST /api/v1/orders — falls back to a CASH/ONLINE-style
 *     placeholder method since the dev backend requires paymentMethod)
 *
 * The cart state is fetched via TanStack Query and invalidated on every
 * mutation so the UI stays consistent.
 */

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
  Loader2,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cartApi, computeCartTotals, ordersApi } from '@/lib/nosh/api';
import { formatINR, parseJSON } from '@/lib/nosh/format';
import { useAuthStore } from '@/lib/nosh/store';
import { toastMutationError } from '@/hooks/nosh/providers';
import type { Cart, MenuItem, Order } from '@/lib/nosh/types';

const CART_KEY = ['nosh', 'cart'] as const;

export function CartSheet({
  open,
  onOpenChange,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful checkout with the created order. */
  onCheckout?: (order: Order) => void;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'WALLET'>('ONLINE');
  const [notes, setNotes] = useState('');

  const { data: cart, isLoading } = useQuery<Cart | null>({
    queryKey: CART_KEY,
    queryFn: () => cartApi.getActive(),
    enabled: !!user && open,
  });

  const updateMutation = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      cartApi.updateItem(cartItemId, quantity),
    onSuccess: (updated) => qc.setQueryData(CART_KEY, updated),
    onError: (e) => toastMutationError(e, 'Could not update cart item'),
  });

  const removeMutation = useMutation({
    mutationFn: (cartItemId: string) => cartApi.removeItem(cartItemId),
    onSuccess: (updated) => qc.setQueryData(CART_KEY, updated),
    onError: (e) => toastMutationError(e, 'Could not remove item'),
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: () => qc.setQueryData(CART_KEY, null),
    onError: (e) => toastMutationError(e, 'Could not clear cart'),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!cart || cart.items.length === 0) throw new Error('Cart is empty');
      return ordersApi.create({
        outletId: cart.outletId,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          selectedOptions: parseJSON<{ groupId: string; optionId: string }[]>(
            i.selectedOptions,
            [],
          ),
        })),
        paymentMethod,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (order) => {
      qc.setQueryData(CART_KEY, null);
      qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
      toast.success(`Order ${order.orderNumber} placed`);
      onOpenChange(false);
      setNotes('');
      onCheckout?.(order);
    },
    onError: (e) => toastMutationError(e, 'Checkout failed'),
  });

  const totals = computeCartTotals(cart ?? null);
  const items = cart?.items ?? [];
  const outletName = cart?.outlet?.name ?? 'this outlet';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="size-5 text-orange-500" /> Your cart
            </SheetTitle>
            {cart && items.length > 0 && (
              <Badge variant="secondary" className="font-mono text-xs">
                {totals.itemCount} item{totals.itemCount === 1 ? '' : 's'}
              </Badge>
            )}
          </div>
          <SheetDescription className="text-xs">
            {items.length > 0 ? `From ${outletName}` : 'Your cart is empty.'}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
            <div className="size-16 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
              <ShoppingBag className="size-8 text-orange-500" />
            </div>
            <div>
              <p className="font-medium">Cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add items from an outlet menu to see them here.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Browse outlets
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <ul className="divide-y divide-border/60">
                {items.map((item) => (
                  <CartLine
                    key={item.id}
                    item={item}
                    onIncrement={() =>
                      updateMutation.mutate({
                        cartItemId: item.id,
                        quantity: item.quantity + 1,
                      })
                    }
                    onDecrement={() => {
                      if (item.quantity <= 1) {
                        removeMutation.mutate(item.id);
                      } else {
                        updateMutation.mutate({
                          cartItemId: item.id,
                          quantity: item.quantity - 1,
                        });
                      }
                    }}
                    onRemove={() => removeMutation.mutate(item.id)}
                    updating={
                      (updateMutation.isPending && updateMutation.variables?.cartItemId === item.id) ||
                      (removeMutation.isPending && removeMutation.variables === item.id)
                    }
                  />
                ))}
              </ul>
            </ScrollArea>

            <SheetFooter className="border-t border-border/60 px-5 pt-4 pb-5 space-y-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatINR(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span className="font-medium">{formatINR(totals.platformFee)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatINR(totals.total)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Payment method (dev)</div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === 'ONLINE' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('ONLINE')}
                    className={
                      paymentMethod === 'ONLINE'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                        : ''
                    }
                  >
                    <CreditCard className="size-4" /> Online
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={paymentMethod === 'WALLET' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('WALLET')}
                    className={
                      paymentMethod === 'WALLET'
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                        : ''
                    }
                  >
                    <Wallet className="size-4" /> Wallet
                  </Button>
                </div>
              </div>

              <textarea
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder="Optional notes for the outlet…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                  disabled={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate()}
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Placing order…
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="size-4" /> Place order ·{' '}
                      {formatINR(totals.total)}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                  title="Clear cart"
                >
                  {clearMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 text-destructive" />
                  )}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface CartLineProps {
  item: Cart['items'][number];
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  updating: boolean;
}

function CartLine({ item, onIncrement, onDecrement, onRemove, updating }: CartLineProps) {
  const menuItem: MenuItem = item.menuItem;
  const options = parseJSON<{ groupId: string; optionId: string }[]>(item.selectedOptions, []);

  // Resolve option labels (best-effort — depends on customizationGroups being included).
  const optionLabels: string[] = [];
  if (menuItem.customizationGroups) {
    for (const sel of options) {
      const grp = menuItem.customizationGroups.find((g) => g.id === sel.groupId);
      const opt = grp?.options.find((o) => o.id === sel.optionId);
      if (opt) optionLabels.push(opt.label);
    }
  }

  return (
    <li className="px-5 py-3 flex gap-3">
      <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
        {menuItem.imageUrl ? (
          <img
            src={menuItem.imageUrl}
            alt={menuItem.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-xs text-muted-foreground">
            {menuItem.vegetarian ? 'veg' : 'non-veg'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight line-clamp-2">{menuItem.name}</p>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            disabled={updating}
            aria-label={`Remove ${menuItem.name}`}
          >
            <X className="size-3.5" />
          </Button>
        </div>
        {optionLabels.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {optionLabels.join(' · ')}
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-sm font-medium">{formatINR(menuItem.price)}</span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={onDecrement}
              disabled={updating}
              aria-label="Decrease quantity"
            >
              <Minus className="size-3" />
            </Button>
            <span className="w-6 text-center text-sm font-medium tabular-nums">
              {updating ? '…' : item.quantity}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={onIncrement}
              disabled={updating}
              aria-label="Increase quantity"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
