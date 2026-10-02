import React from 'react';

// Simple skeleton placeholder for loading states.
// Usage: <Skeleton width="200px" height="20px" /> or <Skeleton lines={3} />
export const Skeleton = ({ width = '100%', height = '20px', borderRadius = '6px', style }) => (
  <div style={{
    width, height, borderRadius,
    background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    ...style,
  }} />
);

// Multi-line skeleton (for paragraphs/cards)
export const SkeletonCard = ({ lines = 3, height = '16px' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem' }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} height={height} width={i === lines - 1 ? '60%' : '100%'} />
    ))}
  </div>
);

// Grid of skeleton cards (for outlet/menu grids)
export const SkeletonGrid = ({ count = 6, cols = 3 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${300/cols}px, 1fr))`,
    gap: '1rem',
  }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{
        background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>
        <Skeleton height="120px" borderRadius="8px" />
        <Skeleton height="16px" width="70%" />
        <Skeleton height="14px" width="50%" />
      </div>
    ))}
  </div>
);

export default Skeleton;
