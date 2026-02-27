// src/core/__tests__/health.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkAllHealth', () => {
    it('returns healthy when all services respond', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });
      const { checkAllHealth } = await import('../health.js');
      const result = await checkAllHealth();
      expect(result.node.healthy).toBe(true);
      expect(result.indexer.healthy).toBe(true);
      expect(result.proofServer.healthy).toBe(true);
      expect(result.allHealthy).toBe(true);
    });

    it('returns unhealthy when a service fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('OK') })    // node
        .mockRejectedValueOnce(new Error('Connection refused'))                       // indexer
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('1.0') });   // proof-server
      const { checkAllHealth } = await import('../health.js');
      const result = await checkAllHealth();
      expect(result.node.healthy).toBe(true);
      expect(result.indexer.healthy).toBe(false);
      expect(result.indexer.error).toContain('Connection refused');
      expect(result.proofServer.healthy).toBe(true);
      expect(result.allHealthy).toBe(false);
    });

    it('handles timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError: signal timed out'));
      const { checkAllHealth } = await import('../health.js');
      const result = await checkAllHealth();
      expect(result.allHealthy).toBe(false);
      expect(result.node.error).toBeDefined();
    });
  });
});
