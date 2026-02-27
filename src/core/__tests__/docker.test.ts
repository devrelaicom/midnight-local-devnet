// src/core/__tests__/docker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

// Import AFTER mocking
import { isDockerRunning, composeUp, composeDown, composePs, composeLogs } from '../docker.js';

function mockExecSuccess(stdout: string, stderr = '') {
  mockExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: any, callback: Function) => {
      if (typeof _opts === 'function') {
        callback = _opts;
        _opts = {};
      }
      callback(null, stdout, stderr);
      return {} as any;
    },
  );
}

function mockExecFailure(error: Error) {
  mockExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: any, callback: Function) => {
      if (typeof _opts === 'function') {
        callback = _opts;
      }
      callback(error, '', '');
      return {} as any;
    },
  );
}

describe('docker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isDockerRunning', () => {
    it('returns true when docker info succeeds', async () => {
      mockExecSuccess('Docker version 24.0.0');
      const result = await isDockerRunning();
      expect(result).toBe(true);
    });

    it('returns false when docker info fails', async () => {
      mockExecFailure(new Error('Cannot connect to Docker'));
      const result = await isDockerRunning();
      expect(result).toBe(false);
    });
  });

  describe('composeUp', () => {
    it('calls docker compose up -d --wait with correct file path', async () => {
      mockExecSuccess('');
      await composeUp({ pull: false });
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['compose', 'up', '-d', '--wait']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('pulls images first when pull option is true', async () => {
      mockExecSuccess('');
      await composeUp({ pull: true });
      // First call = docker info, second = pull, third = up
      const composeCalls = mockExecFile.mock.calls.filter(
        (c: any[]) => c[1]?.includes?.('compose'),
      );
      expect(composeCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('composeDown', () => {
    it('calls docker compose down', async () => {
      mockExecSuccess('');
      await composeDown({ removeVolumes: false });
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['compose', 'down']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('passes -v flag when removeVolumes is true', async () => {
      mockExecSuccess('');
      await composeDown({ removeVolumes: true });
      expect(mockExecFile).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining(['-v']),
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe('composePs', () => {
    it('parses docker compose ps --format json output (array format)', async () => {
      const psOutput = JSON.stringify([
        { Name: 'midnight-node', State: 'running', Status: 'Up 5 minutes' },
        { Name: 'midnight-indexer', State: 'running', Status: 'Up 3 minutes' },
        { Name: 'midnight-proof-server', State: 'running', Status: 'Up 4 minutes' },
      ]);
      mockExecSuccess(psOutput);
      const result = await composePs();
      expect(result).toHaveLength(3);
      expect(result[0].containerName).toBe('midnight-node');
      expect(result[0].status).toBe('running');
    });

    it('parses newline-delimited JSON format', async () => {
      const psOutput = [
        JSON.stringify({ Name: 'midnight-node', State: 'running', Status: 'Up' }),
        JSON.stringify({ Name: 'midnight-indexer', State: 'running', Status: 'Up' }),
      ].join('\n');
      mockExecSuccess(psOutput);
      const result = await composePs();
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no containers', async () => {
      mockExecSuccess('');
      const result = await composePs();
      expect(result).toEqual([]);
    });
  });

  describe('composeLogs', () => {
    it('returns logs for a specific service', async () => {
      mockExecSuccess('2026-02-27 log line 1\n2026-02-27 log line 2');
      const logs = await composeLogs({ service: 'node', lines: 50 });
      expect(logs).toContain('log line 1');
    });

    it('returns logs for all services when no service specified', async () => {
      mockExecSuccess('combined logs');
      const logs = await composeLogs({});
      expect(logs).toBe('combined logs');
    });
  });
});
