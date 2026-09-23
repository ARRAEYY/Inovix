/**
 * Student view — single-page app for STUDENT role.
 *
 * Layout: header (with cart button) + bottom-nav style tabs.
 *   - Home tab → outlet grid → tap an outlet → outlet menu screen
 *   - Orders tab → list of past/active orders (cancel pending)
 *   - Profile tab → account info
 *
 * The cart lives in a Sheet drawer that opens from the header cart button.
 * The cart sheet handles its own state via TanStack Query — we just open
 * and close it. After a successful checkout, we snap back to the Home tab
 * and switch the active view to "orders" so the student sees the new order.
 */

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChefHat,
  Home as HomeIcon,
  Plus,
  Receipt,
  ShoppingCart,
  Store as StoreIcon,
  UserRound,
  Loader2,
  Clock,
  Star,
  Leaf,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppHeader } from './app-header';
import { CartSheet } from './student-cart-sheet';
import { StudentOrders } from './student-orders';
import { StudentProfile } from './student-profile';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { catalogApi, cartApi } from '@/lib/nosh/api';
import { formatINR, outletStatusPill } from '@/lib/nosh/format';
import { toastMutationError } from '@/hooks/nosh/providers';
import type { MenuItem, Order, Outlet } from '@/lib/nosh/types';

type Tab = 'home' | 'orders' | 'profile';
type View = 'browse' | 'menu';

export function StudentView() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('home');
  const [view, setView] = useState<View>('browse');
  const [activeOutletId, setActiveOutletId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  function openOutlet(outlet: Outlet) {
    setActiveOutletId(outlet.id);
    setView('menu');
  }

  function backToBrowse() {
    setView('browse');
    setActiveOutletId(null);
  }

  function handleCheckoutSuccess(order: Order) {
    setView('browse');
    setActiveOutletId(null);
    setTab('orders');
    // Make sure the orders tab shows the new order immediately.
    qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
    void order;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50/40 via-background to-background dark:from-orange-950/10">
      <AppHeader
        contextLabel="Student"
        right={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart className="size-4" /> Cart
          </Button>
        }
      />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 sm:py-6">
        {tab === 'home' && view === 'browse' && <OutletGrid onOpenOutlet={openOutlet} />}
        {tab === 'home' && view === 'menu' && activeOutletId && (
          <OutletMenuScreen
            outletId={activeOutletId}
            onBack={backToBrowse}
            onOpenCart={() => setCartOpen(true)}
          />
        )}
        {tab === 'orders' && <StudentOrders />}
        {tab === 'profile' && <StudentProfile />}
      </main>

      <BottomNav tab={tab} onChange={setTab} />

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={handleCheckoutSuccess}
      />
    </div>
  );
}

// ─── Outlet grid (home tab) ──────────────────────────────────────────────────

function OutletGrid({ onOpenOutlet }: { onOpenOutlet: (o: Outlet) => void }) {
  const { data: outlets, isLoading } = useQuery<Outlet[]>({
    queryKey: ['nosh', 'outlets'],
    queryFn: () => catalogApi.listOutlets(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading outlets…
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!outlets || outlets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="size-14 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
            <StoreIcon className="size-7 text-orange-500" />
          </div>
          <div>
            <p className="font-medium">No outlets open right now</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try again later — outlet hours vary by location.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Featured outlets first.
  const sorted = [...outlets].sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Today&apos;s outlets</h2>
        <p className="text-sm text-muted-foreground">
          {sorted.length} open now · tap to browse the menu
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((outlet) => (
          <OutletCard key={outlet.id} outlet={outlet} onClick={() => onOpenOutlet(outlet)} />
        ))}
      </div>
    </div>
  );
}

function OutletCard({ outlet, onClick }: { outlet: Outlet; onClick: () => void }) {
  const pill = outletStatusPill(outlet.status);
  const tags = outlet.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer hover:shadow-lg hover:shadow-orange-500/10 hover:border-orange-300 dark:hover:border-orange-700 transition-all overflow-hidden"
    >
      <div className="relative h-32 bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 dark:from-orange-950/40 dark:via-zinc-900 dark:to-orange-950/30 flex items-center justify-center">
        {outlet.logoUrl ? (
          <img
            src={outlet.logoUrl}
            alt={outlet.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="size-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 group-hover:scale-110 transition-transform">
            <StoreIcon className="size-8" />
          </div>
        )}
        <Badge
          variant="outline"
          className={`absolute top-2 right-2 ${pill.className} border`}
        >
          {pill.label}
        </Badge>
        {outlet.featured && (
          <Badge
            variant="default"
            className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white gap-1"
          >
            <Star className="size-3 fill-white" /> Featured
          </Badge>
        )}
      </div>
      <CardContent className="p-4 space-y-2">
        <div>
          <h3 className="font-semibold tracking-tight">{outlet.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {outlet.description || outlet.location || 'Campus food outlet'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="size-3 text-amber-500 fill-amber-500" />
            {outlet.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {outlet.estimatedTime}
          </span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Outlet menu screen ──────────────────────────────────────────────────────

function OutletMenuScreen({
  outletId,
  onBack,
  onOpenCart,
}: {
  outletId: string;
  onBack: () => void;
  onOpenCart: () => void;
}) {
  // Read the outlet from the cached outlets list (no separate fetch — we
  // just came from the grid, so the data is already there).
  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ['nosh', 'outlets'],
    queryFn: () => catalogApi.listOutlets(),
    // The list is already fresh from when the user navigated here.
    staleTime: 60_000,
  });
  const outlet = outlets?.find((o) => o.id === outletId);

  const { data: menu, isLoading } = useQuery<MenuItem[]>({
    queryKey: ['nosh', 'menu', outletId],
    queryFn: () => catalogApi.listMenu(outletId),
    enabled: !!outletId,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} aria-label="Back to outlets">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight truncate">
            {outlet?.name ?? 'Outlet menu'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {outlet?.estimatedTime ?? ''} · {outlet?.location ?? ''}
          </p>
        </div>
        <Button onClick={onOpenCart} size="sm" className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
          <ShoppingCart className="size-4" /> View cart
        </Button>
      </div>

      <Separator />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !menu || menu.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <ChefHat className="size-8 mx-auto text-orange-500 mb-2" />
            No menu items published yet.
          </CardContent>
        </Card>
      ) : (
        <MenuList outletId={outletId} items={menu} />
      )}
    </div>
  );
}

function MenuList({ outletId, items }: { outletId: string; items: MenuItem[] }) {
  // Group by category name for display.
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    const name = item.category?.name ?? 'Other';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(item);
  }
  const orderedGroups = Array.from(groups.entries()).sort(
    ([a], [b]) => (a === 'Other' ? 1 : 0) - (b === 'Other' ? 1 : 0),
  );

  return (
    <ScrollArea className="max-h-[calc(100vh-260px)]">
      <div className="space-y-6 pr-1">
        {orderedGroups.map(([cat, list]) => (
          <section key={cat} className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
              {cat}
            </h3>
            <ul className="space-y-2">
              {list.map((item) => (
                <MenuRow key={item.id} outletId={outletId} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

function MenuRow({ outletId, item }: { outletId: string; item: MenuItem }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (adding) return;
    if (!item.isAvailable) {
      toast.error(`${item.name} is currently unavailable`);
      return;
    }
    setAdding(true);
    try {
      await cartApi.addItem(outletId, {
        menuItemId: item.id,
        quantity: 1,
        // V1: no customization picker UI — send empty array (still server-validated).
        selectedOptions: [],
      });
      qc.invalidateQueries({ queryKey: ['nosh', 'cart'] });
      toast.success(`${item.name} added to cart`);
    } catch (err) {
      toastMutationError(err, 'Could not add item');
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 flex gap-3">
        <div className="size-20 shrink-0 rounded-lg overflow-hidden bg-muted">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="size-full flex items-center justify-center">
              {item.vegetarian ? (
                <Leaf className="size-6 text-emerald-600" />
              ) : (
                <ChefHat className="size-6 text-orange-500" />
              )}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium line-clamp-1">{item.name}</span>
                {item.vegetarian ? (
                  <span
                    className="inline-flex size-3.5 items-center justify-center rounded-sm border border-emerald-500 text-[8px] text-emerald-600"
                    title="Vegetarian"
                  >
                    ●
                  </span>
                ) : (
                  <span
                    className="inline-flex size-3.5 items-center justify-center rounded-sm border border-red-500 text-[8px] text-red-600"
                    title="Non-vegetarian"
                  >
                    ●
                  </span>
                )}
                {item.popular && (
                  <Badge variant="secondary" className="text-[9px] gap-1 h-4 px-1">
                    <Star className="size-2.5 fill-amber-500 text-amber-500" /> Popular
                  </Badge>
                )}
              </div>
              {item.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {item.description}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatINR(item.price)}
                </span>
                {item.prepTimeMins > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {item.prepTimeMins} min
                  </span>
                )}
                {!item.isAvailable && (
                  <Badge variant="outline" className="text-[10px] text-red-700">
                    Unavailable
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAdd}
              disabled={adding || !item.isAvailable}
              className="shrink-0 gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-800 dark:border-orange-900 dark:text-orange-300 dark:hover:bg-orange-950/30"
            >
              {adding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="size-3.5" /> Add
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Re-exported so student view can show an empty-state CTA.
export { Receipt };

// ─── Bottom navigation ────────────────────────────────────────────────────────

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-6xl flex h-16 items-stretch px-2 sm:px-6">
        <NavButton
          active={tab === 'home'}
          icon={<HomeIcon className="size-5" />}
          label="Home"
          onClick={() => onChange('home')}
        />
        <NavButton
          active={tab === 'orders'}
          icon={<Receipt className="size-5" />}
          label="Orders"
          onClick={() => onChange('orders')}
        />
        <NavButton
          active={tab === 'profile'}
          icon={<UserRound className="size-5" />}
          label="Profile"
          onClick={() => onChange('profile')}
        />
      </div>
    </nav>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
        active
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <span className={active ? 'scale-110 transition-transform' : ''}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
