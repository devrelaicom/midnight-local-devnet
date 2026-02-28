import type { NodeInfo } from './hooks/use-node-info.js';
import type { IndexerInfo } from './hooks/use-indexer-info.js';
import type { ProofServerInfo } from './hooks/use-proof-server.js';
import type { WalletState } from './hooks/use-wallet-state.js';
import type { ParsedLogLine, LogFilter } from './lib/log-parser.js';

export type PanelName = 'node' | 'indexer' | 'proof' | 'wallet' | 'logs' | 'graph';

export interface LogsData {
  lines: ParsedLogLine[];
  allLines: ParsedLogLine[];
  filter: LogFilter;
  scrollOffset: number;
  loading: boolean;
  cycleService: () => void;
  cycleLevel: () => void;
  setSearch: (search: string) => void;
  scrollUp: () => void;
  scrollDown: () => void;
}

export interface HealthHistory {
  nodeHistory: number[];
  indexerHistory: number[];
  proofServerHistory: number[];
}

export interface DashboardData {
  node: NodeInfo | null;
  nodeLoading: boolean;
  indexer: IndexerInfo | null;
  indexerLoading: boolean;
  proofServer: ProofServerInfo | null;
  proofServerLoading: boolean;
  wallet: WalletState;
  logs: LogsData;
  healthHistory: HealthHistory;
  focusedPanel: PanelName;
  searchMode: boolean;
  searchText: string;
  columns: number;
  rows: number;
}
