import { useMemo } from 'react';
import { useTerminalSize } from './use-terminal-size.js';

export type Breakpoint = 'small' | 'medium' | 'large';

export function getBreakpoint(width: number): Breakpoint {
  if (width < 40) return 'small';
  if (width < 120) return 'medium';
  return 'large';
}

export function useBreakpoint(): { breakpoint: Breakpoint; columns: number; rows: number } {
  const { columns, rows } = useTerminalSize();
  const breakpoint = useMemo(() => getBreakpoint(columns), [columns]);
  return { breakpoint, columns, rows };
}
