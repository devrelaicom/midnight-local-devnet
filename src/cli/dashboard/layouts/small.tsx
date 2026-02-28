import React from 'react';
import { Box } from 'ink';
import { NodePanel } from '../panels/node-panel.js';
import { IndexerPanel } from '../panels/indexer-panel.js';
import { ProofPanel } from '../panels/proof-panel.js';
import { WalletPanel } from '../panels/wallet-panel.js';
import { LogPanel } from '../panels/log-panel.js';
import type { DashboardData } from '../types.js';

interface SmallLayoutProps {
  data: DashboardData;
}

export function SmallLayout({ data }: SmallLayoutProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <NodePanel data={data.node} loading={data.nodeLoading} compact />
      <IndexerPanel data={data.indexer} nodeBlock={data.node?.bestBlock ?? null} loading={data.indexerLoading} compact />
      <ProofPanel data={data.proofServer} loading={data.proofServerLoading} compact />
      <WalletPanel wallet={data.wallet} compact />
      <LogPanel
        lines={data.logs.lines}
        filter={data.logs.filter}
        scrollOffset={data.logs.scrollOffset}
        maxLines={data.rows - 10}
        focused={data.focusedPanel === 'logs'}
        searchMode={data.searchMode}
        searchText={data.searchText}
      />
    </Box>
  );
}
