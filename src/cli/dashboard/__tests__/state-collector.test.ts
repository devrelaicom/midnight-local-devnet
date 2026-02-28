import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dashboard/lib/substrate-rpc.js', () => ({
  fetchSystemChain: vi.fn(),
  fetchSystemName: vi.fn(),
  fetchSystemVersion: vi.fn(),
  fetchSystemHealth: vi.fn(),
  fetchBestBlockHeader: vi.fn(),
}));

vi.mock('../../dashboard/lib/proof-server-api.js', () => ({
  fetchProofServerReady: vi.fn(),
  fetchProofServerVersion: vi.fn(),
  fetchProofVersions: vi.fn(),
}));

vi.mock('../../../core/docker.js', () => ({
  composePs: vi.fn(),
  composeLogs: vi.fn(),
}));

vi.mock('../../../core/health.js', () => ({
  checkAllHealth: vi.fn(),
}));

import {
  fetchSystemChain,
  fetchSystemName,
  fetchSystemVersion,
  fetchSystemHealth,
  fetchBestBlockHeader,
} from '../lib/substrate-rpc.js';
import {
  fetchProofServerReady,
  fetchProofServerVersion,
  fetchProofVersions,
} from '../lib/proof-server-api.js';
import { composePs, composeLogs } from '../../../core/docker.js';
import { checkAllHealth } from '../../../core/health.js';
import { StateCollector, type DashboardState } from '../state-collector.js';
import type { NetworkConfig, ServiceStatus } from '../../../core/types.js';

const mockConfig: NetworkConfig = {
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};

function setupAllMocksHealthy() {
  vi.mocked(fetchSystemChain).mockResolvedValue('Midnight Devnet');
  vi.mocked(fetchSystemName).mockResolvedValue('Midnight Node');
  vi.mocked(fetchSystemVersion).mockResolvedValue('0.20.0');
  vi.mocked(fetchSystemHealth).mockResolvedValue({
    peers: 0,
    isSyncing: false,
    shouldHavePeers: false,
  });
  vi.mocked(fetchBestBlockHeader).mockResolvedValue({
    number: 42,
    parentHash: '0xabc',
    stateRoot: '0xdef',
    extrinsicsRoot: '0x123',
  });

  vi.mocked(fetchProofServerVersion).mockResolvedValue('7.0.0');
  vi.mocked(fetchProofServerReady).mockResolvedValue({
    status: 'ok',
    jobsProcessing: 1,
    jobsPending: 2,
    jobCapacity: 4,
    timestamp: '2026-02-28T00:00:00Z',
  });
  vi.mocked(fetchProofVersions).mockResolvedValue(['v1', 'v2']);

  const containers: ServiceStatus[] = [
    { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: 'http://127.0.0.1:9944' },
    { name: 'indexer', containerName: 'midnight-indexer', status: 'running', port: 8088, url: 'http://127.0.0.1:8088/api/v3/graphql' },
    { name: 'proof-server', containerName: 'midnight-proof-server', status: 'running', port: 6300, url: 'http://127.0.0.1:6300' },
  ];
  vi.mocked(composePs).mockResolvedValue(containers);
  vi.mocked(composeLogs).mockResolvedValue(
    'midnight-node | 2026-02-28 Block imported #42\nmidnight-indexer | 2026-02-28 Indexed block 42\n',
  );

  vi.mocked(checkAllHealth).mockResolvedValue({
    node: { healthy: true, responseTime: 15 },
    indexer: { healthy: true, responseTime: 25 },
    proofServer: { healthy: true, responseTime: 35 },
    allHealthy: true,
  });
}

function setupAllMocksOffline() {
  vi.mocked(fetchSystemChain).mockResolvedValue(null);
  vi.mocked(fetchSystemName).mockResolvedValue(null);
  vi.mocked(fetchSystemVersion).mockResolvedValue(null);
  vi.mocked(fetchSystemHealth).mockResolvedValue(null);
  vi.mocked(fetchBestBlockHeader).mockResolvedValue(null);

  vi.mocked(fetchProofServerVersion).mockResolvedValue(null);
  vi.mocked(fetchProofServerReady).mockResolvedValue(null);
  vi.mocked(fetchProofVersions).mockResolvedValue(null);

  vi.mocked(composePs).mockResolvedValue([]);
  vi.mocked(composeLogs).mockResolvedValue('');

  vi.mocked(checkAllHealth).mockResolvedValue({
    node: { healthy: false, error: 'Connection refused' },
    indexer: { healthy: false, error: 'Connection refused' },
    proofServer: { healthy: false, error: 'Connection refused' },
    allHealthy: false,
  });
}

describe('StateCollector', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates an instance with a NetworkConfig', () => {
    const collector = new StateCollector(mockConfig);
    expect(collector).toBeInstanceOf(StateCollector);
  });

  describe('collect()', () => {
    it('returns a complete DashboardState with all healthy services', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      // Node
      expect(state.node.chain).toBe('Midnight Devnet');
      expect(state.node.name).toBe('Midnight Node');
      expect(state.node.version).toBe('0.20.0');
      expect(state.node.blockHeight).toBe(42);
      expect(state.node.peers).toBe(0);
      expect(state.node.syncing).toBe(false);

      // Proof server
      expect(state.proofServer.version).toBe('7.0.0');
      expect(state.proofServer.ready).toBe(true);
      expect(state.proofServer.jobsProcessing).toBe(1);
      expect(state.proofServer.jobsPending).toBe(2);
      expect(state.proofServer.jobCapacity).toBe(4);
      expect(state.proofServer.proofVersions).toEqual(['v1', 'v2']);

      // Indexer health
      expect(state.indexer.ready).toBe(true);
      expect(state.indexer.responseTime).toBeTypeOf('number');

      // Containers
      expect(state.containers).toHaveLength(3);
      expect(state.containers[0].name).toBe('node');

      // Logs
      expect(state.logs.length).toBeGreaterThan(0);
      expect(state.logs[0].service).toBe('node');

      // Health
      expect(state.health.node.status).toBe('healthy');
      expect(state.health.indexer.status).toBe('healthy');
      expect(state.health.proofServer.status).toBe('healthy');

      // Network status defaults to 'running' when not passed
      expect(state.networkStatus).toBe('running');
    });

    it('handles all services being offline gracefully', async () => {
      setupAllMocksOffline();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      // Node fields are null
      expect(state.node.chain).toBeNull();
      expect(state.node.name).toBeNull();
      expect(state.node.version).toBeNull();
      expect(state.node.blockHeight).toBeNull();
      expect(state.node.peers).toBeNull();
      expect(state.node.syncing).toBeNull();

      // Proof server fields are null/defaults
      expect(state.proofServer.version).toBeNull();
      expect(state.proofServer.ready).toBe(false);
      expect(state.proofServer.jobsProcessing).toBeNull();
      expect(state.proofServer.jobsPending).toBeNull();
      expect(state.proofServer.jobCapacity).toBeNull();
      expect(state.proofServer.proofVersions).toBeNull();

      // Indexer offline
      expect(state.indexer.ready).toBe(false);

      // No containers
      expect(state.containers).toEqual([]);

      // No logs
      expect(state.logs).toEqual([]);

      // Health is unhealthy
      expect(state.health.node.status).toBe('unhealthy');
      expect(state.health.indexer.status).toBe('unhealthy');
      expect(state.health.proofServer.status).toBe('unhealthy');
    });

    it('uses walletInfo when provided', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const walletInfo = {
        address: 'midnight1abc123',
        connected: true,
        unshielded: '1000.00',
        shielded: '500.00',
        dust: '10.00',
      };

      const state = await collector.collect(walletInfo);

      expect(state.wallet.address).toBe('midnight1abc123');
      expect(state.wallet.connected).toBe(true);
      expect(state.wallet.unshielded).toBe('1000.00');
      expect(state.wallet.shielded).toBe('500.00');
      expect(state.wallet.dust).toBe('10.00');
    });

    it('returns default wallet info when walletInfo not provided', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.wallet.address).toBeNull();
      expect(state.wallet.connected).toBe(false);
      expect(state.wallet.unshielded).toBe('0');
      expect(state.wallet.shielded).toBe('0');
      expect(state.wallet.dust).toBe('0');
    });

    it('uses networkStatus when provided', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect(undefined, 'starting');

      expect(state.networkStatus).toBe('starting');
    });

    it('defaults networkStatus to "running" when not provided', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.networkStatus).toBe('running');
    });

    it('calls all data-fetching functions with correct URLs', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      await collector.collect();

      expect(fetchSystemChain).toHaveBeenCalledWith('http://127.0.0.1:9944');
      expect(fetchSystemName).toHaveBeenCalledWith('http://127.0.0.1:9944');
      expect(fetchSystemVersion).toHaveBeenCalledWith('http://127.0.0.1:9944');
      expect(fetchSystemHealth).toHaveBeenCalledWith('http://127.0.0.1:9944');
      expect(fetchBestBlockHeader).toHaveBeenCalledWith('http://127.0.0.1:9944');

      expect(fetchProofServerVersion).toHaveBeenCalledWith('http://127.0.0.1:6300');
      expect(fetchProofServerReady).toHaveBeenCalledWith('http://127.0.0.1:6300');
      expect(fetchProofVersions).toHaveBeenCalledWith('http://127.0.0.1:6300');

      expect(checkAllHealth).toHaveBeenCalledWith(mockConfig);
    });

    it('handles partial service availability', async () => {
      // Node online, proof server and indexer offline
      vi.mocked(fetchSystemChain).mockResolvedValue('Midnight Devnet');
      vi.mocked(fetchSystemName).mockResolvedValue('Midnight Node');
      vi.mocked(fetchSystemVersion).mockResolvedValue('0.20.0');
      vi.mocked(fetchSystemHealth).mockResolvedValue({ peers: 0, isSyncing: false, shouldHavePeers: false });
      vi.mocked(fetchBestBlockHeader).mockResolvedValue({
        number: 10,
        parentHash: '0xabc',
        stateRoot: '0xdef',
        extrinsicsRoot: '0x123',
      });

      vi.mocked(fetchProofServerVersion).mockResolvedValue(null);
      vi.mocked(fetchProofServerReady).mockResolvedValue(null);
      vi.mocked(fetchProofVersions).mockResolvedValue(null);

      vi.mocked(composePs).mockResolvedValue([
        { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: 'http://127.0.0.1:9944' },
      ]);
      vi.mocked(composeLogs).mockResolvedValue('midnight-node | Block imported\n');

      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 10 },
        indexer: { healthy: false, error: 'timeout' },
        proofServer: { healthy: false, error: 'timeout' },
        allHealthy: false,
      });

      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.node.chain).toBe('Midnight Devnet');
      expect(state.node.blockHeight).toBe(10);
      expect(state.proofServer.version).toBeNull();
      expect(state.proofServer.ready).toBe(false);
      expect(state.health.node.status).toBe('healthy');
      expect(state.health.indexer.status).toBe('unhealthy');
      expect(state.health.proofServer.status).toBe('unhealthy');
    });

    it('handles proof server busy status', async () => {
      setupAllMocksHealthy();
      vi.mocked(fetchProofServerReady).mockResolvedValue({
        status: 'busy',
        jobsProcessing: 4,
        jobsPending: 10,
        jobCapacity: 4,
        timestamp: '2026-02-28T00:00:00Z',
      });

      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.proofServer.ready).toBe(false);
      expect(state.proofServer.jobsProcessing).toBe(4);
      expect(state.proofServer.jobsPending).toBe(10);
    });
  });

  describe('response time history', () => {
    it('tracks response time history across multiple collect() calls', async () => {
      const collector = new StateCollector(mockConfig);

      // First call
      setupAllMocksHealthy();
      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 10 },
        indexer: { healthy: true, responseTime: 20 },
        proofServer: { healthy: true, responseTime: 30 },
        allHealthy: true,
      });
      const state1 = await collector.collect();
      expect(state1.health.node.history).toEqual([10]);
      expect(state1.health.indexer.history).toEqual([20]);
      expect(state1.health.proofServer.history).toEqual([30]);

      // Second call - different times
      vi.resetAllMocks();
      setupAllMocksHealthy();
      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 15 },
        indexer: { healthy: true, responseTime: 25 },
        proofServer: { healthy: true, responseTime: 35 },
        allHealthy: true,
      });
      const state2 = await collector.collect();
      expect(state2.health.node.history).toEqual([10, 15]);
      expect(state2.health.indexer.history).toEqual([20, 25]);
      expect(state2.health.proofServer.history).toEqual([30, 35]);
    });

    it('does not add to history when responseTime is undefined', async () => {
      const collector = new StateCollector(mockConfig);

      setupAllMocksHealthy();
      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: false, error: 'Connection refused' },
        indexer: { healthy: false, error: 'Connection refused' },
        proofServer: { healthy: false, error: 'Connection refused' },
        allHealthy: false,
      });

      const state = await collector.collect();
      expect(state.health.node.history).toEqual([]);
      expect(state.health.indexer.history).toEqual([]);
      expect(state.health.proofServer.history).toEqual([]);
    });

    it('caps history at 30 entries', async () => {
      const collector = new StateCollector(mockConfig);

      // Collect 35 times
      for (let i = 0; i < 35; i++) {
        vi.resetAllMocks();
        setupAllMocksHealthy();
        vi.mocked(checkAllHealth).mockResolvedValue({
          node: { healthy: true, responseTime: i + 1 },
          indexer: { healthy: true, responseTime: (i + 1) * 2 },
          proofServer: { healthy: true, responseTime: (i + 1) * 3 },
          allHealthy: true,
        });
        await collector.collect();
      }

      // One more collect to get the final state
      vi.resetAllMocks();
      setupAllMocksHealthy();
      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 100 },
        indexer: { healthy: true, responseTime: 200 },
        proofServer: { healthy: true, responseTime: 300 },
        allHealthy: true,
      });
      const state = await collector.collect();

      // Should be capped at 30
      expect(state.health.node.history).toHaveLength(30);
      expect(state.health.indexer.history).toHaveLength(30);
      expect(state.health.proofServer.history).toHaveLength(30);

      // The oldest entries should have been dropped (1-6 dropped, 7-36 remain where 36=100)
      expect(state.health.node.history[0]).toBe(7);
      expect(state.health.node.history[state.health.node.history.length - 1]).toBe(100);
    });

    it('returns copies of history arrays (not internal references)', async () => {
      const collector = new StateCollector(mockConfig);

      setupAllMocksHealthy();
      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 10 },
        indexer: { healthy: true, responseTime: 20 },
        proofServer: { healthy: true, responseTime: 30 },
        allHealthy: true,
      });
      const state1 = await collector.collect();

      // Mutate the returned array
      state1.health.node.history.push(999);

      // Second collect should not be affected
      vi.resetAllMocks();
      setupAllMocksHealthy();
      vi.mocked(checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 15 },
        indexer: { healthy: true, responseTime: 25 },
        proofServer: { healthy: true, responseTime: 35 },
        allHealthy: true,
      });
      const state2 = await collector.collect();
      expect(state2.health.node.history).toEqual([10, 15]);
    });
  });

  describe('avgBlockTime', () => {
    it('returns null on the first collect (no previous block height)', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.node.avgBlockTime).toBeNull();
    });

    it('computes avgBlockTime from consecutive block heights', async () => {
      vi.useFakeTimers();
      try {
        const collector = new StateCollector(mockConfig);

        // First call at t=0 - block 10
        vi.setSystemTime(1000);
        setupAllMocksHealthy();
        vi.mocked(fetchBestBlockHeader).mockResolvedValue({
          number: 10,
          parentHash: '0xabc',
          stateRoot: '0xdef',
          extrinsicsRoot: '0x123',
        });
        await collector.collect();

        // Second call at t=6000 - block 12 (2 blocks in 6 seconds => 3000ms/block)
        vi.setSystemTime(7000);
        vi.mocked(fetchSystemChain).mockResolvedValue('Midnight Devnet');
        vi.mocked(fetchSystemName).mockResolvedValue('Midnight Node');
        vi.mocked(fetchSystemVersion).mockResolvedValue('0.20.0');
        vi.mocked(fetchSystemHealth).mockResolvedValue({
          peers: 0,
          isSyncing: false,
          shouldHavePeers: false,
        });
        vi.mocked(fetchBestBlockHeader).mockResolvedValue({
          number: 12,
          parentHash: '0xabc',
          stateRoot: '0xdef',
          extrinsicsRoot: '0x123',
        });
        vi.mocked(fetchProofServerVersion).mockResolvedValue('7.0.0');
        vi.mocked(fetchProofServerReady).mockResolvedValue({
          status: 'ok',
          jobsProcessing: 1,
          jobsPending: 2,
          jobCapacity: 4,
          timestamp: '2026-02-28T00:00:00Z',
        });
        vi.mocked(fetchProofVersions).mockResolvedValue(['v1', 'v2']);
        vi.mocked(composePs).mockResolvedValue([]);
        vi.mocked(composeLogs).mockResolvedValue('');
        vi.mocked(checkAllHealth).mockResolvedValue({
          node: { healthy: true, responseTime: 15 },
          indexer: { healthy: true, responseTime: 25 },
          proofServer: { healthy: true, responseTime: 35 },
          allHealthy: true,
        });
        const state = await collector.collect();

        // 6000ms elapsed / 2 blocks = 3000ms per block
        expect(state.node.avgBlockTime).toBe(3000);
      } finally {
        vi.useRealTimers();
      }
    });

    it('returns null when block height has not advanced', async () => {
      const collector = new StateCollector(mockConfig);

      // First call
      setupAllMocksHealthy();
      vi.mocked(fetchBestBlockHeader).mockResolvedValue({
        number: 10,
        parentHash: '0xabc',
        stateRoot: '0xdef',
        extrinsicsRoot: '0x123',
      });
      await collector.collect();

      // Second call - same block
      vi.resetAllMocks();
      setupAllMocksHealthy();
      vi.mocked(fetchBestBlockHeader).mockResolvedValue({
        number: 10,
        parentHash: '0xabc',
        stateRoot: '0xdef',
        extrinsicsRoot: '0x123',
      });
      const state = await collector.collect();

      expect(state.node.avgBlockTime).toBeNull();
    });
  });

  describe('error resilience', () => {
    it('does not throw when individual fetches throw', async () => {
      vi.mocked(fetchSystemChain).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchSystemName).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchSystemVersion).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchSystemHealth).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchBestBlockHeader).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchProofServerVersion).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchProofServerReady).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchProofVersions).mockRejectedValue(new Error('boom'));
      vi.mocked(composePs).mockRejectedValue(new Error('boom'));
      vi.mocked(composeLogs).mockRejectedValue(new Error('boom'));
      vi.mocked(checkAllHealth).mockRejectedValue(new Error('boom'));

      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      // Should still return a valid state with null/default values
      expect(state.node.chain).toBeNull();
      expect(state.node.name).toBeNull();
      expect(state.node.version).toBeNull();
      expect(state.node.blockHeight).toBeNull();
      expect(state.node.peers).toBeNull();
      expect(state.node.syncing).toBeNull();
      expect(state.proofServer.version).toBeNull();
      expect(state.proofServer.ready).toBe(false);
      expect(state.containers).toEqual([]);
      expect(state.logs).toEqual([]);
      expect(state.health.node.status).toBe('unhealthy');
      expect(state.health.indexer.status).toBe('unhealthy');
      expect(state.health.proofServer.status).toBe('unhealthy');
    });
  });

  describe('DashboardState shape', () => {
    it('has all required top-level properties', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state).toHaveProperty('node');
      expect(state).toHaveProperty('indexer');
      expect(state).toHaveProperty('proofServer');
      expect(state).toHaveProperty('wallet');
      expect(state).toHaveProperty('health');
      expect(state).toHaveProperty('containers');
      expect(state).toHaveProperty('logs');
      expect(state).toHaveProperty('networkStatus');
    });

    it('node has all required properties', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.node).toHaveProperty('chain');
      expect(state.node).toHaveProperty('name');
      expect(state.node).toHaveProperty('version');
      expect(state.node).toHaveProperty('blockHeight');
      expect(state.node).toHaveProperty('avgBlockTime');
      expect(state.node).toHaveProperty('peers');
      expect(state.node).toHaveProperty('syncing');
    });

    it('proofServer has all required properties', async () => {
      setupAllMocksHealthy();
      const collector = new StateCollector(mockConfig);
      const state = await collector.collect();

      expect(state.proofServer).toHaveProperty('version');
      expect(state.proofServer).toHaveProperty('ready');
      expect(state.proofServer).toHaveProperty('jobsProcessing');
      expect(state.proofServer).toHaveProperty('jobsPending');
      expect(state.proofServer).toHaveProperty('jobCapacity');
      expect(state.proofServer).toHaveProperty('proofVersions');
    });
  });
});
