import React, { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring, animate } from 'framer-motion';

/**
 * AnimatedNumber — count-up animation when scrolled into view.
 *
 * Uses framer-motion's `animate()` function (NOT useSpring — useSpring doesn't
 * accept a `duration` option, it uses stiffness/damping). The `animate()`
 * function supports `{ duration: seconds, ease: 'easeOut' }` and is the
 * right tool for time-based count-up animations.
 *
 * Triggered when the element first enters the viewport (once — won't re-animate).
 */
export function AnimatedNumber({ value, duration = 1.2, className, formatINR: asINR = false, ...props }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const target = Number(value) || 0;

    // Use framer-motion's `animate()` for time-based easing (not spring)
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(latest),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  const formatted = asINR
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(displayValue)
    : Math.round(displayValue).toLocaleString('en-IN');

  return (
    <span ref={ref} className={className} {...props}>
      {formatted}
    </span>
  );
}

export default AnimatedNumber;
