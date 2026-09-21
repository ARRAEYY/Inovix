import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * AuroraBackground — animated aurora/gradient blobs for hero sections.
 *
 * Inspired by reactbits.dev's "Aurora Background" — but lighter weight
 * (no WebGL, just CSS gradients + framer-motion spring physics).
 *
 * Two large blurred radial gradient blobs drift slowly in opposite directions.
 * The motion is subtle (20s loop) so it doesn't pull focus from content.
 *
 * Set `intense` for more vivid colors (login pages); leave default for
 * subtle accent backgrounds (dashboard headers).
 */
export function AuroraBackground({ children, className, intense = false }) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Aurora blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: '40vw',
            height: '40vw',
            left: '-10vw',
            top: '-10vw',
            background: intense
              ? 'radial-gradient(circle, rgba(234,88,12,0.55), transparent 70%)'
              : 'radial-gradient(circle, rgba(234,88,12,0.25), transparent 70%)',
          }}
          animate={{
            x: [0, 80, 0],
            y: [0, 60, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: '35vw',
            height: '35vw',
            right: '-10vw',
            bottom: '-10vw',
            background: intense
              ? 'radial-gradient(circle, rgba(37,99,235,0.45), transparent 70%)'
              : 'radial-gradient(circle, rgba(37,99,235,0.2), transparent 70%)',
          }}
          animate={{
            x: [0, -80, 0],
            y: [0, -60, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full blur-3xl"
          style={{
            width: '30vw',
            height: '30vw',
            left: '40%',
            top: '40%',
            background: intense
              ? 'radial-gradient(circle, rgba(249,115,22,0.35), transparent 70%)'
              : 'radial-gradient(circle, rgba(249,115,22,0.15), transparent 70%)',
          }}
          animate={{
            x: [0, 60, -60, 0],
            y: [0, -40, 40, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      {/* Content sits on top */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default AuroraBackground;
