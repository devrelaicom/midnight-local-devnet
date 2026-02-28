import React from 'react';
import { Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { StatusBadge } from '../components/status-badge.js';
import type { NodeInfo } from '../hooks/use-node-info.js';

interface NodePanelProps {
  data: NodeInfo | null;
  loading: boolean;
  focused?: boolean;
  compact?: boolean;
}

export function NodePanel({ data, loading, focused, compact }: NodePanelProps): React.ReactElement {
  if (loading && !data) {
    return (
      <PanelBox title="Node" focused={focused}>
        <Text color="gray">Connecting...</Text>
      </PanelBox>
    );
  }

  if (!data || data.bestBlock === null) {
    return (
      <PanelBox title="Node" focused={focused}>
        <StatusBadge status="stopped" />
        <Text color="gray"> Offline</Text>
      </PanelBox>
    );
  }

  if (compact) {
    return (
      <Text>
        <StatusBadge status={data.health ? 'running' : 'stopped'} />
        <Text> node :9944 </Text>
        <Text color="cyan">▲ #{data.bestBlock}</Text>
      </Text>
    );
  }

  return (
    <PanelBox title="Node" focused={focused}>
      <Text>Block: <Text color="cyan">#{data.bestBlock}</Text></Text>
      {data.avgBlockTime != null && (
        <Text>Avg time: <Text color="yellow">{data.avgBlockTime.toFixed(1)}s</Text></Text>
      )}
      <Text>Chain: {data.chainName ?? 'unknown'}</Text>
      <Text>Peers: {data.health?.peers ?? 'N/A'}</Text>
      <Text>Sync: {data.health?.isSyncing ? 'syncing' : 'idle'}</Text>
      <Text>Version: {data.version ?? 'unknown'}</Text>
    </PanelBox>
  );
}
