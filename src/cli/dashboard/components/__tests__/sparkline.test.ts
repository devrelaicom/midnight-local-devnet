import { describe, it, expect } from 'vitest';
import { renderSparkline } from '../sparkline.js';

describe('renderSparkline', () => {
  it('renders empty string for empty data', () => {
    expect(renderSparkline([])).toBe('');
  });

  it('renders single value', () => {
    expect(renderSparkline([5])).toBe('▄');
  });

  it('renders values normalized to 8 levels', () => {
    const result = renderSparkline([0, 25, 50, 75, 100]);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('▁');
    expect(result[4]).toBe('█');
  });

  it('handles all same values', () => {
    const result = renderSparkline([50, 50, 50]);
    expect(result).toHaveLength(3);
  });

  it('respects maxWidth', () => {
    const data = Array.from({ length: 50 }, (_, i) => i);
    const result = renderSparkline(data, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
