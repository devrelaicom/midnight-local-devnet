// src/core/__tests__/network-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../docker.js', () => ({
  composeUp: vi.fn().mockResolvedValue(undefined),
  composeDown: vi.fn().mockResolvedValue(undefined),
  composePs: vi.fn().mockResolvedValue([]),
  composeLogs: vi.fn().mockResolvedValue(''),
  isDockerRunning: vi.fn().mockResolvedValue(true),
}));

vi.mock('../wallet.js', () => ({
  initMasterWallet: vi.fn().mockResolvedValue({
    wallet: { stop: vi.fn() },
    shieldedSecretKeys: {},
    dustSecretKey: {},
    unshieldedKeystore: {},
  }),
  registerNightForDust: vi.fn().mockResolvedValue(true),
  closeWallet: vi.fn().mockResolvedValue(undefined),
  setLogger: vi.fn(),
}));

import { NetworkManager } from '../network-manager.js';
import { composePs } from '../docker.js';

describe('NetworkManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in stopped state', () => {
    const mgr = new NetworkManager();
    expect(mgr.getStatus()).toBe('stopped');
    expect(mgr.getMasterWallet()).toBeNull();
  });

  it('detects already-running containers', async () => {
    vi.mocked(composePs).mockResolvedValueOnce([
      { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: '' },
      { name: 'indexer', containerName: 'midnight-indexer', status: 'running', port: 8088, url: '' },
      { name: 'proof-server', containerName: 'midnight-proof-server', status: 'running', port: 6300, url: '' },
    ]);
    const mgr = new NetworkManager();
    await mgr.detectRunningNetwork();
    expect(mgr.getStatus()).toBe('running');
  });

  it('stays stopped when no containers are running', async () => {
    vi.mocked(composePs).mockResolvedValueOnce([]);
    const mgr = new NetworkManager();
    await mgr.detectRunningNetwork();
    expect(mgr.getStatus()).toBe('stopped');
  });

  it('start is a no-op when already running', async () => {
    const mgr = new NetworkManager();
    vi.mocked(composePs).mockResolvedValueOnce([
      { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: '' },
      { name: 'indexer', containerName: 'midnight-indexer', status: 'running', port: 8088, url: '' },
      { name: 'proof-server', containerName: 'midnight-proof-server', status: 'running', port: 6300, url: '' },
    ]);
    await mgr.detectRunningNetwork();
    await mgr.ensureWallet();

    const result = await mgr.start({ pull: false });
    expect(result).toBe('already-running');
  });
});
