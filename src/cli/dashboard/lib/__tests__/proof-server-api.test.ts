import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  fetchProofServerHealth,
  fetchProofServerVersion,
  fetchProofServerReady,
  fetchProofVersions,
  type ProofServerHealth,
  type ProofServerReady,
} from '../proof-server-api.js';

const BASE_URL = 'http://127.0.0.1:6300';

describe('proof-server-api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchProofServerHealth', () => {
    it('returns health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: '2026-02-28T00:00:00Z' }),
      });
      const result = await fetchProofServerHealth(BASE_URL);
      expect(result).toEqual({ status: 'ok', timestamp: '2026-02-28T00:00:00Z' });
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('refused'));
      const result = await fetchProofServerHealth(BASE_URL);
      expect(result).toBeNull();
    });
  });

  describe('fetchProofServerVersion', () => {
    it('returns version string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('8.0.0-rc.4'),
      });
      const result = await fetchProofServerVersion(BASE_URL);
      expect(result).toBe('8.0.0-rc.4');
    });
  });

  describe('fetchProofServerReady', () => {
    it('returns ready status with job info', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'ok',
          jobsProcessing: 1,
          jobsPending: 0,
          jobCapacity: 4,
          timestamp: '2026-02-28T00:00:00Z',
        }),
      });
      const result = await fetchProofServerReady(BASE_URL);
      expect(result).toEqual({
        status: 'ok',
        jobsProcessing: 1,
        jobsPending: 0,
        jobCapacity: 4,
        timestamp: '2026-02-28T00:00:00Z',
      });
    });

    it('returns busy status on 503', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.resolve({
          status: 'busy',
          jobsProcessing: 4,
          jobsPending: 2,
          jobCapacity: 4,
          timestamp: '2026-02-28T00:00:00Z',
        }),
      });
      const result = await fetchProofServerReady(BASE_URL);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('busy');
    });
  });

  describe('fetchProofVersions', () => {
    it('returns array of supported proof versions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('["V2"]'),
      });
      const result = await fetchProofVersions(BASE_URL);
      expect(result).toEqual(['V2']);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('refused'));
      const result = await fetchProofVersions(BASE_URL);
      expect(result).toBeNull();
    });
  });
});
