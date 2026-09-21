import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * GradientText — animated gradient text for headings / hero titles.
 *
 * Inspired by reactbits.dev's "Gradient Text" + 21st.dev's "Shimmer Text".
 * The gradient slides horizontally (8s loop) — subtle enough not to
 * distract from the message, lively enough to feel premium.
 *
 * The gradient uses the design-system palette:
 *   primary (#EA580C) → secondary (#F97316) → accent (#2563EB) → primary
 *
 * Usage:
 *   <GradientText className="text-5xl font-extrabold">Good food.</GradientText>
 */
export function GradientText({ children, className, as: Component = 'span' }) {
  return (
    <motion.span
      className={cn(
        'inline-block bg-clip-text text-transparent',
        className
      )}
      style={{
        backgroundImage: 'linear-gradient(120deg, #EA580C, #F97316, #2563EB, #EA580C)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPosition: ['0% 50%', '200% 50%', '0% 50%'] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
    >
      {children}
    </motion.span>
  );
}

export default GradientText;
