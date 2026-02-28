import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useBreakpoint } from './hooks/use-breakpoint.js';
import { useNodeInfo } from './hooks/use-node-info.js';
import { useProofServer } from './hooks/use-proof-server.js';
import { useHealth } from './hooks/use-health.js';
import { useIndexerInfo } from './hooks/use-indexer-info.js';
import { useWalletState } from './hooks/use-wallet-state.js';
import { useLogs } from './hooks/use-logs.js';
import type { NetworkManager } from '../../core/network-manager.js';
import type { NetworkConfig } from '../../core/types.js';
import type { DashboardData, PanelName } from './types.js';
import { SmallLayout } from './layouts/small.js';
import { MediumLayout } from './layouts/medium.js';
import { LargeLayout } from './layouts/large.js';

const PANEL_CYCLE: PanelName[] = ['node', 'indexer', 'proof', 'wallet', 'logs', 'graph'];

interface AppProps {
  manager: NetworkManager;
  config: NetworkConfig;
}

export function App({ manager, config }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { breakpoint, columns, rows } = useBreakpoint();

  // Data hooks
  const nodeInfo = useNodeInfo(config.node);
  const proofServer = useProofServer(config.proofServer);
  const health = useHealth(config);
  const indexerInfo = useIndexerInfo(config.indexer);
  const walletState = useWalletState(manager);
  const logs = useLogs();

  // UI state
  const [focusedPanel, setFocusedPanel] = useState<PanelName>('node');
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape || key.return) {
        setSearchMode(false);
        if (key.return) logs.setSearch(searchText);
        if (key.escape) {
          setSearchText('');
          logs.setSearch('');
        }
        return;
      }
      if (key.backspace || key.delete) {
        setSearchText((prev) => prev.slice(0, -1));
        return;
      }
      setSearchText((prev) => prev + input);
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }

    if (key.tab) {
      setFocusedPanel((prev) => {
        const idx = PANEL_CYCLE.indexOf(prev);
        return PANEL_CYCLE[(idx + 1) % PANEL_CYCLE.length];
      });
      return;
    }

    if (input === 's') {
      logs.cycleService();
      return;
    }

    if (input === 'l') {
      logs.cycleLevel();
      return;
    }

    if (input === '/') {
      setSearchMode(true);
      setSearchText('');
      return;
    }

    if (key.upArrow) {
      if (focusedPanel === 'logs') logs.scrollUp();
      return;
    }

    if (key.downArrow) {
      if (focusedPanel === 'logs') logs.scrollDown();
      return;
    }
  });

  const data: DashboardData = {
    node: nodeInfo.data,
    nodeLoading: nodeInfo.loading,
    indexer: indexerInfo.data,
    indexerLoading: indexerInfo.loading,
    proofServer: proofServer.data,
    proofServerLoading: proofServer.loading,
    wallet: walletState,
    logs,
    healthHistory: {
      nodeHistory: health.data?.nodeHistory ?? [],
      indexerHistory: health.data?.indexerHistory ?? [],
      proofServerHistory: health.data?.proofServerHistory ?? [],
    },
    focusedPanel,
    searchMode,
    searchText,
    columns,
    rows,
  };

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="cyan">Midnight Local Devnet</Text>
        <Text color="gray">
          {columns}x{rows} | {breakpoint} | Tab=focus q=quit s=svc l=lvl /=search
        </Text>
      </Box>
      {breakpoint === 'small' && <SmallLayout data={data} />}
      {breakpoint === 'medium' && <MediumLayout data={data} />}
      {breakpoint === 'large' && <LargeLayout data={data} />}
    </Box>
  );
}
