import React from 'react';
import { Box } from 'ink';
import { NodePanel } from '../panels/node-panel.js';
import { IndexerPanel } from '../panels/indexer-panel.js';
import { ProofPanel } from '../panels/proof-panel.js';
import { WalletPanel } from '../panels/wallet-panel.js';
import { LogPanel } from '../panels/log-panel.js';
import { ResponseGraph } from '../panels/response-graph.js';
import type { DashboardData } from '../types.js';

interface LargeLayoutProps {
  data: DashboardData;
}

export function LargeLayout({ data }: LargeLayoutProps): React.ReactElement {
  const halfWidth = Math.floor(data.columns / 2);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width="25%">
          <NodePanel data={data.node} loading={data.nodeLoading} focused={data.focusedPanel === 'node'} />
        </Box>
        <Box width="25%">
          <IndexerPanel data={data.indexer} nodeBlock={data.node?.bestBlock ?? null} loading={data.indexerLoading} focused={data.focusedPanel === 'indexer'} />
        </Box>
        <Box width="25%">
          <ProofPanel data={data.proofServer} loading={data.proofServerLoading} focused={data.focusedPanel === 'proof'} />
        </Box>
        <Box width="25%">
          <WalletPanel wallet={data.wallet} focused={data.focusedPanel === 'wallet'} />
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width="50%">
          <ResponseGraph
            nodeHistory={data.healthHistory.nodeHistory}
            indexerHistory={data.healthHistory.indexerHistory}
            proofServerHistory={data.healthHistory.proofServerHistory}
            focused={data.focusedPanel === 'graph'}
            width={halfWidth - 4}
          />
        </Box>
        <Box width="50%">
          <LogPanel
            lines={data.logs.lines}
            filter={data.logs.filter}
            scrollOffset={data.logs.scrollOffset}
            maxLines={Math.max(5, data.rows - 12)}
            focused={data.focusedPanel === 'logs'}
            searchMode={data.searchMode}
            searchText={data.searchText}
          />
        </Box>
      </Box>
    </Box>
  );
}
