import { describe, it, expect } from 'vitest';
import { parseLogLines, filterLogs, type ParsedLogLine } from '../log-parser.js';

describe('log-parser', () => {
  describe('parseLogLines', () => {
    it('parses docker compose log format (container | message)', () => {
      const raw = 'midnight-node  | 2026-02-28 INFO: new block #1042\nmidnight-indexer  | synced to block 1040';
      const lines = parseLogLines(raw);
      expect(lines).toHaveLength(2);
      expect(lines[0].service).toBe('node');
      expect(lines[0].message).toBe('2026-02-28 INFO: new block #1042');
      expect(lines[1].service).toBe('indexer');
    });

    it('maps container names to service names', () => {
      const raw = [
        'midnight-node  | node log',
        'midnight-indexer  | indexer log',
        'midnight-proof-server  | proof log',
      ].join('\n');
      const lines = parseLogLines(raw);
      expect(lines.map((l) => l.service)).toEqual(['node', 'indexer', 'proof-server']);
    });

    it('detects log levels from message content', () => {
      const raw = [
        'midnight-node  | 2026-02-28 INFO: started',
        'midnight-node  | 2026-02-28 WARN: slow block',
        'midnight-node  | 2026-02-28 ERROR: connection lost',
        'midnight-node  | just a message',
      ].join('\n');
      const lines = parseLogLines(raw);
      expect(lines[0].level).toBe('info');
      expect(lines[1].level).toBe('warn');
      expect(lines[2].level).toBe('error');
      expect(lines[3].level).toBe('info'); // default
    });

    it('handles empty input', () => {
      expect(parseLogLines('')).toEqual([]);
    });

    it('handles lines without pipe separator', () => {
      const raw = 'some random line without separator';
      const lines = parseLogLines(raw);
      expect(lines).toHaveLength(1);
      expect(lines[0].service).toBe('unknown');
      expect(lines[0].message).toBe('some random line without separator');
    });
  });

  describe('filterLogs', () => {
    const lines: ParsedLogLine[] = [
      { service: 'node', level: 'info', message: 'block #1042', raw: '' },
      { service: 'indexer', level: 'warn', message: 'slow sync', raw: '' },
      { service: 'proof-server', level: 'error', message: 'job failed', raw: '' },
      { service: 'node', level: 'info', message: 'block #1043', raw: '' },
    ];

    it('filters by service', () => {
      const result = filterLogs(lines, { service: 'node' });
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.service === 'node')).toBe(true);
    });

    it('filters by log level', () => {
      const result = filterLogs(lines, { level: 'error' });
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('job failed');
    });

    it('filters by substring search', () => {
      const result = filterLogs(lines, { search: 'block' });
      expect(result).toHaveLength(2);
    });

    it('combines filters', () => {
      const result = filterLogs(lines, { service: 'node', search: '1043' });
      expect(result).toHaveLength(1);
    });

    it('returns all when no filters', () => {
      const result = filterLogs(lines, {});
      expect(result).toHaveLength(4);
    });
  });
});
