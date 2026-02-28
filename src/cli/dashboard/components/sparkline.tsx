import React from 'react';
import { Text } from 'ink';

const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

export function renderSparkline(data: number[], maxWidth?: number): string {
  if (data.length === 0) return '';

  const values = maxWidth && data.length > maxWidth ? data.slice(-maxWidth) : data;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) {
    const mid = Math.floor((BARS.length - 1) / 2);
    return values.map(() => BARS[mid]).join('');
  }

  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (BARS.length - 1));
      return BARS[idx];
    })
    .join('');
}

interface SparklineProps {
  data: number[];
  maxWidth?: number;
  color?: string;
}

export function Sparkline({ data, maxWidth, color }: SparklineProps): React.ReactElement {
  return <Text color={color}>{renderSparkline(data, maxWidth)}</Text>;
}
