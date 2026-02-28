import React from 'react';
import { Box } from 'ink';
import { NodePanel } from '../panels/node-panel.js';
import { IndexerPanel } from '../panels/indexer-panel.js';
import { ProofPanel } from '../panels/proof-panel.js';
import { WalletPanel } from '../panels/wallet-panel.js';
import { LogPanel } from '../panels/log-panel.js';
import type { DashboardData } from '../types.js';

interface MediumLayoutProps {
  data: DashboardData;
}

export function MediumLayout({ data }: MediumLayoutProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width="50%">
          <NodePanel data={data.node} loading={data.nodeLoading} focused={data.focusedPanel === 'node'} />
        </Box>
        <Box width="50%">
          <ProofPanel data={data.proofServer} loading={data.proofServerLoading} focused={data.focusedPanel === 'proof'} />
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width="50%">
          <IndexerPanel data={data.indexer} nodeBlock={data.node?.bestBlock ?? null} loading={data.indexerLoading} focused={data.focusedPanel === 'indexer'} />
        </Box>
        <Box width="50%">
          <WalletPanel wallet={data.wallet} focused={data.focusedPanel === 'wallet'} />
        </Box>
      </Box>
      <LogPanel
        lines={data.logs.lines}
        filter={data.logs.filter}
        scrollOffset={data.logs.scrollOffset}
        maxLines={Math.max(5, data.rows - 16)}
        focused={data.focusedPanel === 'logs'}
        searchMode={data.searchMode}
        searchText={data.searchText}
      />
    </Box>
  );
}
