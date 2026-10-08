import { afterEach, describe, expect, it, vi } from 'vitest';
import { motionTimeout, prefersReducedMotion } from './motion';

afterEach(() => {
  delete window.matchMedia;
});

describe('motion preferences', () => {
  it('uses the requested duration by default', () => {
    expect(prefersReducedMotion()).toBe(false);
    expect(motionTimeout(200)).toBe(200);
  });

  it('turns animations off when the system asks for reduced motion', () => {
    window.matchMedia = vi.fn(query => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    expect(prefersReducedMotion()).toBe(true);
    expect(motionTimeout(200)).toBe(0);
  });
});
