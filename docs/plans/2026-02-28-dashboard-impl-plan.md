# Dashboard Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `dashboard` command that renders a realtime gtop-style terminal UI showing Midnight devnet service status, health, wallet balances, and logs with responsive breakpoints.

**Architecture:** Ink (React for CLIs) with independent polling hooks per data source. Three responsive layouts (small/medium/large) at 40/80/120 column breakpoints. Data layer uses thin API clients for Substrate JSON-RPC (node), REST (proof server), and reuses existing Docker/health/wallet core modules.

**Tech Stack:** ink 6, React 19, TypeScript with JSX, vitest for testing, ink-testing-library for component tests.

**Design doc:** `docs/plans/2026-02-28-dashboard-design.md`

---

## Task 1: Project Setup — Dependencies and TSX Configuration

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

**Step 1: Install production dependencies**

Run:
```bash
npm install ink@^6 react@^19
```

**Step 2: Install dev dependencies**

Run:
```bash
npm install --save-dev @types/react@^19 ink-testing-library@^4
```

**Step 3: Update tsconfig.json for JSX support**

Add `"jsx": "react-jsx"` to compilerOptions and include `.tsx` files:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "lib": ["ESNext"],
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "node16",
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strict": true,
    "isolatedModules": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx"
  }
}
```

**Step 4: Verify TypeScript compiles with new config**

Run:
```bash
npm run build
```
Expected: Compiles without errors. Existing tests still pass.

**Step 5: Run existing tests to verify nothing is broken**

Run:
```bash
npm test
```
Expected: All 30 unit tests pass.

**Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: add ink, react dependencies and enable JSX in tsconfig"
```

---

## Task 2: CLI Refactor — Remove Default Interactive Mode

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli/interactive.ts` (keep, but it will be registered as a command)
- Create: `src/cli/commands/interactive.ts`

**Step 1: Create the interactive command registration module**

Create `src/cli/commands/interactive.ts`:

```typescript
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { startInteractiveMode } from '../interactive.js';

export function registerInteractiveCommand(program: Command, manager: NetworkManager): void {
  program
    .command('interactive')
    .description('Start interactive menu mode')
    .action(async () => {
      await startInteractiveMode(manager);
    });
}
```

**Step 2: Update `src/cli.ts` to remove auto-interactive logic**

Replace the entire file with:

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { NetworkManager } from './core/network-manager.js';
import { registerNetworkCommands } from './cli/commands/network.js';
import { registerWalletCommands } from './cli/commands/wallet.js';
import { registerAccountCommands } from './cli/commands/accounts.js';
import { registerInteractiveCommand } from './cli/commands/interactive.js';
import { createLogger } from './core/logger.js';
import { setLogger as setWalletLogger } from './core/wallet.js';
import { setLogger as setFundingLogger } from './core/funding.js';
import { setLogger as setAccountsLogger } from './core/accounts.js';

const manager = new NetworkManager();

const logger = createLogger('info', process.stdout);
setWalletLogger(logger);
setFundingLogger(logger);
setAccountsLogger(logger);
manager.setLogger(logger);

// Detect existing containers before running any command
await manager.detectRunningNetwork();

// Graceful shutdown on Ctrl+C
const shutdown = async () => {
  await manager.shutdown();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const program = new Command();

program
  .name('midnight-local-devnet')
  .description('Manage a local Midnight development network')
  .version('0.1.2');

registerNetworkCommands(program, manager);
registerWalletCommands(program, manager);
registerAccountCommands(program, manager);
registerInteractiveCommand(program, manager);

program.parse();
```

Key changes:
- Removed `isInteractive` detection
- Always create Commander program
- Logger always goes to stdout (no stderr hack)
- Registered interactive as a named command
- No subcommand → Commander shows help automatically

**Step 3: Build and verify help output**

Run:
```bash
npm run build && node dist/cli.js --help
```
Expected: Shows help with all commands including `interactive`.

**Step 4: Verify interactive command still works**

Run:
```bash
node dist/cli.js interactive
```
Expected: Launches the interactive menu (exit with 0).

**Step 5: Commit**

```bash
git add src/cli.ts src/cli/commands/interactive.ts
git commit -m "refactor: make interactive mode a named command, show help by default"
```

---

## Task 3: Data Layer — Substrate JSON-RPC Client

**Files:**
- Create: `src/cli/dashboard/lib/substrate-rpc.ts`
- Create: `src/cli/dashboard/lib/__tests__/substrate-rpc.test.ts`

**Step 1: Write the failing tests**

Create `src/cli/dashboard/lib/__tests__/substrate-rpc.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/cli/dashboard/lib/__tests__/substrate-rpc.test.ts
```
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `src/cli/dashboard/lib/substrate-rpc.ts`:

```typescript
export interface SystemHealth {
  peers: number;
  isSyncing: boolean;
  shouldHavePeers: boolean;
}

export interface BlockHeader {
  number: number;
  parentHash: string;
  stateRoot: string;
  extrinsicsRoot: string;
}

async function rpcCall<T>(url: string, method: string, params: unknown[] = []): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await response.json() as { result: T };
    return json.result;
  } catch {
    return null;
  }
}

export function fetchSystemChain(url: string): Promise<string | null> {
  return rpcCall<string>(url, 'system_chain');
}

export function fetchSystemName(url: string): Promise<string | null> {
  return rpcCall<string>(url, 'system_name');
}

export function fetchSystemVersion(url: string): Promise<string | null> {
  return rpcCall<string>(url, 'system_version');
}

export function fetchSystemHealth(url: string): Promise<SystemHealth | null> {
  return rpcCall<SystemHealth>(url, 'system_health');
}

export async function fetchBestBlockHeader(url: string): Promise<BlockHeader | null> {
  const raw = await rpcCall<{ number: string; parentHash: string; stateRoot: string; extrinsicsRoot: string }>(
    url,
    'chain_getHeader',
  );
  if (!raw) return null;
  return {
    number: parseInt(raw.number, 16),
    parentHash: raw.parentHash,
    stateRoot: raw.stateRoot,
    extrinsicsRoot: raw.extrinsicsRoot,
  };
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run src/cli/dashboard/lib/__tests__/substrate-rpc.test.ts
```
Expected: All pass.

**Step 5: Commit**

```bash
git add src/cli/dashboard/lib/substrate-rpc.ts src/cli/dashboard/lib/__tests__/substrate-rpc.test.ts
git commit -m "feat(dashboard): add Substrate JSON-RPC client"
```

---

## Task 4: Data Layer — Proof Server API Client

**Files:**
- Create: `src/cli/dashboard/lib/proof-server-api.ts`
- Create: `src/cli/dashboard/lib/__tests__/proof-server-api.test.ts`

**Step 1: Write the failing tests**

Create `src/cli/dashboard/lib/__tests__/proof-server-api.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/cli/dashboard/lib/__tests__/proof-server-api.test.ts
```
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `src/cli/dashboard/lib/proof-server-api.ts`:

```typescript
export interface ProofServerHealth {
  status: string;
  timestamp: string;
}

export interface ProofServerReady {
  status: 'ok' | 'busy';
  jobsProcessing: number;
  jobsPending: number;
  jobCapacity: number;
  timestamp: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export function fetchProofServerHealth(baseUrl: string): Promise<ProofServerHealth | null> {
  return fetchJson<ProofServerHealth>(`${baseUrl}/health`);
}

export async function fetchProofServerVersion(baseUrl: string): Promise<string | null> {
  return fetchText(`${baseUrl}/version`);
}

export async function fetchProofServerReady(baseUrl: string): Promise<ProofServerReady | null> {
  try {
    const response = await fetch(`${baseUrl}/ready`, { signal: AbortSignal.timeout(5000) });
    // /ready returns JSON even on 503
    return await response.json() as ProofServerReady;
  } catch {
    return null;
  }
}

export async function fetchProofVersions(baseUrl: string): Promise<string[] | null> {
  const text = await fetchText(`${baseUrl}/proof-versions`);
  if (!text) return null;
  try {
    return JSON.parse(text) as string[];
  } catch {
    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run src/cli/dashboard/lib/__tests__/proof-server-api.test.ts
```
Expected: All pass.

**Step 5: Commit**

```bash
git add src/cli/dashboard/lib/proof-server-api.ts src/cli/dashboard/lib/__tests__/proof-server-api.test.ts
git commit -m "feat(dashboard): add proof server REST API client"
```

---

## Task 5: Data Layer — Log Parser

**Files:**
- Create: `src/cli/dashboard/lib/log-parser.ts`
- Create: `src/cli/dashboard/lib/__tests__/log-parser.test.ts`

**Step 1: Write the failing tests**

Create `src/cli/dashboard/lib/__tests__/log-parser.test.ts`:

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/cli/dashboard/lib/__tests__/log-parser.test.ts
```
Expected: FAIL.

**Step 3: Write the implementation**

Create `src/cli/dashboard/lib/log-parser.ts`:

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run src/cli/dashboard/lib/__tests__/log-parser.test.ts
```
Expected: All pass.

**Step 5: Commit**

```bash
git add src/cli/dashboard/lib/log-parser.ts src/cli/dashboard/lib/__tests__/log-parser.test.ts
git commit -m "feat(dashboard): add docker compose log parser with filtering"
```

---

## Task 6: Hooks — useTerminalSize and useBreakpoint

**Files:**
- Create: `src/cli/dashboard/hooks/use-terminal-size.ts`
- Create: `src/cli/dashboard/hooks/use-breakpoint.ts`
- Create: `src/cli/dashboard/hooks/__tests__/use-breakpoint.test.ts`

**Step 1: Write the failing test for useBreakpoint**

Create `src/cli/dashboard/hooks/__tests__/use-breakpoint.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getBreakpoint, type Breakpoint } from '../use-breakpoint.js';

describe('getBreakpoint', () => {
  it('returns "small" for width < 40', () => {
    expect(getBreakpoint(39)).toBe('small');
    expect(getBreakpoint(20)).toBe('small');
  });

  it('returns "medium" for width 40-119', () => {
    expect(getBreakpoint(40)).toBe('medium');
    expect(getBreakpoint(80)).toBe('medium');
    expect(getBreakpoint(119)).toBe('medium');
  });

  it('returns "large" for width >= 120', () => {
    expect(getBreakpoint(120)).toBe('large');
    expect(getBreakpoint(200)).toBe('large');
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/cli/dashboard/hooks/__tests__/use-breakpoint.test.ts
```
Expected: FAIL.

**Step 3: Write useTerminalSize**

Create `src/cli/dashboard/hooks/use-terminal-size.ts`:

```typescript
import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
}

export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setSize({ columns: stdout.columns, rows: stdout.rows });
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}
```

**Step 4: Write useBreakpoint**

Create `src/cli/dashboard/hooks/use-breakpoint.ts`:

```typescript
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
```

**Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run src/cli/dashboard/hooks/__tests__/use-breakpoint.test.ts
```
Expected: All pass.

**Step 6: Commit**

```bash
git add src/cli/dashboard/hooks/
git commit -m "feat(dashboard): add useTerminalSize and useBreakpoint hooks"
```

---

## Task 7: Hooks — usePolling utility and useServices

**Files:**
- Create: `src/cli/dashboard/hooks/use-polling.ts`
- Create: `src/cli/dashboard/hooks/use-services.ts`
- Create: `src/cli/dashboard/hooks/__tests__/use-polling.test.ts`

**Step 1: Write the failing test for usePolling**

Create `src/cli/dashboard/hooks/__tests__/use-polling.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// usePolling is a React hook — test the polling logic function directly
import { createPoller } from '../use-polling.js';

describe('createPoller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls fetcher immediately', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 5000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith('data');

    stop();
  });

  it('calls fetcher at interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 1000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetcher).toHaveBeenCalledTimes(3);

    stop();
  });

  it('calls onError when fetcher throws', async () => {
    const error = new Error('fail');
    const fetcher = vi.fn().mockRejectedValue(error);
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 1000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onData).not.toHaveBeenCalled();

    stop();
  });

  it('stops polling when stop is called', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const onData = vi.fn();
    const onError = vi.fn();
    const stop = createPoller(fetcher, 1000, onData, onError);

    await vi.advanceTimersByTimeAsync(0);
    stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/cli/dashboard/hooks/__tests__/use-polling.test.ts
```
Expected: FAIL.

**Step 3: Write usePolling and createPoller**

Create `src/cli/dashboard/hooks/use-polling.ts`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';

export function createPoller<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  onData: (data: T) => void,
  onError: (error: unknown) => void,
): () => void {
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const data = await fetcher();
      if (!stopped) onData(data);
    } catch (err) {
      if (!stopped) onError(err);
    }
  };

  // Initial fetch
  void poll();

  const timer = setInterval(() => void poll(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export interface PollingState<T> {
  data: T | null;
  error: unknown | null;
  loading: boolean;
}

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): PollingState<T> {
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, loading: true });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const stop = createPoller(
      () => fetcherRef.current(),
      intervalMs,
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState((prev) => ({ ...prev, error, loading: false })),
    );
    return stop;
  }, [intervalMs]);

  return state;
}
```

**Step 4: Write useServices**

Create `src/cli/dashboard/hooks/use-services.ts`:

```typescript
import { usePolling, type PollingState } from './use-polling.js';
import { composePs } from '../../../core/docker.js';
import type { ServiceStatus } from '../../../core/types.js';

export function useServices(): PollingState<ServiceStatus[]> {
  return usePolling(() => composePs(), 5000);
}
```

Note: Fix the import paths once file structure is confirmed during implementation. The `../..` paths may need adjustment.

**Step 5: Run tests to verify they pass**

Run:
```bash
npx vitest run src/cli/dashboard/hooks/__tests__/use-polling.test.ts
```
Expected: All pass.

**Step 6: Commit**

```bash
git add src/cli/dashboard/hooks/
git commit -m "feat(dashboard): add usePolling utility and useServices hook"
```

---

## Task 8: Hooks — useNodeInfo, useProofServer, useHealth, useIndexerInfo

**Files:**
- Create: `src/cli/dashboard/hooks/use-node-info.ts`
- Create: `src/cli/dashboard/hooks/use-proof-server.ts`
- Create: `src/cli/dashboard/hooks/use-health.ts`
- Create: `src/cli/dashboard/hooks/use-indexer-info.ts`

These hooks all follow the same usePolling pattern. They compose the lib functions from Task 3-4 with usePolling from Task 7.

**Step 1: Write useNodeInfo**

Create `src/cli/dashboard/hooks/use-node-info.ts`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { usePolling } from './use-polling.js';
import {
  fetchSystemChain,
  fetchSystemName,
  fetchSystemVersion,
  fetchSystemHealth,
  fetchBestBlockHeader,
  type SystemHealth,
} from '../lib/substrate-rpc.js';

export interface NodeInfo {
  chainName: string | null;
  nodeName: string | null;
  version: string | null;
  health: SystemHealth | null;
  bestBlock: number | null;
  avgBlockTime: number | null;
}

async function fetchNodeInfo(nodeUrl: string): Promise<NodeInfo> {
  const [chainName, nodeName, version, health, header] = await Promise.all([
    fetchSystemChain(nodeUrl),
    fetchSystemName(nodeUrl),
    fetchSystemVersion(nodeUrl),
    fetchSystemHealth(nodeUrl),
    fetchBestBlockHeader(nodeUrl),
  ]);

  return {
    chainName,
    nodeName,
    version,
    health,
    bestBlock: header?.number ?? null,
    avgBlockTime: null, // Computed from history, see below
  };
}

export function useNodeInfo(nodeUrl: string) {
  const blockHistory = useRef<{ block: number; time: number }[]>([]);
  const polling = usePolling(() => fetchNodeInfo(nodeUrl), 5000);

  // Track block times for average calculation
  useEffect(() => {
    if (polling.data?.bestBlock != null) {
      const now = Date.now();
      const history = blockHistory.current;
      history.push({ block: polling.data.bestBlock, time: now });
      // Keep last 20 entries
      if (history.length > 20) history.shift();
    }
  }, [polling.data?.bestBlock]);

  const avgBlockTime = (() => {
    const history = blockHistory.current;
    if (history.length < 2) return null;
    const first = history[0];
    const last = history[history.length - 1];
    const blockDiff = last.block - first.block;
    if (blockDiff <= 0) return null;
    return (last.time - first.time) / blockDiff / 1000; // seconds
  })();

  return {
    ...polling,
    data: polling.data ? { ...polling.data, avgBlockTime } : null,
  };
}
```

**Step 2: Write useProofServer**

Create `src/cli/dashboard/hooks/use-proof-server.ts`:

```typescript
import { usePolling } from './use-polling.js';
import {
  fetchProofServerVersion,
  fetchProofServerReady,
  fetchProofVersions,
  type ProofServerReady,
} from '../lib/proof-server-api.js';

export interface ProofServerInfo {
  version: string | null;
  proofVersions: string[] | null;
  ready: ProofServerReady | null;
}

async function fetchAllProofServerInfo(baseUrl: string): Promise<ProofServerInfo> {
  const [version, ready, proofVersions] = await Promise.all([
    fetchProofServerVersion(baseUrl),
    fetchProofServerReady(baseUrl),
    fetchProofVersions(baseUrl),
  ]);
  return { version, ready, proofVersions };
}

export function useProofServer(proofServerUrl: string) {
  return usePolling(() => fetchAllProofServerInfo(proofServerUrl), 10000);
}
```

**Step 3: Write useHealth**

Create `src/cli/dashboard/hooks/use-health.ts`:

```typescript
import { useRef } from 'react';
import { usePolling } from './use-polling.js';
import { checkAllHealth, type HealthReport } from '../../../core/health.js';
import type { NetworkConfig } from '../../../core/types.js';

export interface HealthWithHistory {
  current: HealthReport;
  nodeHistory: number[];
  indexerHistory: number[];
  proofServerHistory: number[];
}

const MAX_HISTORY = 30;

export function useHealth(config: NetworkConfig) {
  const nodeHistory = useRef<number[]>([]);
  const indexerHistory = useRef<number[]>([]);
  const proofServerHistory = useRef<number[]>([]);

  const polling = usePolling(async (): Promise<HealthWithHistory> => {
    const report = await checkAllHealth(config);

    if (report.node.responseTime != null) {
      nodeHistory.current.push(report.node.responseTime);
      if (nodeHistory.current.length > MAX_HISTORY) nodeHistory.current.shift();
    }
    if (report.indexer.responseTime != null) {
      indexerHistory.current.push(report.indexer.responseTime);
      if (indexerHistory.current.length > MAX_HISTORY) indexerHistory.current.shift();
    }
    if (report.proofServer.responseTime != null) {
      proofServerHistory.current.push(report.proofServer.responseTime);
      if (proofServerHistory.current.length > MAX_HISTORY) proofServerHistory.current.shift();
    }

    return {
      current: report,
      nodeHistory: [...nodeHistory.current],
      indexerHistory: [...indexerHistory.current],
      proofServerHistory: [...proofServerHistory.current],
    };
  }, 10000);

  return polling;
}
```

**Step 4: Write useIndexerInfo**

Create `src/cli/dashboard/hooks/use-indexer-info.ts`:

```typescript
import { usePolling } from './use-polling.js';

export interface IndexerInfo {
  ready: boolean;
  responseTime: number | null;
}

async function fetchIndexerInfo(indexerUrl: string): Promise<IndexerInfo> {
  const origin = new URL(indexerUrl).origin;
  const start = Date.now();
  try {
    const response = await fetch(`${origin}/ready`, { signal: AbortSignal.timeout(5000) });
    return {
      ready: response.ok,
      responseTime: Date.now() - start,
    };
  } catch {
    return { ready: false, responseTime: Date.now() - start };
  }
}

export function useIndexerInfo(indexerUrl: string) {
  return usePolling(() => fetchIndexerInfo(indexerUrl), 10000);
}
```

**Step 5: Build to verify no type errors**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 6: Commit**

```bash
git add src/cli/dashboard/hooks/
git commit -m "feat(dashboard): add service-specific polling hooks"
```

---

## Task 9: Hooks — useWalletState and useLogs

**Files:**
- Create: `src/cli/dashboard/hooks/use-wallet-state.ts`
- Create: `src/cli/dashboard/hooks/use-logs.ts`

**Step 1: Write useWalletState**

Create `src/cli/dashboard/hooks/use-wallet-state.ts`:

```typescript
import { useState, useEffect } from 'react';
import type { NetworkManager } from '../../../core/network-manager.js';
import type { WalletBalances } from '../../../core/types.js';
import { getWalletBalances } from '../../../core/wallet.js';

export interface WalletState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  balances: WalletBalances | null;
  address: string | null;
}

export function useWalletState(manager: NetworkManager): WalletState {
  const [state, setState] = useState<WalletState>({
    connected: false,
    connecting: false,
    error: null,
    balances: null,
    address: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      if (manager.getStatus() !== 'running') {
        setState({ connected: false, connecting: false, error: 'Network not running', balances: null, address: null });
        return;
      }

      setState((prev) => ({ ...prev, connecting: true, error: null }));

      try {
        const wallet = await manager.ensureWallet();
        if (cancelled) return;

        const balances = await getWalletBalances(wallet);
        if (cancelled) return;

        setState({ connected: true, connecting: false, error: null, balances, address: 'master' });

        // Poll balances every 10s
        timer = setInterval(async () => {
          if (cancelled) return;
          try {
            const b = await getWalletBalances(wallet);
            if (!cancelled) {
              setState((prev) => ({ ...prev, balances: b }));
            }
          } catch {
            // Ignore polling errors
          }
        }, 10000);
      } catch (err) {
        if (!cancelled) {
          setState({
            connected: false,
            connecting: false,
            error: err instanceof Error ? err.message : 'Wallet connection failed',
            balances: null,
            address: null,
          });
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [manager, manager.getStatus()]);

  return state;
}
```

**Step 2: Write useLogs**

Create `src/cli/dashboard/hooks/use-logs.ts`:

```typescript
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
```

**Step 3: Build to verify no type errors**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 4: Commit**

```bash
git add src/cli/dashboard/hooks/
git commit -m "feat(dashboard): add useWalletState and useLogs hooks"
```

---

## Task 10: UI Components — PanelBox, StatusBadge, Gauge, Sparkline

**Files:**
- Create: `src/cli/dashboard/components/panel-box.tsx`
- Create: `src/cli/dashboard/components/status-badge.tsx`
- Create: `src/cli/dashboard/components/gauge.tsx`
- Create: `src/cli/dashboard/components/sparkline.tsx`
- Create: `src/cli/dashboard/components/__tests__/sparkline.test.ts`

**Step 1: Write the failing test for sparkline**

Create `src/cli/dashboard/components/__tests__/sparkline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderSparkline } from '../sparkline.js';

describe('renderSparkline', () => {
  it('renders empty string for empty data', () => {
    expect(renderSparkline([])).toBe('');
  });

  it('renders single value', () => {
    expect(renderSparkline([5])).toBe('▄');
  });

  it('renders values normalized to 8 levels', () => {
    const result = renderSparkline([0, 25, 50, 75, 100]);
    expect(result).toHaveLength(5);
    // First char should be lowest, last should be highest
    expect(result[0]).toBe('▁');
    expect(result[4]).toBe('█');
  });

  it('handles all same values', () => {
    const result = renderSparkline([50, 50, 50]);
    // All same = all middle
    expect(result).toHaveLength(3);
  });

  it('respects maxWidth', () => {
    const data = Array.from({ length: 50 }, (_, i) => i);
    const result = renderSparkline(data, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run src/cli/dashboard/components/__tests__/sparkline.test.ts
```
Expected: FAIL.

**Step 3: Write sparkline**

Create `src/cli/dashboard/components/sparkline.tsx`:

```typescript
import React from 'react';
import { Text } from 'ink';

const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

export function renderSparkline(data: number[], maxWidth?: number): string {
  if (data.length === 0) return '';

  const values = maxWidth && data.length > maxWidth ? data.slice(-maxWidth) : data;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (BARS.length - 1));
      return BARS[idx];
    })
    .join('');
}

interface SparklineProps {
  data: number[];
  maxWidth?: number;
  color?: string;
}

export function Sparkline({ data, maxWidth, color }: SparklineProps): React.ReactElement {
  return <Text color={color}>{renderSparkline(data, maxWidth)}</Text>;
}
```

**Step 4: Write PanelBox**

Create `src/cli/dashboard/components/panel-box.tsx`:

```typescript
import React from 'react';
import { Box, Text } from 'ink';

interface PanelBoxProps {
  title: string;
  focused?: boolean;
  width?: number | string;
  height?: number;
  children: React.ReactNode;
}

export function PanelBox({ title, focused, width, height, children }: PanelBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle={focused ? 'bold' : 'single'}
      borderColor={focused ? 'cyan' : 'gray'}
      width={width}
      height={height}
      paddingX={1}
    >
      <Text bold color={focused ? 'cyan' : 'white'}>
        {title}
      </Text>
      {children}
    </Box>
  );
}
```

**Step 5: Write StatusBadge**

Create `src/cli/dashboard/components/status-badge.tsx`:

```typescript
import React from 'react';
import { Text } from 'ink';

interface StatusBadgeProps {
  status: 'healthy' | 'unhealthy' | 'unknown' | 'running' | 'stopped' | 'busy' | 'ok';
}

const STATUS_COLORS: Record<StatusBadgeProps['status'], string> = {
  healthy: 'green',
  running: 'green',
  ok: 'green',
  busy: 'yellow',
  unknown: 'gray',
  unhealthy: 'red',
  stopped: 'red',
};

const STATUS_SYMBOLS: Record<StatusBadgeProps['status'], string> = {
  healthy: '●',
  running: '●',
  ok: '●',
  busy: '◐',
  unknown: '○',
  unhealthy: '●',
  stopped: '●',
};

export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  return (
    <Text color={STATUS_COLORS[status]}>
      {STATUS_SYMBOLS[status]} {status}
    </Text>
  );
}
```

**Step 6: Write Gauge**

Create `src/cli/dashboard/components/gauge.tsx`:

```typescript
import React from 'react';
import { Text } from 'ink';

interface GaugeProps {
  value: number;
  max: number;
  width?: number;
  label?: string;
}

export function Gauge({ value, max, width = 10, label }: GaugeProps): React.ReactElement {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const empty = width - filled;
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;

  const color = percentage >= 90 ? 'red' : percentage >= 70 ? 'yellow' : 'green';

  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text> {value}/{max}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}
```

**Step 7: Run sparkline tests**

Run:
```bash
npx vitest run src/cli/dashboard/components/__tests__/sparkline.test.ts
```
Expected: All pass.

**Step 8: Build to verify no type errors**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 9: Commit**

```bash
git add src/cli/dashboard/components/
git commit -m "feat(dashboard): add reusable UI components (PanelBox, StatusBadge, Gauge, Sparkline)"
```

---

## Task 11: Panels — NodePanel, IndexerPanel, ProofPanel

**Files:**
- Create: `src/cli/dashboard/panels/node-panel.tsx`
- Create: `src/cli/dashboard/panels/indexer-panel.tsx`
- Create: `src/cli/dashboard/panels/proof-panel.tsx`
- Create: `src/cli/dashboard/panels/response-graph.tsx`

**Step 1: Write NodePanel**

Create `src/cli/dashboard/panels/node-panel.tsx`:

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { StatusBadge } from '../components/status-badge.js';
import type { NodeInfo } from '../hooks/use-node-info.js';

interface NodePanelProps {
  data: NodeInfo | null;
  loading: boolean;
  focused?: boolean;
  compact?: boolean;
}

export function NodePanel({ data, loading, focused, compact }: NodePanelProps): React.ReactElement {
  if (loading && !data) {
    return (
      <PanelBox title="Node" focused={focused}>
        <Text color="gray">Connecting...</Text>
      </PanelBox>
    );
  }

  if (!data || data.bestBlock === null) {
    return (
      <PanelBox title="Node" focused={focused}>
        <StatusBadge status="stopped" />
        <Text color="gray"> Offline</Text>
      </PanelBox>
    );
  }

  if (compact) {
    return (
      <Text>
        <StatusBadge status={data.health ? 'running' : 'stopped'} />
        <Text> node :9944 </Text>
        <Text color="cyan">▲ #{data.bestBlock}</Text>
      </Text>
    );
  }

  return (
    <PanelBox title="Node" focused={focused}>
      <Text>Block: <Text color="cyan">#{data.bestBlock}</Text></Text>
      {data.avgBlockTime != null && (
        <Text>Avg time: <Text color="yellow">{data.avgBlockTime.toFixed(1)}s</Text></Text>
      )}
      <Text>Chain: {data.chainName ?? 'unknown'}</Text>
      <Text>Peers: {data.health?.peers ?? 'N/A'}</Text>
      <Text>Sync: {data.health?.isSyncing ? 'syncing' : 'idle'}</Text>
      <Text>Version: {data.version ?? 'unknown'}</Text>
    </PanelBox>
  );
}
```

**Step 2: Write IndexerPanel**

Create `src/cli/dashboard/panels/indexer-panel.tsx`:

```tsx
import React from 'react';
import { Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { StatusBadge } from '../components/status-badge.js';
import type { IndexerInfo } from '../hooks/use-indexer-info.js';

interface IndexerPanelProps {
  data: IndexerInfo | null;
  nodeBlock: number | null;
  loading: boolean;
  focused?: boolean;
  compact?: boolean;
}

export function IndexerPanel({ data, nodeBlock, loading, focused, compact }: IndexerPanelProps): React.ReactElement {
  if (loading && !data) {
    return (
      <PanelBox title="Indexer" focused={focused}>
        <Text color="gray">Connecting...</Text>
      </PanelBox>
    );
  }

  if (!data) {
    return (
      <PanelBox title="Indexer" focused={focused}>
        <StatusBadge status="stopped" />
        <Text color="gray"> Offline</Text>
      </PanelBox>
    );
  }

  if (compact) {
    return (
      <Text>
        <StatusBadge status={data.ready ? 'running' : 'stopped'} />
        <Text> indexer :8088</Text>
      </Text>
    );
  }

  return (
    <PanelBox title="Indexer" focused={focused}>
      <Text>Status: <StatusBadge status={data.ready ? 'ok' : 'unhealthy'} /></Text>
      {data.responseTime != null && (
        <Text>Response: <Text color="yellow">{data.responseTime}ms</Text></Text>
      )}
    </PanelBox>
  );
}
```

**Step 3: Write ProofPanel**

Create `src/cli/dashboard/panels/proof-panel.tsx`:

```tsx
import React from 'react';
import { Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { StatusBadge } from '../components/status-badge.js';
import { Gauge } from '../components/gauge.js';
import type { ProofServerInfo } from '../hooks/use-proof-server.js';

interface ProofPanelProps {
  data: ProofServerInfo | null;
  loading: boolean;
  focused?: boolean;
  compact?: boolean;
}

export function ProofPanel({ data, loading, focused, compact }: ProofPanelProps): React.ReactElement {
  if (loading && !data) {
    return (
      <PanelBox title="Proof Server" focused={focused}>
        <Text color="gray">Connecting...</Text>
      </PanelBox>
    );
  }

  if (!data) {
    return (
      <PanelBox title="Proof Server" focused={focused}>
        <StatusBadge status="stopped" />
        <Text color="gray"> Offline</Text>
      </PanelBox>
    );
  }

  if (compact) {
    const processing = data.ready?.jobsProcessing ?? 0;
    const capacity = data.ready?.jobCapacity ?? 0;
    return (
      <Text>
        <StatusBadge status={data.ready ? (data.ready.status === 'ok' ? 'running' : 'busy') : 'stopped'} />
        <Text> proof :6300 </Text>
        <Text color="cyan">▲ {processing}/{capacity}</Text>
      </Text>
    );
  }

  return (
    <PanelBox title="Proof Server" focused={focused}>
      <Text>Version: {data.version ?? 'unknown'}</Text>
      <Text>Proofs: {data.proofVersions?.join(', ') ?? 'unknown'}</Text>
      {data.ready && (
        <>
          <Text>Status: <StatusBadge status={data.ready.status === 'ok' ? 'ok' : 'busy'} /></Text>
          <Text>Jobs: <Gauge value={data.ready.jobsProcessing} max={data.ready.jobCapacity} width={8} /></Text>
          <Text>Pending: {data.ready.jobsPending}</Text>
        </>
      )}
    </PanelBox>
  );
}
```

**Step 4: Write ResponseGraph**

Create `src/cli/dashboard/panels/response-graph.tsx`:

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import { Sparkline } from '../components/sparkline.js';

interface ResponseGraphProps {
  nodeHistory: number[];
  indexerHistory: number[];
  proofServerHistory: number[];
  focused?: boolean;
  width?: number;
}

export function ResponseGraph({
  nodeHistory,
  indexerHistory,
  proofServerHistory,
  focused,
  width,
}: ResponseGraphProps): React.ReactElement {
  const sparkWidth = width ? Math.max(5, width - 20) : 20;
  const lastNode = nodeHistory[nodeHistory.length - 1];
  const lastIndexer = indexerHistory[indexerHistory.length - 1];
  const lastProof = proofServerHistory[proofServerHistory.length - 1];

  return (
    <PanelBox title="Response Times" focused={focused}>
      <Box>
        <Text>node  </Text>
        <Sparkline data={nodeHistory} maxWidth={sparkWidth} color="green" />
        <Text> {lastNode != null ? `${lastNode}ms` : 'N/A'}</Text>
      </Box>
      <Box>
        <Text>idx   </Text>
        <Sparkline data={indexerHistory} maxWidth={sparkWidth} color="blue" />
        <Text> {lastIndexer != null ? `${lastIndexer}ms` : 'N/A'}</Text>
      </Box>
      <Box>
        <Text>proof </Text>
        <Sparkline data={proofServerHistory} maxWidth={sparkWidth} color="yellow" />
        <Text> {lastProof != null ? `${lastProof}ms` : 'N/A'}</Text>
      </Box>
    </PanelBox>
  );
}
```

**Step 5: Build to verify no type errors**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 6: Commit**

```bash
git add src/cli/dashboard/panels/
git commit -m "feat(dashboard): add service detail panels (Node, Indexer, ProofServer, ResponseGraph)"
```

---

## Task 12: Panels — WalletPanel and LogPanel

**Files:**
- Create: `src/cli/dashboard/panels/wallet-panel.tsx`
- Create: `src/cli/dashboard/panels/log-panel.tsx`

**Step 1: Write WalletPanel**

Create `src/cli/dashboard/panels/wallet-panel.tsx`:

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { PanelBox } from '../components/panel-box.js';
import type { WalletState } from '../hooks/use-wallet-state.js';

interface WalletPanelProps {
  wallet: WalletState;
  focused?: boolean;
  compact?: boolean;
}

function formatBalance(value: bigint): string {
  const whole = value / 10n ** 6n;
  return whole.toLocaleString();
}

export function WalletPanel({ wallet, focused, compact }: WalletPanelProps): React.ReactElement {
  if (wallet.connecting) {
    return (
      <PanelBox title="Wallet" focused={focused}>
        <Text color="yellow">Connecting...</Text>
      </PanelBox>
    );
  }

  if (wallet.error) {
    return (
      <PanelBox title="Wallet" focused={focused}>
        <Text color="red">Unavailable</Text>
        <Text color="gray">{wallet.error}</Text>
      </PanelBox>
    );
  }

  if (!wallet.balances) {
    return (
      <PanelBox title="Wallet" focused={focused}>
        <Text color="gray">No data</Text>
      </PanelBox>
    );
  }

  const b = wallet.balances;

  if (compact) {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">{`Wallet (${wallet.address ?? 'master'})`}</Text>
        <Text>NIGHT {formatBalance(b.total)}</Text>
        <Text>DUST  {formatBalance(b.dust)}</Text>
      </Box>
    );
  }

  return (
    <PanelBox title="Wallet" focused={focused}>
      <Text color="cyan" bold>{`> ${wallet.address ?? 'master'}`}</Text>
      <Text>  NIGHT  <Text color="green">{formatBalance(b.unshielded)}</Text> (unshielded)</Text>
      <Text>  NIGHT  <Text color="green">{formatBalance(b.shielded)}</Text> (shielded)</Text>
      <Text>  DUST   <Text color="yellow">{formatBalance(b.dust)}</Text></Text>
      <Text>  Total  <Text bold>{formatBalance(b.total)}</Text></Text>
    </PanelBox>
  );
}
```

**Step 2: Write LogPanel**

Create `src/cli/dashboard/panels/log-panel.tsx`:

```tsx
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
          <Box key={i}>
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
          {lines.length} lines | s=service l=level /=search | ↑↓ scroll
        </Text>
      </Box>
    </PanelBox>
  );
}
```

**Step 3: Build to verify no type errors**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 4: Commit**

```bash
git add src/cli/dashboard/panels/
git commit -m "feat(dashboard): add WalletPanel and LogPanel"
```

---

## Task 13: Layouts — Small, Medium, Large

**Files:**
- Create: `src/cli/dashboard/layouts/small.tsx`
- Create: `src/cli/dashboard/layouts/medium.tsx`
- Create: `src/cli/dashboard/layouts/large.tsx`

**Step 1: Write SmallLayout**

Create `src/cli/dashboard/layouts/small.tsx`:

```tsx
import React from 'react';
import { Box } from 'ink';
import { NodePanel } from '../panels/node-panel.js';
import { IndexerPanel } from '../panels/indexer-panel.js';
import { ProofPanel } from '../panels/proof-panel.js';
import { WalletPanel } from '../panels/wallet-panel.js';
import { LogPanel } from '../panels/log-panel.js';
import type { DashboardData } from '../app.js';

interface SmallLayoutProps {
  data: DashboardData;
}

export function SmallLayout({ data }: SmallLayoutProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <NodePanel data={data.node} loading={data.nodeLoading} compact />
      <IndexerPanel data={data.indexer} nodeBlock={data.node?.bestBlock ?? null} loading={data.indexerLoading} compact />
      <ProofPanel data={data.proofServer} loading={data.proofServerLoading} compact />
      <WalletPanel wallet={data.wallet} compact />
      <LogPanel
        lines={data.logs.lines}
        filter={data.logs.filter}
        scrollOffset={data.logs.scrollOffset}
        maxLines={data.rows - 10}
        focused={data.focusedPanel === 'logs'}
        searchMode={data.searchMode}
        searchText={data.searchText}
      />
    </Box>
  );
}
```

**Step 2: Write MediumLayout**

Create `src/cli/dashboard/layouts/medium.tsx`:

```tsx
import React from 'react';
import { Box } from 'ink';
import { NodePanel } from '../panels/node-panel.js';
import { IndexerPanel } from '../panels/indexer-panel.js';
import { ProofPanel } from '../panels/proof-panel.js';
import { WalletPanel } from '../panels/wallet-panel.js';
import { LogPanel } from '../panels/log-panel.js';
import type { DashboardData } from '../app.js';

interface MediumLayoutProps {
  data: DashboardData;
}

export function MediumLayout({ data }: MediumLayoutProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width="50%">
          <NodePanel data={data.node} loading={data.nodeLoading} focused={data.focusedPanel === 'node'} />
        </Box>
        <Box width="50%">
          <ProofPanel data={data.proofServer} loading={data.proofServerLoading} focused={data.focusedPanel === 'proof'} />
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width="50%">
          <IndexerPanel data={data.indexer} nodeBlock={data.node?.bestBlock ?? null} loading={data.indexerLoading} focused={data.focusedPanel === 'indexer'} />
        </Box>
        <Box width="50%">
          <WalletPanel wallet={data.wallet} focused={data.focusedPanel === 'wallet'} />
        </Box>
      </Box>
      <LogPanel
        lines={data.logs.lines}
        filter={data.logs.filter}
        scrollOffset={data.logs.scrollOffset}
        maxLines={Math.max(5, data.rows - 16)}
        focused={data.focusedPanel === 'logs'}
        searchMode={data.searchMode}
        searchText={data.searchText}
      />
    </Box>
  );
}
```

**Step 3: Write LargeLayout**

Create `src/cli/dashboard/layouts/large.tsx`:

```tsx
import React from 'react';
import { Box } from 'ink';
import { NodePanel } from '../panels/node-panel.js';
import { IndexerPanel } from '../panels/indexer-panel.js';
import { ProofPanel } from '../panels/proof-panel.js';
import { WalletPanel } from '../panels/wallet-panel.js';
import { LogPanel } from '../panels/log-panel.js';
import { ResponseGraph } from '../panels/response-graph.js';
import type { DashboardData } from '../app.js';

interface LargeLayoutProps {
  data: DashboardData;
}

export function LargeLayout({ data }: LargeLayoutProps): React.ReactElement {
  const halfWidth = Math.floor(data.columns / 2);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width="25%">
          <NodePanel data={data.node} loading={data.nodeLoading} focused={data.focusedPanel === 'node'} />
        </Box>
        <Box width="25%">
          <IndexerPanel data={data.indexer} nodeBlock={data.node?.bestBlock ?? null} loading={data.indexerLoading} focused={data.focusedPanel === 'indexer'} />
        </Box>
        <Box width="25%">
          <ProofPanel data={data.proofServer} loading={data.proofServerLoading} focused={data.focusedPanel === 'proof'} />
        </Box>
        <Box width="25%">
          <WalletPanel wallet={data.wallet} focused={data.focusedPanel === 'wallet'} />
        </Box>
      </Box>
      <Box flexDirection="row">
        <Box width="50%">
          <ResponseGraph
            nodeHistory={data.healthHistory.nodeHistory}
            indexerHistory={data.healthHistory.indexerHistory}
            proofServerHistory={data.healthHistory.proofServerHistory}
            focused={data.focusedPanel === 'graph'}
            width={halfWidth - 4}
          />
        </Box>
        <Box width="50%">
          <LogPanel
            lines={data.logs.lines}
            filter={data.logs.filter}
            scrollOffset={data.logs.scrollOffset}
            maxLines={Math.max(5, data.rows - 12)}
            focused={data.focusedPanel === 'logs'}
            searchMode={data.searchMode}
            searchText={data.searchText}
          />
        </Box>
      </Box>
    </Box>
  );
}
```

**Step 4: Build to verify no type errors**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 5: Commit**

```bash
git add src/cli/dashboard/layouts/
git commit -m "feat(dashboard): add responsive layouts (small, medium, large)"
```

---

## Task 14: Root App Component and Dashboard Command Registration

**Files:**
- Create: `src/cli/dashboard/app.tsx`
- Create: `src/cli/commands/dashboard.ts`
- Modify: `src/cli.ts`

**Step 1: Write the root App component**

Create `src/cli/dashboard/app.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useBreakpoint, type Breakpoint } from './hooks/use-breakpoint.js';
import { useNodeInfo, type NodeInfo } from './hooks/use-node-info.js';
import { useProofServer, type ProofServerInfo } from './hooks/use-proof-server.js';
import { useHealth, type HealthWithHistory } from './hooks/use-health.js';
import { useIndexerInfo, type IndexerInfo } from './hooks/use-indexer-info.js';
import { useWalletState, type WalletState } from './hooks/use-wallet-state.js';
import { useLogs } from './hooks/use-logs.js';
import type { NetworkManager } from '../../core/network-manager.js';
import type { NetworkConfig } from '../../core/types.js';
import type { LogFilter, ParsedLogLine } from './lib/log-parser.js';
import { SmallLayout } from './layouts/small.js';
import { MediumLayout } from './layouts/medium.js';
import { LargeLayout } from './layouts/large.js';

export type PanelName = 'node' | 'indexer' | 'proof' | 'wallet' | 'logs' | 'graph';

export interface DashboardData {
  node: NodeInfo | null;
  nodeLoading: boolean;
  indexer: IndexerInfo | null;
  indexerLoading: boolean;
  proofServer: ProofServerInfo | null;
  proofServerLoading: boolean;
  wallet: WalletState;
  logs: {
    lines: ParsedLogLine[];
    filter: LogFilter;
    scrollOffset: number;
    cycleService: () => void;
    cycleLevel: () => void;
    setSearch: (s: string) => void;
    scrollUp: () => void;
    scrollDown: () => void;
  };
  healthHistory: {
    nodeHistory: number[];
    indexerHistory: number[];
    proofServerHistory: number[];
  };
  focusedPanel: PanelName;
  searchMode: boolean;
  searchText: string;
  columns: number;
  rows: number;
}

const PANEL_CYCLE: PanelName[] = ['node', 'indexer', 'proof', 'wallet', 'logs', 'graph'];

interface AppProps {
  manager: NetworkManager;
  config: NetworkConfig;
}

export function App({ manager, config }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { breakpoint, columns, rows } = useBreakpoint();

  // Data hooks
  const nodeInfo = useNodeInfo(config.node);
  const proofServer = useProofServer(config.proofServer);
  const health = useHealth(config);
  const indexerInfo = useIndexerInfo(config.indexer);
  const walletState = useWalletState(manager);
  const logs = useLogs();

  // UI state
  const [focusedPanel, setFocusedPanel] = useState<PanelName>('node');
  const [searchMode, setSearchMode] = useState(false);
  const [searchText, setSearchText] = useState('');

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape || key.return) {
        setSearchMode(false);
        if (key.return) logs.setSearch(searchText);
        if (key.escape) {
          setSearchText('');
          logs.setSearch('');
        }
        return;
      }
      if (key.backspace || key.delete) {
        setSearchText((prev) => prev.slice(0, -1));
        return;
      }
      setSearchText((prev) => prev + input);
      return;
    }

    if (input === 'q') {
      exit();
      return;
    }

    if (key.tab) {
      setFocusedPanel((prev) => {
        const idx = PANEL_CYCLE.indexOf(prev);
        return PANEL_CYCLE[(idx + 1) % PANEL_CYCLE.length];
      });
      return;
    }

    if (input === 's') {
      logs.cycleService();
      return;
    }

    if (input === 'l') {
      logs.cycleLevel();
      return;
    }

    if (input === '/') {
      setSearchMode(true);
      setSearchText('');
      return;
    }

    if (key.upArrow) {
      if (focusedPanel === 'logs') logs.scrollUp();
      return;
    }

    if (key.downArrow) {
      if (focusedPanel === 'logs') logs.scrollDown();
      return;
    }
  });

  const data: DashboardData = {
    node: nodeInfo.data,
    nodeLoading: nodeInfo.loading,
    indexer: indexerInfo.data,
    indexerLoading: indexerInfo.loading,
    proofServer: proofServer.data,
    proofServerLoading: proofServer.loading,
    wallet: walletState,
    logs,
    healthHistory: {
      nodeHistory: health.data?.nodeHistory ?? [],
      indexerHistory: health.data?.indexerHistory ?? [],
      proofServerHistory: health.data?.proofServerHistory ?? [],
    },
    focusedPanel,
    searchMode,
    searchText,
    columns,
    rows,
  };

  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color="cyan">Midnight Local Devnet</Text>
        <Text color="gray">
          {columns}x{rows} | {breakpoint} | Tab=focus q=quit s=svc l=lvl /=search
        </Text>
      </Box>
      {breakpoint === 'small' && <SmallLayout data={data} />}
      {breakpoint === 'medium' && <MediumLayout data={data} />}
      {breakpoint === 'large' && <LargeLayout data={data} />}
    </Box>
  );
}
```

**Step 2: Write the dashboard command registration**

Create `src/cli/commands/dashboard.ts`:

```typescript
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';

export function registerDashboardCommand(program: Command, manager: NetworkManager): void {
  program
    .command('dashboard')
    .description('Open realtime terminal dashboard for the local devnet')
    .action(async () => {
      // Dynamic import to avoid loading React/ink for non-dashboard commands
      const { render } = await import('ink');
      const React = await import('react');
      const { App } = await import('../dashboard/app.js');

      const { waitUntilExit } = render(
        React.createElement(App, { manager, config: manager.config }),
      );

      await waitUntilExit();
      await manager.shutdown();
    });
}
```

**Step 3: Register dashboard command in cli.ts**

Add import and registration to `src/cli.ts`. Add after the interactive command import:

```typescript
import { registerDashboardCommand } from './cli/commands/dashboard.js';
```

And add before `program.parse()`:

```typescript
registerDashboardCommand(program, manager);
```

**Step 4: Build**

Run:
```bash
npm run build
```
Expected: Compiles without errors.

**Step 5: Verify help shows dashboard command**

Run:
```bash
node dist/cli.js --help
```
Expected: Shows `dashboard` in command list.

**Step 6: Commit**

```bash
git add src/cli/dashboard/app.tsx src/cli/commands/dashboard.ts src/cli.ts
git commit -m "feat(dashboard): add root App component and CLI command registration"
```

---

## Task 15: Fix Import Paths and Build Verification

At this point all files are written. This task fixes any import path issues that arise from the directory structure.

**Step 1: Verify all imports resolve correctly**

Run:
```bash
npm run build 2>&1
```

If there are import errors, fix them. Common issues:
- Relative paths from `src/cli/dashboard/hooks/` to `src/core/` need `../../../core/`
- The `.js` extension is required for all imports (ESM with Node16 resolution)

**Step 2: Run all tests**

Run:
```bash
npm test
```
Expected: All existing tests + new tests pass.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(dashboard): resolve import paths and build issues"
```

---

## Task 16: Smoke Test the Dashboard

**Step 1: Build the project**

Run:
```bash
npm run build
```

**Step 2: Run the dashboard (without Docker running)**

Run:
```bash
node dist/cli.js dashboard
```
Expected: Dashboard launches, shows "Offline" / "Connecting..." states for all panels. Press `q` to exit cleanly.

**Step 3: Verify help output**

Run:
```bash
node dist/cli.js --help
```
Expected: Shows all commands including `dashboard` and `interactive`.

**Step 4: Verify no-subcommand shows help**

Run:
```bash
node dist/cli.js
```
Expected: Shows help output (not interactive mode).

**Step 5: Fix any runtime issues found during smoke testing**

Address any issues and commit fixes.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(dashboard): complete dashboard implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Dependencies + TSX config | package.json, tsconfig.json |
| 2 | CLI refactor: interactive as command | cli.ts, commands/interactive.ts |
| 3 | Substrate JSON-RPC client | lib/substrate-rpc.ts + tests |
| 4 | Proof server API client | lib/proof-server-api.ts + tests |
| 5 | Log parser | lib/log-parser.ts + tests |
| 6 | useTerminalSize + useBreakpoint | hooks/ + tests |
| 7 | usePolling + useServices | hooks/ + tests |
| 8 | useNodeInfo, useProofServer, useHealth, useIndexerInfo | hooks/ |
| 9 | useWalletState + useLogs | hooks/ |
| 10 | UI components (PanelBox, StatusBadge, Gauge, Sparkline) | components/ + tests |
| 11 | Service panels (Node, Indexer, Proof, ResponseGraph) | panels/ |
| 12 | WalletPanel + LogPanel | panels/ |
| 13 | Responsive layouts (small, medium, large) | layouts/ |
| 14 | Root App + dashboard command | app.tsx, commands/dashboard.ts, cli.ts |
| 15 | Import path fixes + build verification | various |
| 16 | Smoke test | none (testing only) |
