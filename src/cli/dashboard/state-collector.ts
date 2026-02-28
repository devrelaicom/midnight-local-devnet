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

export type WalletSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface WalletBalanceInfo {
  unshielded: string;
  shielded: string;
  dust: string;
  connected: boolean;
}

export interface CollectOptions {
  walletInfo?: WalletInfo;
  networkStatus?: string;
  polling?: PollingConfig;
  walletSyncStatus?: WalletSyncStatus;
  walletBalances?: Record<string, WalletBalanceInfo>;
}

export interface DashboardState {
  serverTime: string;
  walletSyncStatus: WalletSyncStatus;
  node: {
    chain: string | null;
    name: string | null;
    version: string | null;
    blockHeight: number | null;
    /** Average block production time in milliseconds, or null if insufficient data */
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
  walletBalances: Record<string, WalletBalanceInfo>;
}

export interface PollingConfig {
  node?: boolean;
  indexer?: boolean;
  proofServer?: boolean;
  proofVersions?: boolean;
  docker?: boolean;
  health?: boolean;
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

  // Cached values for per-service polling
  private cachedNode: DashboardState['node'] = {
    chain: null, name: null, version: null, blockHeight: null,
    avgBlockTime: null, peers: null, syncing: null,
  };
  private cachedIndexer: DashboardState['indexer'] = { ready: false, responseTime: null };
  private cachedProofServer: DashboardState['proofServer'] = {
    version: null, ready: false, jobsProcessing: null,
    jobsPending: null, jobCapacity: null, proofVersions: null,
  };
  private cachedHealth: DashboardState['health'] = {
    node: { status: 'unhealthy', history: [] },
    indexer: { status: 'unhealthy', history: [] },
    proofServer: { status: 'unhealthy', history: [] },
  };
  private cachedContainers: ServiceStatus[] = [];
  private cachedLogs: ParsedLogLine[] = [];

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  async collect(opts?: CollectOptions): Promise<DashboardState> {
    const { walletInfo, networkStatus, polling, walletSyncStatus, walletBalances } = opts ?? {};

    // When polling is undefined, all sections are fetched (backward compatible)
    const fetchNode = polling?.node !== false;
    const fetchIndexer = polling?.indexer !== false;
    const fetchProofServer = polling?.proofServer !== false;
    const fetchProofVer = polling?.proofVersions !== false;
    const fetchDocker = polling?.docker !== false;
    const fetchHealth = polling?.health !== false;

    // Build fetch promises conditionally
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
      fetchNode ? safeCall(() => fetchSystemChain(this.config.node), null) : Promise.resolve(null),
      fetchNode ? safeCall(() => fetchSystemName(this.config.node), null) : Promise.resolve(null),
      fetchNode ? safeCall(() => fetchSystemVersion(this.config.node), null) : Promise.resolve(null),
      fetchNode ? safeCall(() => fetchSystemHealth(this.config.node), null) : Promise.resolve(null),
      fetchNode ? safeCall(() => fetchBestBlockHeader(this.config.node), null) : Promise.resolve(null),
      // Version info changes rarely — fetch alongside proof versions (10 min interval)
      fetchProofVer ? safeCall(() => fetchProofServerVersion(this.config.proofServer), null) : Promise.resolve(null),
      // Ready/jobs status needs frequent polling (5s interval)
      fetchProofServer ? safeCall(() => fetchProofServerReady(this.config.proofServer), null) : Promise.resolve(null),
      fetchProofVer ? safeCall(() => fetchProofVersions(this.config.proofServer), null) : Promise.resolve(null),
      fetchDocker ? safeCall(() => composePs(), []) : Promise.resolve(null),
      fetchDocker ? safeCall(() => composeLogs({ lines: 100 }), '') : Promise.resolve(null),
      fetchHealth ? safeCall(() => checkAllHealth(this.config), null) : Promise.resolve(null),
    ]);

    // --- Node section ---
    if (fetchNode) {
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

      this.cachedNode = {
        chain,
        name,
        version,
        blockHeight,
        avgBlockTime,
        peers: systemHealth?.peers ?? null,
        syncing: systemHealth?.isSyncing ?? null,
      };
    }

    // --- Indexer section (derived from health report) ---
    if (fetchIndexer && fetchHealth) {
      this.cachedIndexer = {
        ready: healthReport?.indexer.healthy ?? false,
        responseTime: healthReport?.indexer.responseTime ?? null,
      };
    }

    // --- Proof server section ---
    // /ready is polled frequently (proofServer flag, 5s default)
    if (fetchProofServer) {
      this.cachedProofServer = {
        ...this.cachedProofServer,
        ready: proofReady?.status === 'ok',
        jobsProcessing: proofReady?.jobsProcessing ?? null,
        jobsPending: proofReady?.jobsPending ?? null,
        jobCapacity: proofReady?.jobCapacity ?? null,
      };
    }
    // /version and /proof-versions are fetched infrequently (proofVersions flag, 10 min default)
    if (fetchProofVer) {
      this.cachedProofServer = {
        ...this.cachedProofServer,
        version: proofVersion,
        proofVersions,
      };
    }

    // --- Health section ---
    if (fetchHealth) {
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

      this.cachedHealth = {
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
      };
    }

    // --- Docker section ---
    if (fetchDocker) {
      this.cachedContainers = containers ?? [];
      this.cachedLogs = parseLogLines(rawLogs ?? '');
    }

    return {
      serverTime: new Date().toISOString(),
      walletSyncStatus: walletSyncStatus ?? 'idle',
      node: { ...this.cachedNode },
      indexer: { ...this.cachedIndexer },
      proofServer: { ...this.cachedProofServer },
      wallet: walletInfo ?? {
        address: null,
        connected: false,
        unshielded: '0',
        shielded: '0',
        dust: '0',
      },
      health: this.cachedHealth,
      containers: [...this.cachedContainers],
      logs: [...this.cachedLogs],
      networkStatus: networkStatus ?? 'unknown',
      walletBalances: walletBalances ?? {},
    };
  }
}
