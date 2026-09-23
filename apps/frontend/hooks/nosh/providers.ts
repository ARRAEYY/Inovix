'use client';

import { toast } from 'sonner';
import { ApiError } from '@/lib/nosh/api';

/**
 * Common mutation error handler for Nosh UI mutations.
 * Displays user-friendly error message from ApiError or falls back to message.
 */
export function toastMutationError(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof ApiError) {
    toast.error(err.message);
  } else if (err instanceof Error) {
    toast.error(err.message);
  } else {
    toast.error(fallback);
  }
}
