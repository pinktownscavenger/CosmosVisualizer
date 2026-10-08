const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(REDUCED_MOTION).matches
);

// Transition length for MUI Collapse/Grow/Fade; zero when the system asks for reduced motion.
export const motionTimeout = (ms) => (prefersReducedMotion() ? 0 : ms);
