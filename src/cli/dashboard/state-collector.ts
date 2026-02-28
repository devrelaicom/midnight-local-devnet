import type { NetworkConfig, ServiceStatus } from '../../core/types.js';
import type { ParsedLogLine } from './lib/log-parser.js';
import { parseLogLines } from './lib/log-parser.js';
import {
  fetchSystemChain,
  fetchSystemName,
  fetchSystemVersion,
  fetchSystemHealth,
  fetchBestBlockHeader,
} from './lib/substrate-rpc.js';
import {
  fetchProofServerReady,
  fetchProofServerVersion,
  fetchProofVersions,
} from './lib/proof-server-api.js';
import { composePs, composeLogs } from '../../core/docker.js';
import { checkAllHealth } from '../../core/health.js';

export interface DashboardState {
  node: {
    chain: string | null;
    name: string | null;
    version: string | null;
    blockHeight: number | null;
    avgBlockTime: number | null;
    peers: number | null;
    syncing: boolean | null;
  };
  indexer: {
    ready: boolean;
    responseTime: number | null;
  };
  proofServer: {
    version: string | null;
    ready: boolean;
    jobsProcessing: number | null;
    jobsPending: number | null;
    jobCapacity: number | null;
    proofVersions: string[] | null;
  };
  wallet: {
    address: string | null;
    connected: boolean;
    unshielded: string;
    shielded: string;
    dust: string;
  };
  health: {
    node: { status: 'healthy' | 'unhealthy'; history: number[] };
    indexer: { status: 'healthy' | 'unhealthy'; history: number[] };
    proofServer: { status: 'healthy' | 'unhealthy'; history: number[] };
  };
  containers: ServiceStatus[];
  logs: ParsedLogLine[];
  networkStatus: string;
}

export interface WalletInfo {
  address: string | null;
  connected: boolean;
  unshielded: string;
  shielded: string;
  dust: string;
}

const MAX_HISTORY = 30;

async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export class StateCollector {
  private readonly config: NetworkConfig;
  private readonly nodeHistory: number[] = [];
  private readonly indexerHistory: number[] = [];
  private readonly proofHistory: number[] = [];
  private lastBlockHeight: number | null = null;
  private lastBlockTime: number | null = null;

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  async collect(walletInfo?: WalletInfo, networkStatus?: string): Promise<DashboardState> {
    const [
      chain,
      name,
      version,
      systemHealth,
      blockHeader,
      proofVersion,
      proofReady,
      proofVersions,
      containers,
      rawLogs,
      healthReport,
    ] = await Promise.all([
      safeCall(() => fetchSystemChain(this.config.node), null),
      safeCall(() => fetchSystemName(this.config.node), null),
      safeCall(() => fetchSystemVersion(this.config.node), null),
      safeCall(() => fetchSystemHealth(this.config.node), null),
      safeCall(() => fetchBestBlockHeader(this.config.node), null),
      safeCall(() => fetchProofServerVersion(this.config.proofServer), null),
      safeCall(() => fetchProofServerReady(this.config.proofServer), null),
      safeCall(() => fetchProofVersions(this.config.proofServer), null),
      safeCall(() => composePs(), []),
      safeCall(() => composeLogs({ lines: 100 }), ''),
      safeCall(() => checkAllHealth(this.config), null),
    ]);

    // Compute avgBlockTime
    const blockHeight = blockHeader?.number ?? null;
    let avgBlockTime: number | null = null;
    const now = Date.now();

    if (
      blockHeight !== null &&
      this.lastBlockHeight !== null &&
      this.lastBlockTime !== null &&
      blockHeight > this.lastBlockHeight
    ) {
      const elapsed = now - this.lastBlockTime;
      const blocksProduced = blockHeight - this.lastBlockHeight;
      avgBlockTime = elapsed / blocksProduced;
    }

    if (blockHeight !== null && (this.lastBlockHeight === null || blockHeight > this.lastBlockHeight)) {
      this.lastBlockHeight = blockHeight;
      this.lastBlockTime = now;
    }

    // Update response time history
    if (healthReport?.node.responseTime != null) {
      this.nodeHistory.push(healthReport.node.responseTime);
      if (this.nodeHistory.length > MAX_HISTORY) this.nodeHistory.shift();
    }
    if (healthReport?.indexer.responseTime != null) {
      this.indexerHistory.push(healthReport.indexer.responseTime);
      if (this.indexerHistory.length > MAX_HISTORY) this.indexerHistory.shift();
    }
    if (healthReport?.proofServer.responseTime != null) {
      this.proofHistory.push(healthReport.proofServer.responseTime);
      if (this.proofHistory.length > MAX_HISTORY) this.proofHistory.shift();
    }

    const logs = parseLogLines(rawLogs);

    return {
      node: {
        chain,
        name,
        version,
        blockHeight,
        avgBlockTime,
        peers: systemHealth?.peers ?? null,
        syncing: systemHealth?.isSyncing ?? null,
      },
      indexer: {
        ready: healthReport?.indexer.healthy ?? false,
        responseTime: healthReport?.indexer.responseTime ?? null,
      },
      proofServer: {
        version: proofVersion,
        ready: proofReady?.status === 'ok',
        jobsProcessing: proofReady?.jobsProcessing ?? null,
        jobsPending: proofReady?.jobsPending ?? null,
        jobCapacity: proofReady?.jobCapacity ?? null,
        proofVersions,
      },
      wallet: walletInfo ?? {
        address: null,
        connected: false,
        unshielded: '0',
        shielded: '0',
        dust: '0',
      },
      health: {
        node: {
          status: healthReport?.node.healthy ? 'healthy' : 'unhealthy',
          history: [...this.nodeHistory],
        },
        indexer: {
          status: healthReport?.indexer.healthy ? 'healthy' : 'unhealthy',
          history: [...this.indexerHistory],
        },
        proofServer: {
          status: healthReport?.proofServer.healthy ? 'healthy' : 'unhealthy',
          history: [...this.proofHistory],
        },
      },
      containers,
      logs,
      networkStatus: networkStatus ?? 'running',
    };
  }
}
