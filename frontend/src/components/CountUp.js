// Purpose: Lightweight count-up animation for numbers in ERP-style dashboards
// Characteristics: One-time on mount, under 800ms, respects prefers-reduced-motion
import React, { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CountUp = ({ value = 0, duration = 800, format = (v) => v.toFixed(2) }) => {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    startRef.current = start;
    const from = 0;
    const to = Number(value) || 0;
    const d = Math.min(Math.max(duration, 200), 800);
    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / d, 1);
      const eased = easeOutCubic(t);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <span>{format(display)}</span>;
};

export default CountUp;
