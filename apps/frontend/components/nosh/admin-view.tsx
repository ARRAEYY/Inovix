/**
 * Admin dashboard — for SUPER_ADMIN role.
 *
 * Layout: header + 4 overview cards (Users / Outlets / Menu / Orders) with
 * per-status breakdowns from GET /api/v1/admin/overview.
 *
 * Live updates via Socket.IO are deliberately NOT wired here — the admin
 * overview reflects long-running platform stats, not order-by-order state.
 */

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  RefreshCw,
  Store as StoreIcon,
  Users,
  XCircle,
} from 'lucide-react';

import { AppHeader } from './app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { adminApi } from '@/lib/nosh/api';
import type { AdminOverview } from '@/lib/nosh/types';

const OVERVIEW_KEY = ['nosh', 'admin', 'overview'] as const;

export function AdminView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<AdminOverview>({
    queryKey: OVERVIEW_KEY,
    queryFn: () => adminApi.overview(),
    refetchInterval: 30_000,
  });

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-orange-50/40 via-background to-background dark:from-orange-950/10">
      <AppHeader contextLabel="Super admin" />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Platform overview</h2>
            <p className="text-sm text-muted-foreground">
              Live counts across users, outlets, menu and orders.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => qc.invalidateQueries({ queryKey: OVERVIEW_KEY })}
          >
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>

        {isLoading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OverviewCard
              title="Users"
              total={data.users.total}
              icon={<Users className="size-5 text-orange-500" />}
              rows={[
                { label: 'Students', value: data.users.students },
                { label: 'Outlet admins', value: data.users.outletAdmins },
                { label: 'Outlet staff', value: data.users.outletStaff },
                { label: 'Super admins', value: data.users.superAdmins },
              ]}
            />
            <OverviewCard
              title="Outlets"
              total={data.outlets.total}
              icon={<StoreIcon className="size-5 text-orange-500" />}
              rows={[
                { label: 'Open', value: data.outlets.open },
                { label: 'Busy', value: data.outlets.busy },
                { label: 'Closed', value: data.outlets.closed },
                { label: 'Pending', value: data.outlets.pending },
                { label: 'Suspended', value: data.outlets.suspended },
              ]}
            />
            <OverviewCard
              title="Menu"
              total={data.menu.total}
              icon={<BookOpen className="size-5 text-orange-500" />}
              rows={[
                { label: 'Available', value: data.menu.available },
                { label: 'Unavailable', value: data.menu.unavailable },
              ]}
            />
            <OverviewCard
              title="Orders"
              total={data.orders.total}
              icon={<ClipboardList className="size-5 text-orange-500" />}
              rows={[
                { label: 'Pending', value: data.orders.pending },
                { label: 'Accepted', value: data.orders.accepted },
                { label: 'Preparing', value: data.orders.preparing },
                { label: 'Ready', value: data.orders.ready },
                { label: 'Completed', value: data.orders.completed },
                { label: 'Rejected', value: data.orders.rejected },
                { label: 'Cancelled', value: data.orders.cancelled },
              ]}
            />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill
            label="Active outlets"
            value={data ? data.outlets.open + data.outlets.busy : undefined}
            icon={<StoreIcon className="size-4 text-emerald-600" />}
          />
          <StatPill
            label="In kitchen"
            value={data ? data.orders.preparing + data.orders.ready : undefined}
            icon={<ChefHat className="size-4 text-orange-600" />}
          />
          <StatPill
            label="Fulfilled today"
            value={data ? data.orders.completed : undefined}
            icon={<CheckCircle2 className="size-4 text-emerald-600" />}
          />
          <StatPill
            label="Cancelled"
            value={data ? data.orders.cancelled + data.orders.rejected : undefined}
            icon={<XCircle className="size-4 text-red-600" />}
          />
        </div>
      </main>
    </div>
  );
}

function OverviewCard({
  title,
  total,
  icon,
  rows,
}: {
  title: string;
  total: number;
  icon: React.ReactNode;
  rows: { label: string; value: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon} {title}
          </CardTitle>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums leading-none">
              {total}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
              total
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between gap-3 py-1"
            >
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-medium tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {icon}
        </div>
        {value === undefined ? (
          <Skeleton className="h-8 w-12 mt-2" />
        ) : (
          <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
