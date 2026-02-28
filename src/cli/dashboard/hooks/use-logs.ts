import { useState, useCallback } from 'react';
import { usePolling } from './use-polling.js';
import { composeLogs } from '../../../core/docker.js';
import { parseLogLines, filterLogs, type ParsedLogLine, type LogFilter, type ServiceName, type LogLevel } from '../lib/log-parser.js';

export interface LogState {
  lines: ParsedLogLine[];
  filteredLines: ParsedLogLine[];
  filter: LogFilter;
  scrollOffset: number;
}

const SERVICE_CYCLE: (ServiceName | undefined)[] = [undefined, 'node', 'indexer', 'proof-server'];
const LEVEL_CYCLE: (LogLevel | undefined)[] = [undefined, 'info', 'warn', 'error'];

export function useLogs() {
  const [filter, setFilter] = useState<LogFilter>({});
  const [scrollOffset, setScrollOffset] = useState(0);

  const polling = usePolling(async () => {
    const raw = await composeLogs({ lines: 100 });
    return parseLogLines(raw);
  }, 3000);

  const lines = polling.data ?? [];
  const filteredLines = filterLogs(lines, filter);

  const cycleService = useCallback(() => {
    setFilter((prev) => {
      const currentIdx = SERVICE_CYCLE.indexOf(prev.service as ServiceName | undefined);
      const nextIdx = (currentIdx + 1) % SERVICE_CYCLE.length;
      return { ...prev, service: SERVICE_CYCLE[nextIdx] };
    });
    setScrollOffset(0);
  }, []);

  const cycleLevel = useCallback(() => {
    setFilter((prev) => {
      const currentIdx = LEVEL_CYCLE.indexOf(prev.level as LogLevel | undefined);
      const nextIdx = (currentIdx + 1) % LEVEL_CYCLE.length;
      return { ...prev, level: LEVEL_CYCLE[nextIdx] };
    });
    setScrollOffset(0);
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilter((prev) => ({ ...prev, search: search || undefined }));
    setScrollOffset(0);
  }, []);

  const scrollUp = useCallback(() => {
    setScrollOffset((prev) => Math.max(0, prev - 1));
  }, []);

  const scrollDown = useCallback(() => {
    setScrollOffset((prev) => Math.min(filteredLines.length - 1, prev + 1));
  }, [filteredLines.length]);

  return {
    lines: filteredLines,
    allLines: lines,
    filter,
    scrollOffset,
    loading: polling.loading,
    cycleService,
    cycleLevel,
    setSearch,
    scrollUp,
    scrollDown,
  };
}
