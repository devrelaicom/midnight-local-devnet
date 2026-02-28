import React from 'react';
import { Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { StatusBadge } from '../components/status-badge.js';
import { Gauge } from '../components/gauge.js';
import type { ProofServerInfo } from '../hooks/use-proof-server.js';

interface ProofPanelProps {
  data: ProofServerInfo | null;
  loading: boolean;
  focused?: boolean;
  compact?: boolean;
}

export function ProofPanel({ data, loading, focused, compact }: ProofPanelProps): React.ReactElement {
  if (loading && !data) {
    return (
      <PanelBox title="Proof Server" focused={focused}>
        <Text color="gray">Connecting...</Text>
      </PanelBox>
    );
  }

  if (!data) {
    return (
      <PanelBox title="Proof Server" focused={focused}>
        <StatusBadge status="stopped" />
        <Text color="gray"> Offline</Text>
      </PanelBox>
    );
  }

  if (compact) {
    const processing = data.ready?.jobsProcessing ?? 0;
    const capacity = data.ready?.jobCapacity ?? 0;
    return (
      <Text>
        <StatusBadge status={data.ready ? (data.ready.status === 'ok' ? 'running' : 'busy') : 'stopped'} />
        <Text> proof :6300 </Text>
        <Text color="cyan">▲ {processing}/{capacity}</Text>
      </Text>
    );
  }

  return (
    <PanelBox title="Proof Server" focused={focused}>
      <Text>Version: {data.version ?? 'unknown'}</Text>
      <Text>Proofs: {data.proofVersions?.join(', ') ?? 'unknown'}</Text>
      {data.ready && (
        <>
          <Text>Status: <StatusBadge status={data.ready.status === 'ok' ? 'ok' : 'busy'} /></Text>
          <Text>Jobs: <Gauge value={data.ready.jobsProcessing} max={data.ready.jobCapacity} width={8} /></Text>
          <Text>Pending: {data.ready.jobsPending}</Text>
        </>
      )}
    </PanelBox>
  );
}
