import React from 'react';
import { Text } from 'ink';

interface GaugeProps {
  value: number;
  max: number;
  width?: number;
  label?: string;
}

export function Gauge({ value, max, width = 10, label }: GaugeProps): React.ReactElement {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const empty = width - filled;
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  const color = percentage >= 90 ? 'red' : percentage >= 70 ? 'yellow' : 'green';

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text> {value}/{max}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
