import React from 'react';
import { Box, Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import type { ParsedLogLine, LogFilter } from '../lib/log-parser.js';

interface LogPanelProps {
  lines: ParsedLogLine[];
  filter: LogFilter;
  scrollOffset: number;
  maxLines?: number;
  focused?: boolean;
  searchMode?: boolean;
  searchText?: string;
}

const SERVICE_COLORS: Record<string, string> = {
  node: 'green',
  indexer: 'blue',
  'proof-server': 'yellow',
  unknown: 'gray',
};

const LEVEL_COLORS: Record<string, string> = {
  error: 'red',
  warn: 'yellow',
  info: 'white',
  debug: 'gray',
};

export function LogPanel({
  lines,
  filter,
  scrollOffset,
  maxLines = 10,
  focused,
  searchMode,
  searchText,
}: LogPanelProps): React.ReactElement {
  const visibleLines = lines.slice(scrollOffset, scrollOffset + maxLines);

  const filterLabel = [
    filter.service ? `svc:${filter.service}` : null,
    filter.level ? `lvl:${filter.level}` : null,
    filter.search ? `/${filter.search}` : null,
  ]
    .filter(Boolean)
    .join(' ') || 'all';

  return (
    <PanelBox title={`Logs (${filterLabel})`} focused={focused}>
      {visibleLines.length === 0 ? (
        <Text color="gray">No log entries{filter.service || filter.level || filter.search ? ' matching filter' : ''}</Text>
      ) : (
        visibleLines.map((line, i) => (
          <Box key={`${scrollOffset + i}-${line.service}`}>
            <Text color={SERVICE_COLORS[line.service] ?? 'gray'}>
              [{line.service.padEnd(6).slice(0, 6)}]
            </Text>
            <Text> </Text>
            <Text color={LEVEL_COLORS[line.level] ?? 'white'}>
              {line.message.slice(0, 200)}
            </Text>
          </Box>
        ))
      )}
      {searchMode && (
        <Box>
          <Text color="cyan">Search: {searchText ?? ''}_</Text>
        </Box>
      )}
      <Box>
        <Text color="gray">
          {lines.length} lines | s=service l=level /=search | {'\u2191\u2193'} scroll
        </Text>
      </Box>
    </PanelBox>
  );
}
