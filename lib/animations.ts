import type { Variants, Transition } from 'framer-motion';

/** Shared spring — bouncy but professional (Calm meets Duolingo) */
export const springBounce: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, ...springBounce },
  }),
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

export const scalePop: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: springBounce,
  },
};

/** Checklist checkmark celebration */
export const checkCelebrate: Variants = {
  unchecked: { scale: 1 },
  checked: {
    scale: [1, 1.2, 1],
    transition: { duration: 0.4 },
  },
};

/** Stagger children in grids */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

/** Floating concierge pulse */
export const conciergePulse: Variants = {
  idle: { scale: 1, boxShadow: '0 4px 20px rgba(5, 150, 105, 0.3)' },
  pulse: {
    scale: [1, 1.05, 1],
    boxShadow: [
      '0 4px 20px rgba(5, 150, 105, 0.3)',
      '0 8px 30px rgba(5, 150, 105, 0.5)',
      '0 4px 20px rgba(5, 150, 105, 0.3)',
    ],
    transition: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' },
  },
};

/** Progress ring draw */
export const progressRing: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 1.2, ease: 'easeOut' },
  },
};