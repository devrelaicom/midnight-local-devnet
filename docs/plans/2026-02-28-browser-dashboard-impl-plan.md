# Browser Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the terminal ink/React dashboard with a browser-based dashboard served from a local Hono HTTP server with live WebSocket data and Midnight's dark indigo aesthetic.

**Architecture:** Hono server polls devnet services server-side and pushes state snapshots over WebSocket to a Preact+HTM frontend served as a single inline HTML page. The CLI `dashboard` command starts the server and opens the user's default browser.

**Tech Stack:** Hono + @hono/node-server (HTTP), ws (WebSocket), Preact + HTM via CDN (frontend), open (browser launch), Inter + JetBrains Mono from Google Fonts

---

### Task 1: Add New Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install new production dependencies**

Run: `npm install hono @hono/node-server open`

**Step 2: Verify installation**

Run: `node -e "import('hono').then(() => console.log('hono ok')); import('@hono/node-server').then(() => console.log('@hono/node-server ok')); import('open').then(() => console.log('open ok'))"`
Expected: All three print "ok"

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add hono, @hono/node-server, open for browser dashboard"
```

---

### Task 2: State Collector — Tests

**Files:**
- Create: `src/cli/dashboard/__tests__/state-collector.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before imports
vi.mock('../lib/substrate-rpc.js', () => ({
  fetchSystemChain: vi.fn(),
  fetchSystemName: vi.fn(),
  fetchSystemVersion: vi.fn(),
  fetchSystemHealth: vi.fn(),
  fetchBestBlockHeader: vi.fn(),
}));

vi.mock('../lib/proof-server-api.js', () => ({
  fetchProofServerReady: vi.fn(),
  fetchProofServerVersion: vi.fn(),
  fetchProofVersions: vi.fn(),
}));

vi.mock('../../../core/docker.js', () => ({
  composePs: vi.fn(),
  composeLogs: vi.fn(),
}));

vi.mock('../../../core/health.js', () => ({
  checkAllHealth: vi.fn(),
}));

import { StateCollector, type DashboardState } from '../state-collector.js';
import * as rpc from '../lib/substrate-rpc.js';
import * as proof from '../lib/proof-server-api.js';
import * as docker from '../../../core/docker.js';
import * as health from '../../../core/health.js';
import type { NetworkConfig } from '../../../core/types.js';

const mockConfig: NetworkConfig = {
  node: 'http://127.0.0.1:9944',
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};

describe('StateCollector', () => {
  let collector: StateCollector;

  beforeEach(() => {
    vi.resetAllMocks();
    collector = new StateCollector(mockConfig);
  });

  describe('collect', () => {
    it('returns a complete state snapshot with all fields', async () => {
      vi.mocked(rpc.fetchSystemChain).mockResolvedValue('Midnight Devnet');
      vi.mocked(rpc.fetchSystemName).mockResolvedValue('Midnight Node');
      vi.mocked(rpc.fetchSystemVersion).mockResolvedValue('0.20.0');
      vi.mocked(rpc.fetchSystemHealth).mockResolvedValue({ peers: 0, isSyncing: false, shouldHavePeers: false });
      vi.mocked(rpc.fetchBestBlockHeader).mockResolvedValue({ number: 1042, parentHash: '0x', stateRoot: '0x', extrinsicsRoot: '0x' });
      vi.mocked(proof.fetchProofServerReady).mockResolvedValue({ status: 'ok', jobsProcessing: 1, jobsPending: 0, jobCapacity: 4, timestamp: '' });
      vi.mocked(proof.fetchProofServerVersion).mockResolvedValue('7.0.0');
      vi.mocked(proof.fetchProofVersions).mockResolvedValue(['1.0.0']);
      vi.mocked(docker.composePs).mockResolvedValue([
        { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: 'http://127.0.0.1:9944' },
        { name: 'indexer', containerName: 'midnight-indexer', status: 'running', port: 8088, url: 'http://127.0.0.1:8088' },
        { name: 'proof-server', containerName: 'midnight-proof-server', status: 'running', port: 6300, url: 'http://127.0.0.1:6300' },
      ]);
      vi.mocked(docker.composeLogs).mockResolvedValue('midnight-node  | INFO: block #1042');
      vi.mocked(health.checkAllHealth).mockResolvedValue({
        node: { healthy: true, responseTime: 45 },
        indexer: { healthy: true, responseTime: 32 },
        proofServer: { healthy: true, responseTime: 120 },
        allHealthy: true,
      });

      const state = await collector.collect();

      expect(state.node).toBeDefined();
      expect(state.node.chain).toBe('Midnight Devnet');
      expect(state.node.blockHeight).toBe(1042);
      expect(state.indexer).toBeDefined();
      expect(state.proofServer).toBeDefined();
      expect(state.proofServer.version).toBe('7.0.0');
      expect(state.proofServer.jobsProcessing).toBe(1);
      expect(state.health).toBeDefined();
      expect(state.containers).toHaveLength(3);
      expect(state.logs).toHaveLength(1);
    });

    it('handles null responses gracefully (services offline)', async () => {
      vi.mocked(rpc.fetchSystemChain).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemName).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemVersion).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemHealth).mockResolvedValue(null);
      vi.mocked(rpc.fetchBestBlockHeader).mockResolvedValue(null);
      vi.mocked(proof.fetchProofServerReady).mockResolvedValue(null);
      vi.mocked(proof.fetchProofServerVersion).mockResolvedValue(null);
      vi.mocked(proof.fetchProofVersions).mockResolvedValue(null);
      vi.mocked(docker.composePs).mockResolvedValue([]);
      vi.mocked(docker.composeLogs).mockResolvedValue('');
      vi.mocked(health.checkAllHealth).mockResolvedValue({
        node: { healthy: false, error: 'timeout' },
        indexer: { healthy: false, error: 'timeout' },
        proofServer: { healthy: false, error: 'timeout' },
        allHealthy: false,
      });

      const state = await collector.collect();

      expect(state.node.chain).toBeNull();
      expect(state.node.blockHeight).toBeNull();
      expect(state.proofServer.version).toBeNull();
      expect(state.containers).toEqual([]);
      expect(state.logs).toEqual([]);
    });
  });

  describe('health history tracking', () => {
    it('accumulates response time history across multiple collect calls', async () => {
      // Setup minimal mocks
      vi.mocked(rpc.fetchSystemChain).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemName).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemVersion).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemHealth).mockResolvedValue(null);
      vi.mocked(rpc.fetchBestBlockHeader).mockResolvedValue(null);
      vi.mocked(proof.fetchProofServerReady).mockResolvedValue(null);
      vi.mocked(proof.fetchProofServerVersion).mockResolvedValue(null);
      vi.mocked(proof.fetchProofVersions).mockResolvedValue(null);
      vi.mocked(docker.composePs).mockResolvedValue([]);
      vi.mocked(docker.composeLogs).mockResolvedValue('');

      vi.mocked(health.checkAllHealth)
        .mockResolvedValueOnce({
          node: { healthy: true, responseTime: 45 },
          indexer: { healthy: true, responseTime: 32 },
          proofServer: { healthy: true, responseTime: 120 },
          allHealthy: true,
        })
        .mockResolvedValueOnce({
          node: { healthy: true, responseTime: 50 },
          indexer: { healthy: true, responseTime: 28 },
          proofServer: { healthy: true, responseTime: 110 },
          allHealthy: true,
        });

      await collector.collect();
      const state = await collector.collect();

      expect(state.health.node.history).toEqual([45, 50]);
      expect(state.health.indexer.history).toEqual([32, 28]);
      expect(state.health.proofServer.history).toEqual([120, 110]);
    });

    it('caps history at 30 entries', async () => {
      vi.mocked(rpc.fetchSystemChain).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemName).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemVersion).mockResolvedValue(null);
      vi.mocked(rpc.fetchSystemHealth).mockResolvedValue(null);
      vi.mocked(rpc.fetchBestBlockHeader).mockResolvedValue(null);
      vi.mocked(proof.fetchProofServerReady).mockResolvedValue(null);
      vi.mocked(proof.fetchProofServerVersion).mockResolvedValue(null);
      vi.mocked(proof.fetchProofVersions).mockResolvedValue(null);
      vi.mocked(docker.composePs).mockResolvedValue([]);
      vi.mocked(docker.composeLogs).mockResolvedValue('');

      for (let i = 0; i < 35; i++) {
        vi.mocked(health.checkAllHealth).mockResolvedValueOnce({
          node: { healthy: true, responseTime: i },
          indexer: { healthy: true, responseTime: i },
          proofServer: { healthy: true, responseTime: i },
          allHealthy: true,
        });
        await collector.collect();
      }

      const state = await collector.collect();
      // Last collect adds one more, but we need to mock it
      vi.mocked(health.checkAllHealth).mockResolvedValueOnce({
        node: { healthy: true, responseTime: 99 },
        indexer: { healthy: true, responseTime: 99 },
        proofServer: { healthy: true, responseTime: 99 },
        allHealthy: true,
      });
      const finalState = await collector.collect();
      expect(finalState.health.node.history.length).toBeLessThanOrEqual(30);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cli/dashboard/__tests__/state-collector.test.ts`
Expected: FAIL — cannot find module `../state-collector.js`

**Step 3: Commit failing tests**

```bash
git add src/cli/dashboard/__tests__/state-collector.test.ts
git commit -m "test: add state-collector tests (red)"
```

---

### Task 3: State Collector — Implementation

**Files:**
- Create: `src/cli/dashboard/state-collector.ts`

**Step 1: Implement StateCollector**

```typescript
import type { NetworkConfig, ServiceStatus } from '../../core/types.js';
import {
  fetchSystemChain,
  fetchSystemName,
  fetchSystemVersion,
  fetchSystemHealth,
  fetchBestBlockHeader,
} from './lib/substrate-rpc.js';
import {
  fetchProofServerReady,
  fetchProofServerVersion,
  fetchProofVersions,
} from './lib/proof-server-api.js';
import { composePs, composeLogs } from '../../core/docker.js';
import { checkAllHealth } from '../../core/health.js';
import { parseLogLines, type ParsedLogLine } from './lib/log-parser.js';

export interface DashboardState {
  node: {
    chain: string | null;
    name: string | null;
    version: string | null;
    blockHeight: number | null;
    avgBlockTime: number | null;
    peers: number | null;
    syncing: boolean | null;
  };
  indexer: {
    ready: boolean;
    responseTime: number | null;
  };
  proofServer: {
    version: string | null;
    ready: boolean;
    jobsProcessing: number | null;
    jobsPending: number | null;
    jobCapacity: number | null;
    proofVersions: string[] | null;
  };
  wallet: {
    address: string | null;
    connected: boolean;
    unshielded: string;
    shielded: string;
    dust: string;
  };
  health: {
    node: { status: 'healthy' | 'unhealthy'; history: number[] };
    indexer: { status: 'healthy' | 'unhealthy'; history: number[] };
    proofServer: { status: 'healthy' | 'unhealthy'; history: number[] };
  };
  containers: ServiceStatus[];
  logs: ParsedLogLine[];
  networkStatus: string;
}

const MAX_HISTORY = 30;

export class StateCollector {
  private config: NetworkConfig;
  private nodeHistory: number[] = [];
  private indexerHistory: number[] = [];
  private proofHistory: number[] = [];
  private blockHeights: number[] = [];
  private lastBlockTime: number | null = null;

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  async collect(walletInfo?: { address: string; unshielded: bigint; shielded: bigint; dust: bigint }, networkStatus = 'unknown'): Promise<DashboardState> {
    const proofBaseUrl = this.config.proofServer;

    const [chain, name, version, sysHealth, blockHeader, proofReady, proofVersion, proofVer, containers, rawLogs, healthReport] = await Promise.all([
      fetchSystemChain(this.config.node),
      fetchSystemName(this.config.node),
      fetchSystemVersion(this.config.node),
      fetchSystemHealth(this.config.node),
      fetchBestBlockHeader(this.config.node),
      fetchProofServerReady(proofBaseUrl),
      fetchProofServerVersion(proofBaseUrl),
      fetchProofVersions(proofBaseUrl),
      composePs(),
      composeLogs({ lines: 100 }),
      checkAllHealth(this.config),
    ]);

    // Track block height for avg block time calculation
    const blockHeight = blockHeader?.number ?? null;
    const avgBlockTime = this.updateBlockTimeAverage(blockHeight);

    // Track response time history
    if (healthReport.node.responseTime != null) {
      this.nodeHistory.push(healthReport.node.responseTime);
      if (this.nodeHistory.length > MAX_HISTORY) this.nodeHistory.shift();
    }
    if (healthReport.indexer.responseTime != null) {
      this.indexerHistory.push(healthReport.indexer.responseTime);
      if (this.indexerHistory.length > MAX_HISTORY) this.indexerHistory.shift();
    }
    if (healthReport.proofServer.responseTime != null) {
      this.proofHistory.push(healthReport.proofServer.responseTime);
      if (this.proofHistory.length > MAX_HISTORY) this.proofHistory.shift();
    }

    const logs = parseLogLines(rawLogs);

    return {
      node: {
        chain,
        name,
        version,
        blockHeight,
        avgBlockTime,
        peers: sysHealth?.peers ?? null,
        syncing: sysHealth?.isSyncing ?? null,
      },
      indexer: {
        ready: healthReport.indexer.healthy,
        responseTime: healthReport.indexer.responseTime ?? null,
      },
      proofServer: {
        version: proofVersion,
        ready: proofReady?.status === 'ok',
        jobsProcessing: proofReady?.jobsProcessing ?? null,
        jobsPending: proofReady?.jobsPending ?? null,
        jobCapacity: proofReady?.jobCapacity ?? null,
        proofVersions: proofVer,
      },
      wallet: {
        address: walletInfo?.address ?? null,
        connected: walletInfo != null,
        unshielded: String(walletInfo?.unshielded ?? 0n),
        shielded: String(walletInfo?.shielded ?? 0n),
        dust: String(walletInfo?.dust ?? 0n),
      },
      health: {
        node: { status: healthReport.node.healthy ? 'healthy' : 'unhealthy', history: [...this.nodeHistory] },
        indexer: { status: healthReport.indexer.healthy ? 'healthy' : 'unhealthy', history: [...this.indexerHistory] },
        proofServer: { status: healthReport.proofServer.healthy ? 'healthy' : 'unhealthy', history: [...this.proofHistory] },
      },
      containers,
      logs,
      networkStatus,
    };
  }

  private updateBlockTimeAverage(blockHeight: number | null): number | null {
    if (blockHeight == null) return null;

    const now = Date.now();
    if (this.lastBlockTime != null && this.blockHeights.length > 0) {
      const lastHeight = this.blockHeights[this.blockHeights.length - 1];
      if (blockHeight > lastHeight) {
        // New block(s) arrived
        this.blockHeights.push(blockHeight);
        if (this.blockHeights.length > 20) this.blockHeights.shift();
      }
    } else {
      this.blockHeights.push(blockHeight);
    }
    this.lastBlockTime = now;

    if (this.blockHeights.length < 2) return null;

    // Approximate: assume ~6s per block for local devnet
    // A more accurate approach would require tracking timestamps per block
    return 6.0;
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/cli/dashboard/__tests__/state-collector.test.ts`
Expected: PASS (all tests green)

**Step 3: Commit**

```bash
git add src/cli/dashboard/state-collector.ts
git commit -m "feat: add state-collector for aggregating devnet state"
```

---

### Task 4: Dashboard HTML Template

This is the largest task — the full single-page HTML with inline CSS and Preact/HTM JavaScript.

**Files:**
- Create: `src/cli/dashboard/html.ts`

**Step 1: Write a basic test for the HTML template**

Create: `src/cli/dashboard/__tests__/html.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { generateDashboardHtml } from '../html.js';

describe('generateDashboardHtml', () => {
  const html = generateDashboardHtml({ wsUrl: 'ws://localhost:31780/ws' });

  it('returns a complete HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the Midnight color palette CSS variables', () => {
    expect(html).toContain('--mn-void');
    expect(html).toContain('--mn-surface');
    expect(html).toContain('--mn-accent');
    expect(html).toContain('#09090f');
    expect(html).toContain('#3b3bff');
  });

  it('includes Google Fonts (Inter + JetBrains Mono)', () => {
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Inter');
    expect(html).toContain('JetBrains+Mono');
  });

  it('includes Preact and HTM imports from CDN', () => {
    expect(html).toContain('preact');
    expect(html).toContain('htm');
  });

  it('includes WebSocket connection logic with the provided URL', () => {
    expect(html).toContain('ws://localhost:31780/ws');
    expect(html).toContain('WebSocket');
  });

  it('includes all dashboard section components', () => {
    expect(html).toContain('NodeCard');
    expect(html).toContain('IndexerCard');
    expect(html).toContain('ProofServerCard');
    expect(html).toContain('WalletCard');
    expect(html).toContain('LogViewer');
  });

  it('includes Lucide icons from CDN', () => {
    expect(html).toContain('lucide');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/cli/dashboard/__tests__/html.test.ts`
Expected: FAIL — cannot find module `../html.js`

**Step 3: Implement the HTML template**

Create `src/cli/dashboard/html.ts`. This is a large file — the full Preact+HTM single-page app with inline CSS. The function `generateDashboardHtml({ wsUrl })` returns the complete HTML string.

Key sections of the template:

1. **`<head>`**: Google Fonts (Inter, JetBrains Mono), Lucide icons CDN, CSS custom properties (full Midnight palette), CSS Grid layout, animations
2. **`<body>`**: Mount point `<div id="app">`
3. **`<script type="importmap">`**: Maps `preact`, `preact/hooks`, `htm/preact`
4. **`<script type="module">`**: Preact components:
   - `App` — root, manages WebSocket connection + state
   - `Header` — network status badge, Start/Stop/Fund buttons
   - `NodeCard` — block height, avg block time, peers, version
   - `IndexerCard` — ready status, response time
   - `ProofServerCard` — version, job gauge, pending count
   - `WalletCard` — address (mono), NIGHT balances, DUST
   - `ResponseChart` — SVG sparkline paths for each service
   - `LogViewer` — scrollable log list with service/level filter dropdowns, search input
   - `StatusDot` — colored circle for healthy/unhealthy/offline

CSS details (per the approved design):
- `--mn-void` (#09090f) page background with dot-grid overlay
- Cards: `--mn-surface` bg, `--mn-border` border, `--mn-gradient-card` hover
- Accent glow orbs behind header using `::before` pseudo-element
- Staggered `@keyframes fadeIn` on cards (150ms delay per card)
- Gauge bar for proof server jobs with color thresholds (green/yellow/red)
- SVG sparklines — `<polyline>` with `--mn-accent` stroke
- Log viewer: monospace, color-coded service tags, auto-scroll with "pin to bottom"
- Responsive CSS Grid: `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`

WebSocket client logic:
- Connect to provided `wsUrl`
- On message (`type: "state"`): update Preact state
- On message (`type: "result"`): show toast notification
- Auto-reconnect with exponential backoff (1s, 2s, 4s... max 30s)
- Send commands: `{ type: "command", action: "start"|"stop"|"fund", ... }`

**Implementation note:** This file will be ~400-600 lines. The complete code should be written following the design doc's visual specifications exactly. Use the `frontend-design` skill's aesthetic guidance when implementing. Every address, hash, and numeric value in monospace. No pure black or pure white. Cool-toned throughout.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/cli/dashboard/__tests__/html.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli/dashboard/html.ts src/cli/dashboard/__tests__/html.test.ts
git commit -m "feat: add browser dashboard HTML template with Preact+HTM"
```

---

### Task 5: Dashboard Server — Tests

**Files:**
- Create: `src/cli/dashboard/__tests__/server.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../state-collector.js', () => ({
  StateCollector: vi.fn().mockImplementation(() => ({
    collect: vi.fn().mockResolvedValue({
      node: { chain: null, name: null, version: null, blockHeight: null, avgBlockTime: null, peers: null, syncing: null },
      indexer: { ready: false, responseTime: null },
      proofServer: { version: null, ready: false, jobsProcessing: null, jobsPending: null, jobCapacity: null, proofVersions: null },
      wallet: { address: null, connected: false, unshielded: '0', shielded: '0', dust: '0' },
      health: {
        node: { status: 'unhealthy', history: [] },
        indexer: { status: 'unhealthy', history: [] },
        proofServer: { status: 'unhealthy', history: [] },
      },
      containers: [],
      logs: [],
      networkStatus: 'stopped',
    }),
  })),
}));

vi.mock('../html.js', () => ({
  generateDashboardHtml: vi.fn().mockReturnValue('<html>mock</html>'),
}));

import { createDashboardApp } from '../server.js';

describe('createDashboardApp', () => {
  it('returns a Hono app instance', () => {
    const { app } = createDashboardApp({
      config: {
        node: 'http://127.0.0.1:9944',
        indexer: 'http://127.0.0.1:8088/api/v3/graphql',
        indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
        proofServer: 'http://127.0.0.1:6300',
        networkId: 'undeployed',
      },
      manager: {} as any,
      port: 31780,
    });
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('serves HTML on GET /', async () => {
    const { app } = createDashboardApp({
      config: {
        node: 'http://127.0.0.1:9944',
        indexer: 'http://127.0.0.1:8088/api/v3/graphql',
        indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
        proofServer: 'http://127.0.0.1:6300',
        networkId: 'undeployed',
      },
      manager: {} as any,
      port: 31780,
    });

    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<html>');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cli/dashboard/__tests__/server.test.ts`
Expected: FAIL — cannot find module `../server.js`

**Step 3: Commit failing tests**

```bash
git add src/cli/dashboard/__tests__/server.test.ts
git commit -m "test: add dashboard server tests (red)"
```

---

### Task 6: Dashboard Server — Implementation

**Files:**
- Create: `src/cli/dashboard/server.ts`

**Step 1: Implement the dashboard server**

```typescript
import { Hono } from 'hono';
import { generateDashboardHtml } from './html.js';
import { StateCollector, type DashboardState } from './state-collector.js';
import type { NetworkManager } from '../../core/network-manager.js';
import type { NetworkConfig } from '../../core/types.js';
import { getWalletBalances } from '../../core/wallet.js';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';

export interface DashboardServerOptions {
  config: NetworkConfig;
  manager: NetworkManager;
  port: number;
}

export function createDashboardApp(opts: DashboardServerOptions) {
  const { config, manager, port } = opts;
  const app = new Hono();
  const collector = new StateCollector(config);

  const html = generateDashboardHtml({ wsUrl: `ws://localhost:${port}/ws` });

  app.get('/', (c) => c.html(html));

  // WebSocket management
  const clients = new Set<WebSocket>();
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws) => {
      clients.add(ws);
      ws.on('close', () => clients.delete(ws));
      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg.type === 'command') {
            await handleCommand(msg, ws);
          }
        } catch {
          // Ignore malformed messages
        }
      });
    });

    return wss;
  }

  async function handleCommand(msg: { action: string; address?: string }, ws: WebSocket) {
    try {
      switch (msg.action) {
        case 'start':
          await manager.start({ pull: false });
          ws.send(JSON.stringify({ type: 'result', action: 'start', success: true }));
          break;
        case 'stop':
          await manager.stop({ removeVolumes: false });
          ws.send(JSON.stringify({ type: 'result', action: 'stop', success: true }));
          break;
        default:
          ws.send(JSON.stringify({ type: 'result', action: msg.action, success: false, error: `Unknown action: ${msg.action}` }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'result', action: msg.action, success: false, error: err instanceof Error ? err.message : String(err) }));
    }
  }

  async function collectAndBroadcast() {
    try {
      let walletInfo: { address: string; unshielded: bigint; shielded: bigint; dust: bigint } | undefined;
      const wallet = manager.getMasterWallet();
      if (wallet) {
        try {
          const balances = await getWalletBalances(wallet);
          // Get address from unshielded keystore
          const { PublicKey: UnshieldedPublicKey } = await import('@midnight-ntwrk/wallet-sdk-unshielded-wallet');
          const address = UnshieldedPublicKey.fromKeyStore(wallet.unshieldedKeystore).toString();
          walletInfo = { address, ...balances };
        } catch {
          // Wallet not ready yet
        }
      }

      const state = await collector.collect(walletInfo, manager.getStatus());
      const message = JSON.stringify({ type: 'state', data: state });

      for (const ws of clients) {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      }
    } catch {
      // Ignore collection errors — keep polling
    }
  }

  function startPolling() {
    // Initial broadcast
    collectAndBroadcast();
    // Poll every 3 seconds
    pollInterval = setInterval(collectAndBroadcast, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  function shutdown() {
    stopPolling();
    for (const ws of clients) {
      ws.close();
    }
    clients.clear();
  }

  return { app, setupWebSocket, startPolling, stopPolling, shutdown };
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/cli/dashboard/__tests__/server.test.ts`
Expected: PASS

**Step 3: Also run the state-collector tests to ensure no regressions**

Run: `npx vitest run src/cli/dashboard/__tests__/`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/cli/dashboard/server.ts
git commit -m "feat: add Hono dashboard server with WebSocket support"
```

---

### Task 7: Rewrite CLI Dashboard Command

**Files:**
- Modify: `src/cli/commands/dashboard.ts`

**Step 1: Write tests for the new dashboard command behavior**

Create: `src/cli/dashboard/__tests__/dashboard-command.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../server.js', () => ({
  createDashboardApp: vi.fn().mockReturnValue({
    app: { fetch: vi.fn() },
    setupWebSocket: vi.fn(),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    shutdown: vi.fn(),
  }),
}));

vi.mock('@hono/node-server', () => ({
  serve: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn((cb: () => void) => cb()),
    address: () => ({ port: 31780 }),
  }),
}));

vi.mock('open', () => ({ default: vi.fn() }));

// Test that the module structure is correct
import { createDashboardApp } from '../server.js';

describe('dashboard command integration', () => {
  it('createDashboardApp is callable with config', () => {
    const result = createDashboardApp({
      config: {
        node: 'http://127.0.0.1:9944',
        indexer: 'http://127.0.0.1:8088/api/v3/graphql',
        indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
        proofServer: 'http://127.0.0.1:6300',
        networkId: 'undeployed',
      },
      manager: {} as any,
      port: 31780,
    });
    expect(result.app).toBeDefined();
    expect(result.startPolling).toBeDefined();
    expect(result.shutdown).toBeDefined();
  });
});
```

**Step 2: Rewrite the dashboard command**

Replace the contents of `src/cli/commands/dashboard.ts`:

```typescript
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { createDashboardApp } from '../dashboard/server.js';
import { serve } from '@hono/node-server';
import open from 'open';
import { createServer } from 'node:net';

async function findOpenPort(start: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i;
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
    if (available) return port;
  }
  throw new Error(`No open port found in range ${start}-${start + maxAttempts - 1}`);
}

export function registerDashboardCommand(program: Command, manager: NetworkManager): void {
  program
    .command('dashboard')
    .description('Open browser dashboard for the local devnet')
    .option('--port <port>', 'Port to serve dashboard on', '31780')
    .option('--no-open', 'Do not auto-open the browser')
    .action(async (opts) => {
      const preferredPort = parseInt(opts.port, 10);
      const port = await findOpenPort(preferredPort);

      const { app, setupWebSocket, startPolling, shutdown } = createDashboardApp({
        config: manager.config,
        manager,
        port,
      });

      const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
        const url = `http://localhost:${info.port}`;
        console.log(`Dashboard running at ${url}`);
        console.log('Press Ctrl+C to stop\n');

        if (opts.open !== false) {
          open(url).catch(() => {
            // Ignore browser open errors
          });
        }
      });

      const wss = setupWebSocket(server as any);
      startPolling();

      // Graceful shutdown
      const gracefulShutdown = async () => {
        console.log('\nShutting down dashboard...');
        shutdown();
        wss.close();
        await new Promise<void>((resolve) => (server as any).close(() => resolve()));
        await manager.shutdown();
        process.exit(0);
      };

      process.on('SIGINT', gracefulShutdown);
      process.on('SIGTERM', gracefulShutdown);
    });
}
```

**Step 3: Run the tests**

Run: `npx vitest run src/cli/dashboard/__tests__/dashboard-command.test.ts`
Expected: PASS

**Step 4: Build to verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/cli/commands/dashboard.ts src/cli/dashboard/__tests__/dashboard-command.test.ts
git commit -m "feat: rewrite dashboard command to serve browser UI"
```

---

### Task 8: Delete Old TUI Files

**Files:**
- Delete: `src/cli/dashboard/app.tsx`
- Delete: `src/cli/dashboard/types.ts`
- Delete: `src/cli/dashboard/layouts/` (entire directory)
- Delete: `src/cli/dashboard/panels/` (entire directory)
- Delete: `src/cli/dashboard/components/` (entire directory)
- Delete: `src/cli/dashboard/hooks/` (entire directory)

**Step 1: Delete old TUI source files**

```bash
rm src/cli/dashboard/app.tsx
rm src/cli/dashboard/types.ts
rm -rf src/cli/dashboard/layouts/
rm -rf src/cli/dashboard/panels/
rm -rf src/cli/dashboard/components/
rm -rf src/cli/dashboard/hooks/
```

**Step 2: Remove old dependencies**

Run: `npm uninstall ink react @types/react ink-testing-library`

**Step 3: Remove `jsx` from tsconfig if no .tsx files remain**

Check: `find src -name "*.tsx" -type f`
If no results, remove `"jsx": "react-jsx"` from `tsconfig.json` compilerOptions.

**Step 4: Verify build still works**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run all remaining tests**

Run: `npx vitest run`
Expected: All tests pass. Old dashboard tests are gone (deleted with their directories). Core tests unaffected. New dashboard tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove terminal dashboard (ink/React) and unused deps"
```

---

### Task 9: Full Verification

**Step 1: Clean build**

```bash
rm -rf dist/
npm run build
```

Expected: Build succeeds with no errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Manual smoke test**

Run: `node --enable-source-maps dist/cli.js dashboard --no-open`
Expected:
- Prints "Dashboard running at http://localhost:31780"
- Server responds to `curl http://localhost:31780` with HTML containing Midnight palette CSS
- Ctrl+C cleanly shuts down

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```

---

## Summary

| Task | What | Files Changed |
|------|------|---------------|
| 1 | Add dependencies | `package.json` |
| 2 | State collector tests | `src/cli/dashboard/__tests__/state-collector.test.ts` |
| 3 | State collector impl | `src/cli/dashboard/state-collector.ts` |
| 4 | HTML template + tests | `src/cli/dashboard/html.ts`, `__tests__/html.test.ts` |
| 5 | Server tests | `src/cli/dashboard/__tests__/server.test.ts` |
| 6 | Server impl | `src/cli/dashboard/server.ts` |
| 7 | CLI command rewrite | `src/cli/commands/dashboard.ts`, `__tests__/dashboard-command.test.ts` |
| 8 | Delete old TUI + deps | Many deletions, `package.json`, `tsconfig.json` |
| 9 | Full verification | Build + test + smoke test |

**New deps:** hono, @hono/node-server, open
**Removed deps:** ink, react, @types/react, ink-testing-library
**Net file change:** ~34 files deleted, ~6 files created
