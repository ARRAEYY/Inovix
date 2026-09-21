import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Skeleton — shimmer-loading placeholder.
 *
 * Replaces the old "Loading…" text with a subtle pulse animation that
 * matches the shape of the content that's loading. Way less jarring.
 *
 * Usage:
 *   {isLoading ? <Skeleton className="h-4 w-24" /> : <h1>{title}</h1>}
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
      {...props}
    />
  );
}

/**
 * CardSkeleton — for outlet cards while loading.
 */
export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-full rounded-xl mt-2" />
      </div>
    </div>
  );
}

/**
 * OrderCardSkeleton — for order rows.
 */
export function OrderCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5 border-b border-border space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="p-5 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="p-3 bg-muted/30 flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export default Skeleton;
