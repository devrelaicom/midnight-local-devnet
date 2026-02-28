import type { NodeInfo } from './hooks/use-node-info.js';
import type { IndexerInfo } from './hooks/use-indexer-info.js';
import type { ProofServerInfo } from './hooks/use-proof-server.js';
import type { WalletState } from './hooks/use-wallet-state.js';
import type { ParsedLogLine, LogFilter } from './lib/log-parser.js';

export type PanelName = 'node' | 'indexer' | 'proof' | 'wallet' | 'logs' | 'graph';

export interface DashboardData {
  node: NodeInfo | null;
  nodeLoading: boolean;
  indexer: IndexerInfo | null;
  indexerLoading: boolean;
  proofServer: ProofServerInfo | null;
  proofServerLoading: boolean;
  wallet: WalletState;
  logs: {
    lines: ParsedLogLine[];
    filter: LogFilter;
    scrollOffset: number;
    cycleService: () => void;
    cycleLevel: () => void;
    setSearch: (s: string) => void;
    scrollUp: () => void;
    scrollDown: () => void;
  };
  healthHistory: {
    nodeHistory: number[];
    indexerHistory: number[];
    proofServerHistory: number[];
  };
  focusedPanel: PanelName;
  searchMode: boolean;
  searchText: string;
  columns: number;
  rows: number;
}
