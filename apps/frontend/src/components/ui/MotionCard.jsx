import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * MotionCard — 3D-tilt card that follows the cursor.
 *
 * Inspired by reactbits.dev's "3D Card Effect".
 *   - Mouse move → rotateX / rotateY based on cursor position relative to card center
 *   - Spring physics for smooth, weighty motion
 *   - Optional `glow` prop renders a radial spotlight that follows the cursor
 *
 * Spec ref: §6 design system — Minimalism + Swiss style. We keep the cards
 * clean (no decorative shadows by default) but add subtle motion on hover
 * to convey interactivity. Disabled on touch devices (no hover state).
 */
export function MotionCard({ children, className, glow = true, ...props }) {
  const ref = useRef(null);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  // Map [0,1] → [-12deg, 12deg] for tilt
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [8, -8]), { stiffness: 350, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-8, 8]), { stiffness: 350, damping: 30 });

  // Spotlight position for the glow
  const glowX = useTransform(mouseX, [0, 1], ['0%', '100%']);
  const glowY = useTransform(mouseY, [0, 1], ['0%', '100%']);
  const glowBg = useTransform(
    [glowX, glowY],
    ([x, y]) => `radial-gradient(180px circle at ${x} ${y}, rgba(234, 88, 12, 0.18), transparent 70%)`
  );

  function handleMouseMove(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  function handleMouseLeave() {
    mouseX.set(0.5);
    mouseY.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
        transformStyle: 'preserve-3d',
      }}
      className={cn(
        'relative bg-card border border-border rounded-2xl overflow-hidden',
        'transition-shadow hover:shadow-lg hover:shadow-primary/5',
        className
      )}
      {...props}
    >
      {glow && (
        <motion.div
          aria-hidden
          style={{ background: glowBg }}
          className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        />
      )}
      <div style={{ transform: 'translateZ(50px)' }} className="relative">
        {children}
      </div>
    </motion.div>
  );
}

export default MotionCard;
