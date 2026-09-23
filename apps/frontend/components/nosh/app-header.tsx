/**
 * App header — brand, live socket status pill, user chip + logout.
 * Shared by Student, Outlet, and Admin views.
 */

'use client';

import { useEffect, useState } from 'react';
import { LogOut, Radio, Store, Wifi, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authApi } from '@/lib/nosh/api';
import { useAuthStore } from '@/lib/nosh/store';
import { onConnectionChange } from '@/lib/nosh/socket';
import { initials } from '@/lib/nosh/format';

interface HeaderProps {
  /** Title shown beside the brand — usually the active role. */
  contextLabel?: string;
  /** Optional right-side actions (e.g. cart button). */
  right?: React.ReactNode;
}

export function AppHeader({ contextLabel, right }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    return onConnectionChange(setConnected);
  }, []);

  async function handleLogout() {
    await authApi.logout();
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl flex h-16 items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm shadow-orange-500/30">
            <Store className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">Inovix</div>
            {contextLabel && (
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {contextLabel}
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {right}

          <Badge
            variant="outline"
            className="hidden sm:inline-flex gap-1.5 px-2 py-1 text-[11px] font-normal"
            data-connected={connected}
            title={connected ? 'Realtime connected' : 'Realtime disconnected'}
          >
            {connected ? (
              <>
                <Wifi className="size-3 text-emerald-600" />
                <span className="text-emerald-700 dark:text-emerald-400">Live</span>
                <Radio className="size-3 animate-pulse text-emerald-600" />
              </>
            ) : (
              <>
                <WifiOff className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">Offline</span>
              </>
            )}
          </Badge>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 pl-1 pr-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-500 text-white text-xs">
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-[140px] truncate">
                    {user.name ?? user.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Signed in as
                </DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <div className="font-medium truncate">{user.name ?? 'No name set'}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px] font-medium">
                      {user.role}
                    </Badge>
                    {user.outletId && (
                      <Badge variant="outline" className="text-[10px]">
                        Outlet: {user.outletRole}
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
