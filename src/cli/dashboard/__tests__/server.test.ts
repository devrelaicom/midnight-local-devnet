import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the state-collector module
vi.mock('../../dashboard/state-collector.js', () => {
  const StateCollector = vi.fn().mockImplementation(() => ({
    collect: vi.fn().mockResolvedValue({
      node: { chain: null, name: null, version: null, blockHeight: null, avgBlockTime: null, peers: null, syncing: null },
      indexer: { ready: false, responseTime: null },
      proofServer: { version: null, ready: false, jobsProcessing: null, jobsPending: null, jobCapacity: null, proofVersions: null },
      wallet: { address: null, connected: false, unshielded: '0', shielded: '0', dust: '0' },
      health: {
        node: { status: 'unhealthy', history: [] },
        indexer: { status: 'unhealthy', history: [] },
        proofServer: { status: 'unhealthy', history: [] },
      },
      containers: [],
      logs: [],
      networkStatus: 'stopped',
    }),
  }));
  return { StateCollector };
});

// Mock the html module
vi.mock('../../dashboard/html.js', () => ({
  generateDashboardHtml: vi.fn().mockReturnValue('<html><body>Dashboard</body></html>'),
}));

// Mock the wallet module
vi.mock('../../../core/wallet.js', () => ({
  getWalletBalances: vi.fn().mockResolvedValue({
    unshielded: 1000n,
    shielded: 500n,
    dust: 10n,
    total: 1510n,
  }),
}));

import { createDashboardApp } from '../server.js';
import { generateDashboardHtml } from '../html.js';
import type { NetworkConfig } from '../../../core/types.js';
import type { NetworkManager } from '../../../core/network-manager.js';

const mockConfig: NetworkConfig = {
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};

function makeMockManager(overrides: Partial<NetworkManager> = {}): NetworkManager {
  return {
    config: mockConfig,
    getStatus: vi.fn().mockReturnValue('stopped'),
    getMasterWallet: vi.fn().mockReturnValue(null),
    start: vi.fn().mockResolvedValue('started'),
    stop: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as NetworkManager;
}

describe('createDashboardApp', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateDashboardHtml).mockReturnValue('<html><body>Dashboard</body></html>');
  });

  it('returns an object with app, setupWebSocket, startPolling, stopPolling, shutdown', () => {
    const manager = makeMockManager();
    const result = createDashboardApp({ config: mockConfig, manager, port: 3000 });

    expect(result).toHaveProperty('app');
    expect(result).toHaveProperty('setupWebSocket');
    expect(result).toHaveProperty('startPolling');
    expect(result).toHaveProperty('stopPolling');
    expect(result).toHaveProperty('shutdown');

    expect(typeof result.setupWebSocket).toBe('function');
    expect(typeof result.startPolling).toBe('function');
    expect(typeof result.stopPolling).toBe('function');
    expect(typeof result.shutdown).toBe('function');
  });

  describe('GET /', () => {
    it('returns 200 with text/html content type', async () => {
      const manager = makeMockManager();
      const { app } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      const response = await app.request('/');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });

    it('response body contains HTML from generateDashboardHtml', async () => {
      const manager = makeMockManager();
      const { app } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      const response = await app.request('/');
      const body = await response.text();

      expect(body).toContain('<html>');
      expect(body).toContain('Dashboard');
    });

    it('calls generateDashboardHtml with correct wsUrl', async () => {
      const manager = makeMockManager();
      const { app } = createDashboardApp({ config: mockConfig, manager, port: 4567 });

      await app.request('/');

      expect(generateDashboardHtml).toHaveBeenCalledWith({
        wsUrl: 'ws://localhost:4567/ws',
      });
    });
  });

  describe('setupWebSocket', () => {
    it('is a function that accepts a server argument', () => {
      const manager = makeMockManager();
      const { setupWebSocket } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      expect(typeof setupWebSocket).toBe('function');
      // We verify it's callable; actual WebSocket server creation requires a real HTTP server
    });
  });

  describe('polling', () => {
    it('startPolling and stopPolling are callable without errors', () => {
      const manager = makeMockManager();
      const { startPolling, stopPolling } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      // Should not throw
      expect(() => startPolling()).not.toThrow();
      expect(() => stopPolling()).not.toThrow();
    });

    it('stopPolling can be called multiple times safely', () => {
      const manager = makeMockManager();
      const { startPolling, stopPolling } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      startPolling();
      expect(() => stopPolling()).not.toThrow();
      expect(() => stopPolling()).not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('is callable without errors', () => {
      const manager = makeMockManager();
      const { shutdown } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      expect(() => shutdown()).not.toThrow();
    });

    it('stops polling when called', () => {
      const manager = makeMockManager();
      const { startPolling, shutdown } = createDashboardApp({ config: mockConfig, manager, port: 3000 });

      startPolling();
      // shutdown should not throw even after polling started
      expect(() => shutdown()).not.toThrow();
    });
  });
});
