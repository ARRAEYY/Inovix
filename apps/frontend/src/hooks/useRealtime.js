import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, setQueryClientForRealtime, disconnectSocket } from '../services/realtime/socket';
import { getAccessToken } from '../services/api/client';

/**
 * useRealtime — mount this hook ONCE near the top of the app tree (after auth
 * is confirmed). It connects the socket + wires socket events to TanStack
 * Query invalidation.
 *
 * Per spec §6.2: socket events invalidate specific query keys:
 *   - order:new                  → ['orders', 'outlet', 'list']
 *   - order:status:changed       → ['orders', 'detail', orderId], ['orders', 'outlet', 'list'], ['orders', 'student', 'list']
 *   - notification:created       → ['notifications', 'list']
 *
 * Long-polling fallback is automatic — no client code needed.
 */
export function useRealtime(enabled = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    setQueryClientForRealtime(qc);
    if (getAccessToken()) {
      getSocket();
    }
    return () => {
      // Don't disconnect on every unmount of the hook — only when truly logging out.
      // The socket lifecycle is tied to the auth state, not the hook.
    };
  }, [enabled, qc]);
}

export function teardownRealtime() {
  disconnectSocket();
}
