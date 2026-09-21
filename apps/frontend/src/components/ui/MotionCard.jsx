import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * MotionCard — 3D-tilt card that follows the cursor.
 *
 * Inspired by reactbits.dev's "3D Card Effect" + 21st.dev's tilt cards.
 *   - Mouse move → rotateX / rotateY based on cursor position relative to card center
 *   - Spring physics for smooth, weighty motion
 *   - Optional `glow` prop renders a radial spotlight that follows the cursor
 *
 * Hover state is tracked via React `useState` (not framer's `whileHover`)
 * because we need to coordinate the glow opacity with the parent's mouse
 * position — `whileHover` on a child doesn't trigger from parent hover.
 */
export function MotionCard({ children, className, glow = true, ...props }) {
  const ref = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [8, -8]), { stiffness: 350, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-8, 8]), { stiffness: 350, damping: 30 });

  const glowX = useTransform(mouseX, [0, 1], ['0%', '100%']);
  const glowY = useTransform(mouseY, [0, 1], ['0%', '100%']);
  const glowBg = useTransform(
    [glowX, glowY],
    ([x, y]) => `radial-gradient(180px circle at ${x} ${y}, rgba(234, 88, 12, 0.25), transparent 70%)`
  );

  function handleMouseMove(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  function handleMouseEnter() {
    setIsHovering(true);
  }

  function handleMouseLeave() {
    setIsHovering(false);
    mouseX.set(0.5);
    mouseY.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
        transformStyle: 'preserve-3d',
      }}
      animate={{
        boxShadow: isHovering
          ? '0 20px 40px -10px rgba(234, 88, 12, 0.18)'
          : '0 0 0 0 rgba(0, 0, 0, 0)',
      }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative bg-card border border-border rounded-2xl overflow-hidden',
        className
      )}
      {...props}
    >
      {glow && (
        <motion.div
          aria-hidden
          style={{ background: glowBg }}
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: isHovering ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
      <div style={{ transform: 'translateZ(50px)' }} className="relative">
        {children}
      </div>
    </motion.div>
  );
}

export default MotionCard;
