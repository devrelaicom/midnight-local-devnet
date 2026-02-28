import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  fetchSystemChain,
  fetchSystemName,
  fetchSystemVersion,
  fetchSystemHealth,
  fetchBestBlockHeader,
  type SystemHealth,
  type BlockHeader,
} from '../substrate-rpc.js';

const NODE_URL = 'http://127.0.0.1:9944';

function mockRpcResponse(result: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result }),
  });
}

function mockRpcError(message: string) {
  mockFetch.mockRejectedValueOnce(new Error(message));
}

describe('substrate-rpc', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchSystemChain', () => {
    it('returns chain name string', async () => {
      mockRpcResponse('Midnight Devnet');
      const result = await fetchSystemChain(NODE_URL);
      expect(result).toBe('Midnight Devnet');
    });

    it('returns null on network error', async () => {
      mockRpcError('Connection refused');
      const result = await fetchSystemChain(NODE_URL);
      expect(result).toBeNull();
    });
  });

  describe('fetchSystemName', () => {
    it('returns node name string', async () => {
      mockRpcResponse('Midnight Node');
      const result = await fetchSystemName(NODE_URL);
      expect(result).toBe('Midnight Node');
    });
  });

  describe('fetchSystemVersion', () => {
    it('returns version string', async () => {
      mockRpcResponse('0.20.0');
      const result = await fetchSystemVersion(NODE_URL);
      expect(result).toBe('0.20.0');
    });
  });

  describe('fetchSystemHealth', () => {
    it('returns health object', async () => {
      mockRpcResponse({ peers: 0, isSyncing: false, shouldHavePeers: false });
      const result = await fetchSystemHealth(NODE_URL);
      expect(result).toEqual({ peers: 0, isSyncing: false, shouldHavePeers: false });
    });

    it('returns null on error', async () => {
      mockRpcError('timeout');
      const result = await fetchSystemHealth(NODE_URL);
      expect(result).toBeNull();
    });
  });

  describe('fetchBestBlockHeader', () => {
    it('returns block number from hex header', async () => {
      mockRpcResponse({
        number: '0x412',
        parentHash: '0xabc',
        stateRoot: '0xdef',
        extrinsicsRoot: '0x123',
      });
      const result = await fetchBestBlockHeader(NODE_URL);
      expect(result).not.toBeNull();
      expect(result!.number).toBe(0x412);
    });

    it('returns null on error', async () => {
      mockRpcError('Connection refused');
      const result = await fetchBestBlockHeader(NODE_URL);
      expect(result).toBeNull();
    });
  });

  it('sends correct JSON-RPC payload', async () => {
    mockRpcResponse('test');
    await fetchSystemChain(NODE_URL);
    expect(mockFetch).toHaveBeenCalledWith(
      NODE_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'system_chain',
          params: [],
        }),
      }),
    );
  });
});
