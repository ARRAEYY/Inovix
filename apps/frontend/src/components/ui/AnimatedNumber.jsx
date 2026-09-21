import React, { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

/**
 * AnimatedNumber — count-up animation when scrolled into view.
 *
 * Inspired by reactbits.dev's "Number Counter". Animates from 0 to `value`
 * over ~1.2s with spring physics. Triggered when the element first enters
 * the viewport (once — won't re-animate on scroll back and forth).
 *
 * Used for the KPI cards in Outlet + Admin dashboards.
 */
export function AnimatedNumber({ value, duration = 1.2, className, formatINR: asINR = false, ...props }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    if (inView) {
      motionValue.set(Number(value) || 0);
    }
  }, [inView, value, motionValue]);

  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return () => unsubscribe();
  }, [spring]);

  const formatted = asINR
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(displayValue)
    : Math.round(displayValue).toString();

  return (
    <span ref={ref} className={className} {...props}>
      {formatted}
    </span>
  );
}

export default AnimatedNumber;
