import React from 'react';
import { Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { StatusBadge } from '../components/status-badge.js';
import type { IndexerInfo } from '../hooks/use-indexer-info.js';

interface IndexerPanelProps {
  data: IndexerInfo | null;
  nodeBlock: number | null;
  loading: boolean;
  focused?: boolean;
  compact?: boolean;
}

export function IndexerPanel({ data, nodeBlock, loading, focused, compact }: IndexerPanelProps): React.ReactElement {
  if (loading && !data) {
    return (
      <PanelBox title="Indexer" focused={focused}>
        <Text color="gray">Connecting...</Text>
      </PanelBox>
    );
  }

  if (!data) {
    return (
      <PanelBox title="Indexer" focused={focused}>
        <StatusBadge status="stopped" />
        <Text color="gray"> Offline</Text>
      </PanelBox>
    );
  }

  if (compact) {
    return (
      <Text>
        <StatusBadge status={data.ready ? 'running' : 'stopped'} />
        <Text> indexer :8088</Text>
      </Text>
    );
  }

  return (
    <PanelBox title="Indexer" focused={focused}>
      <Text>Status: <StatusBadge status={data.ready ? 'ok' : 'unhealthy'} /></Text>
      {data.responseTime != null && (
        <Text>Response: <Text color="yellow">{data.responseTime}ms</Text></Text>
      )}
    </PanelBox>
  );
}
