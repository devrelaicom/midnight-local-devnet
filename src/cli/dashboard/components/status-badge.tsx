import React from 'react';
import { Text } from 'ink';

interface StatusBadgeProps {
  status: 'healthy' | 'unhealthy' | 'unknown' | 'running' | 'stopped' | 'busy' | 'ok';
}

const STATUS_COLORS: Record<StatusBadgeProps['status'], string> = {
  healthy: 'green',
  running: 'green',
  ok: 'green',
  busy: 'yellow',
  unknown: 'gray',
  unhealthy: 'red',
  stopped: 'red',
};

const STATUS_SYMBOLS: Record<StatusBadgeProps['status'], string> = {
  healthy: '●',
  running: '●',
  ok: '●',
  busy: '◐',
  unknown: '○',
  unhealthy: '●',
  stopped: '●',
};

export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  return (
    <Text color={STATUS_COLORS[status]}>
      {STATUS_SYMBOLS[status]} {status}
    </Text>
  );
}
