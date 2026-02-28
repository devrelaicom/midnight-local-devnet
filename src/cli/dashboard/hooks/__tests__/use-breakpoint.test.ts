import { describe, it, expect } from 'vitest';
import { getBreakpoint, type Breakpoint } from '../use-breakpoint.js';

describe('getBreakpoint', () => {
  it('returns "small" for width < 40', () => {
    expect(getBreakpoint(39)).toBe('small');
    expect(getBreakpoint(20)).toBe('small');
  });

  it('returns "medium" for width 40-119', () => {
    expect(getBreakpoint(40)).toBe('medium');
    expect(getBreakpoint(80)).toBe('medium');
    expect(getBreakpoint(119)).toBe('medium');
  });

  it('returns "large" for width >= 120', () => {
    expect(getBreakpoint(120)).toBe('large');
    expect(getBreakpoint(200)).toBe('large');
  });
});
