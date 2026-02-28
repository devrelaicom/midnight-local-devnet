export type ServiceName = 'node' | 'indexer' | 'proof-server' | 'unknown';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface ParsedLogLine {
  service: ServiceName;
  level: LogLevel;
  message: string;
  raw: string;
}

export interface LogFilter {
  service?: ServiceName;
  level?: LogLevel;
  search?: string;
}

const CONTAINER_MAP: Record<string, ServiceName> = {
  'midnight-node': 'node',
  'midnight-indexer': 'indexer',
  'midnight-proof-server': 'proof-server',
};

function detectLevel(message: string): LogLevel {
  const upper = message.toUpperCase();
  if (upper.includes('ERROR') || upper.includes('ERR ')) return 'error';
  if (upper.includes('WARN')) return 'warn';
  if (upper.includes('DEBUG')) return 'debug';
  return 'info';
}

export function parseLogLines(raw: string): ParsedLogLine[] {
  if (!raw.trim()) return [];

  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const pipeIndex = line.indexOf(' | ');
      if (pipeIndex === -1) {
        return { service: 'unknown' as ServiceName, level: detectLevel(line), message: line.trim(), raw: line };
      }

      const containerRaw = line.slice(0, pipeIndex).trim();
      const message = line.slice(pipeIndex + 3);
      const service = CONTAINER_MAP[containerRaw] ?? 'unknown';

      return { service, level: detectLevel(message), message, raw: line };
    });
}

export function filterLogs(lines: ParsedLogLine[], filter: LogFilter): ParsedLogLine[] {
  return lines.filter((line) => {
    if (filter.service && line.service !== filter.service) return false;
    if (filter.level && line.level !== filter.level) return false;
    if (filter.search && !line.message.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });
}
