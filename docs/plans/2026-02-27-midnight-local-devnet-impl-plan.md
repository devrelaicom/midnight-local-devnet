# Midnight Local Devnet MCP Server — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone MCP server + CLI tool (`midnight-devnet`) for managing a local Midnight development network with Docker Compose, wallet SDK integration, and test account generation.

**Architecture:** Fresh TypeScript codebase with three layers: `src/core/` (transport-agnostic business logic), `src/mcp/` (MCP tool/resource definitions), `src/cli/` (commander-based CLI). Docker Compose managed via `child_process.execFile`, wallet operations via `@midnight-ntwrk/wallet-sdk-*`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@midnight-ntwrk/wallet-sdk-*`, `commander`, `zod`, `pino`, `vitest`

**Design doc:** `docs/plans/2026-02-27-midnight-local-devnet-mcp-design.md`

**Reference repo:** `hbulgarini/midnight-local-network` — the wallet SDK patterns in this plan are derived from that repo's `src/wallet.ts` and `src/funding.ts`.

**Note:** This project lives in its own standalone repository. The repo already exists at `midnight-local-devnet/`.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `docker/standalone.yml`
- Create: `docker/standalone.env`
- Create: `src/core/types.ts`
- Create: `src/core/config.ts`

**Step 1: Create package.json**

```json
{
  "name": "midnight-local-devnet",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "bin": {
    "midnight-devnet": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start:mcp": "node --enable-source-maps dist/index.js",
    "start:cli": "node --enable-source-maps dist/cli.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "@midnight-ntwrk/ledger-v7": "7.0.0",
    "@midnight-ntwrk/midnight-js-network-id": "3.1.0",
    "@midnight-ntwrk/wallet-sdk-abstractions": "1.0.0",
    "@midnight-ntwrk/wallet-sdk-address-format": "3.0.0",
    "@midnight-ntwrk/wallet-sdk-dust-wallet": "1.0.0",
    "@midnight-ntwrk/wallet-sdk-facade": "1.0.0",
    "@midnight-ntwrk/wallet-sdk-hd": "3.0.0",
    "@midnight-ntwrk/wallet-sdk-shielded": "1.0.0",
    "@midnight-ntwrk/wallet-sdk-unshielded-wallet": "1.0.0",
    "@scure/bip39": "^2.0.1",
    "commander": "^13.1.0",
    "pino": "^10.1.0",
    "pino-pretty": "^13.1.3",
    "rxjs": "^7.8.1",
    "ws": "^8.18.3",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ws": "^8.18.1",
    "typescript": "^5.9.3",
    "vitest": "^3.1.0"
  },
  "resolutions": {
    "@midnight-ntwrk/ledger-v7": "7.0.0",
    "@midnight-ntwrk/midnight-js-network-id": "3.1.0"
  }
}
```

**Step 2: Create tsconfig.json**

> Note: Uses `moduleResolution: "node16"` (not `"node"`) for correct ESM `.js` extension handling.

```json
{
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "lib": ["ESNext"],
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node16",
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "strict": true,
    "isolatedModules": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

**Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
logs/
.env
*.tgz
```

**Step 5: Create docker/standalone.yml**

```yaml
services:
  proof-server:
    container_name: 'midnight-proof-server'
    image: 'midnightntwrk/proof-server:7.0.0'
    command: ['midnight-proof-server -v']
    ports:
      - '6300:6300'
    environment:
      RUST_BACKTRACE: 'full'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:6300/version']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s

  indexer:
    container_name: 'midnight-indexer'
    image: 'midnightntwrk/indexer-standalone:3.0.0'
    env_file: standalone.env
    ports:
      - '8088:8088'
    environment:
      RUST_LOG: 'indexer=info,chain_indexer=info,indexer_api=info,wallet_indexer=info,indexer_common=info,fastrace_opentelemetry=off,info'
      APP__APPLICATION__NETWORK_ID: 'undeployed'
    healthcheck:
      test: ['CMD-SHELL', 'cat /var/run/indexer-standalone/running']
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 10s
    depends_on:
      node:
        condition: service_healthy

  node:
    image: 'midnightntwrk/midnight-node:0.20.0'
    container_name: 'midnight-node'
    ports:
      - '9944:9944'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9944/health']
      interval: 2s
      timeout: 5s
      retries: 20
      start_period: 20s
    environment:
      CFG_PRESET: 'dev'
      SIDECHAIN_BLOCK_BENEFICIARY: '04bcf7ad3be7a5c790460be82a713af570f22e0f801f6659ab8e84a52be6969e'
```

**Step 6: Create docker/standalone.env**

```
APP__INFRA__NODE__URL=ws://node:9944
APP__INFRA__STORAGE__PASSWORD=indexer
APP__INFRA__PUB_SUB__PASSWORD=indexer
APP__INFRA__LEDGER_STATE_STORAGE__PASSWORD=indexer
APP__INFRA__SECRET=303132333435363738393031323334353637383930313233343536373839303132
```

**Step 7: Create src/core/types.ts**

```typescript
export interface NetworkConfig {
  readonly indexer: string;
  readonly indexerWS: string;
  readonly node: string;
  readonly proofServer: string;
  readonly networkId: string;
}

export type NetworkStatus = 'stopped' | 'starting' | 'running' | 'stopping';

export type ServiceName = 'node' | 'indexer' | 'proof-server';

export interface ServiceStatus {
  name: ServiceName;
  containerName: string;
  status: 'running' | 'stopped' | 'unhealthy' | 'unknown';
  port: number;
  url: string;
}

export interface NetworkState {
  status: NetworkStatus;
  services: ServiceStatus[];
}

export interface WalletBalances {
  unshielded: bigint;
  shielded: bigint;
  dust: bigint;
  total: bigint;
}

export interface FundedAccount {
  name: string;
  address: string;
  amount: bigint;
  txHash: string;
  hasDust: boolean;
}

export interface GeneratedAccount {
  name: string;
  mnemonic?: string;
  privateKey?: string;
  address: string;
}

export interface AccountsFileFormat {
  accounts: Array<{
    name: string;
    mnemonic?: string;
    privateKey?: string;
  }>;
}

export class DevnetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'DevnetError';
  }
}
```

**Step 8: Create src/core/config.ts**

```typescript
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NetworkConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DOCKER_COMPOSE_DIR = path.resolve(__dirname, '../../docker');
export const DOCKER_COMPOSE_FILE = 'standalone.yml';

export const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
export const DEFAULT_NIGHT_AMOUNT = 50_000n * 10n ** 6n; // 50,000 NIGHT in smallest unit
export const MAX_ACCOUNTS_PER_BATCH = 10;

export const DOCKER_IMAGES = {
  node: 'midnightntwrk/midnight-node:0.20.0',
  indexer: 'midnightntwrk/indexer-standalone:3.0.0',
  proofServer: 'midnightntwrk/proof-server:7.0.0',
} as const;

export const defaultConfig: NetworkConfig = {
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};
```

> Note: `setNetworkId()` from `@midnight-ntwrk/midnight-js-network-id` is **not** called at module load. It will be called inside `initWalletFromSeed()` in the wallet module, since it sets global state and should only happen when wallet operations are needed.

**Step 9: Run npm install**

```bash
npm install
```

**Step 10: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: Success (no errors).

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with types, config, and docker compose"
```

---

### Task 2: Core Docker Module

**Files:**
- Create: `src/core/docker.ts`
- Create: `src/core/__tests__/docker.test.ts`

**Step 1: Write the test file**

> Note: Uses `vi.hoisted()` for correct ESM mocking. The mock is hoisted so it's in scope before the module imports `child_process`.

```typescript
// src/core/__tests__/docker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.fn();

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
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/docker.test.ts
```

Expected: FAIL — `../docker.js` does not exist.

**Step 3: Write the Docker module**

```typescript
// src/core/docker.ts
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { DOCKER_COMPOSE_DIR, DOCKER_COMPOSE_FILE } from './config.js';
import { DevnetError, type ServiceStatus, type ServiceName } from './types.js';

const execFile = promisify(execFileCb);

const COMPOSE_ARGS = [
  'compose',
  '-f',
  `${DOCKER_COMPOSE_DIR}/${DOCKER_COMPOSE_FILE}`,
];

const CONTAINER_TO_SERVICE: Record<string, { name: ServiceName; port: number; url: string }> = {
  'midnight-node': { name: 'node', port: 9944, url: 'http://127.0.0.1:9944' },
  'midnight-indexer': { name: 'indexer', port: 8088, url: 'http://127.0.0.1:8088/api/v3/graphql' },
  'midnight-proof-server': { name: 'proof-server', port: 6300, url: 'http://127.0.0.1:6300' },
};

export async function isDockerRunning(): Promise<boolean> {
  try {
    await execFile('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function assertDocker(): Promise<void> {
  const running = await isDockerRunning();
  if (!running) {
    throw new DevnetError(
      'Docker is not running.',
      'DOCKER_NOT_RUNNING',
      'Please start Docker Desktop.',
    );
  }
}

export async function composeUp(opts: { pull: boolean }): Promise<void> {
  await assertDocker();
  if (opts.pull) {
    await execFile('docker', [...COMPOSE_ARGS, 'pull'], { timeout: 300_000 });
  }
  await execFile('docker', [...COMPOSE_ARGS, 'up', '-d', '--wait'], { timeout: 300_000 });
}

export async function composeDown(opts: { removeVolumes: boolean }): Promise<void> {
  const args = [...COMPOSE_ARGS, 'down'];
  if (opts.removeVolumes) {
    args.push('-v');
  }
  await execFile('docker', args, { timeout: 60_000 });
}

export async function composePs(): Promise<ServiceStatus[]> {
  let stdout: string;
  try {
    const result = await execFile(
      'docker',
      [...COMPOSE_ARGS, 'ps', '--format', 'json'],
      { timeout: 10_000 },
    );
    stdout = result.stdout;
  } catch {
    return [];
  }

  if (!stdout.trim()) return [];

  let containers: Array<{ Name: string; State: string; Status: string }>;
  try {
    containers = JSON.parse(stdout);
  } catch {
    // docker compose ps --format json may output one JSON object per line
    containers = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  if (!Array.isArray(containers)) {
    containers = [containers];
  }

  return containers.map((c) => {
    const svc = CONTAINER_TO_SERVICE[c.Name];
    return {
      name: svc?.name ?? (c.Name as ServiceName),
      containerName: c.Name,
      status: c.State === 'running' ? ('running' as const) : ('stopped' as const),
      port: svc?.port ?? 0,
      url: svc?.url ?? '',
    };
  });
}

export async function composeLogs(opts: {
  service?: ServiceName;
  lines?: number;
}): Promise<string> {
  const args = [...COMPOSE_ARGS, 'logs', '--tail', String(opts.lines ?? 50)];
  if (opts.service) {
    args.push(opts.service);
  }
  const { stdout } = await execFile('docker', args, { timeout: 10_000 });
  return stdout;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/core/__tests__/docker.test.ts
```

Expected: PASS (all tests green).

**Step 5: Commit**

```bash
git add src/core/docker.ts src/core/__tests__/docker.test.ts
git commit -m "feat: core docker module with compose lifecycle management"
```

---

### Task 3: Core Wallet Module

> **CRITICAL:** The wallet SDK API uses factory functions, discriminated unions, and recipe-based patterns. This module follows the reference repo's (`hbulgarini/midnight-local-network`) `src/wallet.ts` exactly.

**Files:**
- Create: `src/core/wallet.ts`
- Create: `src/core/__tests__/wallet.test.ts`

**Step 1: Write the test file**

```typescript
// src/core/__tests__/wallet.test.ts
import { describe, it, expect } from 'vitest';
import { GENESIS_SEED } from '../config.js';

describe('wallet', () => {
  describe('GENESIS_SEED', () => {
    it('is a 64-character hex string', () => {
      expect(GENESIS_SEED).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('wallet module exports', () => {
    it('exports the expected functions', async () => {
      const wallet = await import('../wallet.js');
      expect(typeof wallet.initWalletFromSeed).toBe('function');
      expect(typeof wallet.initMasterWallet).toBe('function');
      expect(typeof wallet.getWalletBalances).toBe('function');
      expect(typeof wallet.waitForSync).toBe('function');
      expect(typeof wallet.waitForFunds).toBe('function');
      expect(typeof wallet.registerNightForDust).toBe('function');
      expect(typeof wallet.closeWallet).toBe('function');
      expect(typeof wallet.generateNewMnemonic).toBe('function');
      expect(typeof wallet.mnemonicToSeed).toBe('function');
    });
  });

  describe('mnemonicToSeed', () => {
    it('converts a valid mnemonic to a Buffer', async () => {
      const { mnemonicToSeed, generateNewMnemonic } = await import('../wallet.js');
      const mnemonic = generateNewMnemonic();
      const seed = mnemonicToSeed(mnemonic);
      expect(Buffer.isBuffer(seed)).toBe(true);
      expect(seed.length).toBe(64); // BIP39 seed is 64 bytes
    });
  });

  describe('generateNewMnemonic', () => {
    it('generates a 24-word mnemonic', async () => {
      const { generateNewMnemonic } = await import('../wallet.js');
      const mnemonic = generateNewMnemonic();
      expect(mnemonic.split(' ')).toHaveLength(24);
    });

    it('generates unique mnemonics', async () => {
      const { generateNewMnemonic } = await import('../wallet.js');
      const a = generateNewMnemonic();
      const b = generateNewMnemonic();
      expect(a).not.toBe(b);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/wallet.test.ts
```

Expected: FAIL — `../wallet.js` does not exist.

**Step 3: Write the wallet module**

> **KEY SDK PATTERNS (from reference repo):**
> - `HDWallet.fromSeed(seed)` returns `{ type: 'seedOk', hdWallet }` — MUST check `.type`
> - Key derivation chain: `.selectAccount(0).selectRoles([...]).deriveKeysAt(0)` — returns `{ type: 'keysDerived', keys }`
> - MUST call `hdWallet.hdWallet.clear()` after derivation to zeroize memory
> - Sub-wallets are factory functions: `ShieldedWallet(config).startWithSecretKeys(keys)`, NOT `new ShieldedWallet(keys)`
> - `createKeystore(secretKey, networkId)` — two args, NOT three
> - `WalletFacade` constructor takes `(shieldedWallet, unshieldedWallet, dustWallet)` — three sub-wallets, no URLs
> - `facade.start(shieldedSecretKeys, dustSecretKey)` — takes secret keys
> - `wallet.state()` shape: `state.isSynced`, `state.unshielded?.balances[ledger.nativeToken().raw]`

```typescript
// src/core/wallet.ts
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey as UnshieldedPublicKey,
  type UnshieldedKeystore,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { generateMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';
import type { NetworkConfig, WalletBalances } from './types.js';
import { DevnetError } from './types.js';
import { GENESIS_SEED } from './config.js';
import type { Logger } from 'pino';

// Required for wallet SDK WebSocket support (Apollo uses globalThis.WebSocket)
// @ts-expect-error: Needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export interface WalletContext {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

let logger: Logger | null = null;

export function setLogger(l: Logger): void {
  logger = l;
}

// ── Mnemonic / seed helpers ────────────────────────────────────────────────

export function generateNewMnemonic(): string {
  return generateMnemonic(english, 256);
}

export function mnemonicToSeed(mnemonic: string): Buffer {
  return Buffer.from(mnemonicToSeedSync(mnemonic));
}

// ── Wallet initialization ──────────────────────────────────────────────────

export async function initWalletFromSeed(
  seed: Buffer,
  config: NetworkConfig,
): Promise<WalletContext> {
  setNetworkId(config.networkId);

  // 1. HD key derivation (discriminated union — MUST check .type)
  const hdResult = HDWallet.fromSeed(seed);
  if (hdResult.type !== 'seedOk') {
    throw new DevnetError('Failed to initialize HDWallet from seed', 'HD_WALLET_ERROR');
  }

  const derivationResult = hdResult.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);

  if (derivationResult.type !== 'keysDerived') {
    throw new DevnetError('Failed to derive wallet keys', 'KEY_DERIVATION_ERROR');
  }

  // Zeroize HD wallet memory after derivation
  hdResult.hdWallet.clear();

  // 2. Build secret keys / keystore from derived seeds
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(derivationResult.keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(derivationResult.keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(
    derivationResult.keys[Roles.NightExternal],
    config.networkId as any,
  );

  // 3. Per-wallet configs
  const relayURL = new URL(config.node.replace(/^http/, 'ws'));

  const shieldedConfig = {
    networkId: config.networkId,
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL,
  };

  const unshieldedConfig = {
    networkId: config.networkId,
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  };

  const dustConfig = {
    networkId: config.networkId,
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL,
  };

  // 4. Sub-wallet construction (factory functions, NOT constructors)
  const shieldedWallet = ShieldedWallet(shieldedConfig).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet(unshieldedConfig).startWithPublicKey(
    UnshieldedPublicKey.fromKeyStore(unshieldedKeystore),
  );
  const dustWallet = DustWallet(dustConfig).startWithSecretKey(
    dustSecretKey,
    ledger.LedgerParameters.initialParameters().dust,
  );

  // 5. WalletFacade: 3 sub-wallets, no URLs
  const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  logger?.info('Waiting for wallet to sync...');
  await waitForSync(wallet);
  logger?.info('Wallet synced');

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

export async function initWalletFromMnemonic(
  mnemonic: string,
  config: NetworkConfig,
): Promise<WalletContext> {
  const seed = mnemonicToSeed(mnemonic);
  return initWalletFromSeed(seed, config);
}

export async function initMasterWallet(config: NetworkConfig): Promise<WalletContext> {
  logger?.info('Initializing master wallet from genesis seed...');
  const seed = Buffer.from(GENESIS_SEED, 'hex');
  return initWalletFromSeed(seed, config);
}

// ── State observation ──────────────────────────────────────────────────────

export function waitForSync(wallet: WalletFacade): Promise<unknown> {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(5_000),
      Rx.tap((state) => {
        logger?.info(`Waiting for wallet sync. Synced: ${state.isSynced}`);
      }),
      Rx.filter((state) => state.isSynced),
    ),
  );
}

export function waitForFunds(wallet: WalletFacade): Promise<bigint> {
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.throttleTime(10_000),
      Rx.tap((state) => {
        const unshielded = state.unshielded?.balances[ledger.nativeToken().raw] ?? 0n;
        const shielded = state.shielded?.balances[ledger.nativeToken().raw] ?? 0n;
        logger?.info(
          `Waiting for funds. Synced: ${state.isSynced}, Unshielded: ${unshielded}, Shielded: ${shielded}`,
        );
      }),
      Rx.filter((state) => state.isSynced),
      Rx.map(
        (s) =>
          (s.unshielded?.balances[ledger.nativeToken().raw] ?? 0n) +
          (s.shielded?.balances[ledger.nativeToken().raw] ?? 0n),
      ),
      Rx.filter((balance) => balance > 0n),
    ),
  );
}

export async function getWalletBalances(ctx: WalletContext): Promise<WalletBalances> {
  const state = await Rx.firstValueFrom(ctx.wallet.state());
  const nativeToken = ledger.nativeToken().raw;
  const unshielded = state.unshielded?.balances[nativeToken] ?? 0n;
  const shielded = state.shielded?.balances[nativeToken] ?? 0n;
  const dust = state.dust?.walletBalance(new Date()) ?? 0n;
  return {
    unshielded,
    shielded,
    dust,
    total: unshielded + shielded,
  };
}

// ── DUST registration ──────────────────────────────────────────────────────

/**
 * Register unshielded NIGHT UTXOs for DUST generation.
 * Uses the recipe pattern: build → finalize → submit (no separate sign step).
 */
export async function registerNightForDust(ctx: WalletContext): Promise<boolean> {
  logger?.info('Registering NIGHT UTXOs for DUST generation...');
  try {
    const state = await Rx.firstValueFrom(ctx.wallet.state());

    // Find unregistered UTXOs
    const unregistered = state.unshielded?.availableCoins?.filter(
      (coin: any) => !coin.meta?.registeredForDustGeneration,
    );

    if (!unregistered || unregistered.length === 0) {
      logger?.info('No unregistered UTXOs found (may already be registered)');
      return true;
    }

    const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      UnshieldedPublicKey.fromKeyStore(ctx.unshieldedKeystore),
      (payload: any) => ctx.unshieldedKeystore.signData(payload),
    );
    const finalized = await ctx.wallet.finalizeRecipe(recipe);
    await ctx.wallet.submitTransaction(finalized);

    logger?.info('DUST registration transaction submitted');
    return true;
  } catch (err) {
    logger?.error({ err }, 'DUST registration failed');
    return false;
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────

export async function closeWallet(ctx: WalletContext): Promise<void> {
  try {
    ctx.wallet.stop();
  } catch {
    // Ignore stop errors
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/core/__tests__/wallet.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/wallet.ts src/core/__tests__/wallet.test.ts
git commit -m "feat: core wallet module using correct SDK factory/recipe patterns"
```

---

### Task 4: Core Funding Module

> **KEY SDK PATTERN:** Transfer uses a 4-step recipe: `transferTransaction()` → `signRecipe()` → `finalizeRecipe()` → `submitTransaction()`. There is no `wallet.transferUnshielded()` method.

**Files:**
- Create: `src/core/funding.ts`
- Create: `src/core/__tests__/funding.test.ts`

**Step 1: Write the test file**

```typescript
// src/core/__tests__/funding.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_NIGHT_AMOUNT, MAX_ACCOUNTS_PER_BATCH } from '../config.js';

describe('funding', () => {
  describe('constants', () => {
    it('DEFAULT_NIGHT_AMOUNT is 50,000 NIGHT in smallest unit', () => {
      expect(DEFAULT_NIGHT_AMOUNT).toBe(50_000n * 10n ** 6n);
    });

    it('MAX_ACCOUNTS_PER_BATCH is 10', () => {
      expect(MAX_ACCOUNTS_PER_BATCH).toBe(10);
    });
  });

  describe('funding module exports', () => {
    it('exports the expected functions', async () => {
      const funding = await import('../funding.js');
      expect(typeof funding.transferNight).toBe('function');
      expect(typeof funding.fundAccount).toBe('function');
      expect(typeof funding.fundAccountFromMnemonic).toBe('function');
      expect(typeof funding.fundAccountsFromFile).toBe('function');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/funding.test.ts
```

Expected: FAIL — `../funding.js` does not exist.

**Step 3: Write the funding module**

> Uses the 4-step recipe pattern from the reference repo's `src/funding.ts`.

```typescript
// src/core/funding.ts
import { readFile } from 'node:fs/promises';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import type { Logger } from 'pino';
import type {
  NetworkConfig,
  FundedAccount,
  AccountsFileFormat,
} from './types.js';
import { DevnetError } from './types.js';
import { DEFAULT_NIGHT_AMOUNT, MAX_ACCOUNTS_PER_BATCH } from './config.js';
import {
  type WalletContext,
  initWalletFromMnemonic,
  waitForFunds,
  registerNightForDust,
  closeWallet,
  getWalletBalances,
} from './wallet.js';

let logger: Logger | null = null;

export function setLogger(l: Logger): void {
  logger = l;
}

/**
 * Transfer NIGHT tokens using the 4-step recipe pattern:
 * 1. Build recipe (transferTransaction)
 * 2. Sign recipe (signRecipe)
 * 3. Finalize (finalizeRecipe)
 * 4. Submit (submitTransaction)
 */
export async function transferNight(
  masterWallet: WalletContext,
  receiverAddress: string,
  amount: bigint,
): Promise<string> {
  logger?.info({ receiverAddress, amount: amount.toString() }, 'Transferring NIGHT...');

  const ttl = new Date(Date.now() + 30 * 60 * 1000); // 30-minute TTL

  // Step 1: Build recipe
  const recipe = await masterWallet.wallet.transferTransaction(
    [
      {
        type: 'unshielded',
        outputs: [
          {
            type: ledger.nativeToken().raw,
            receiverAddress,
            amount,
          },
        ],
      },
    ],
    {
      shieldedSecretKeys: masterWallet.shieldedSecretKeys,
      dustSecretKey: masterWallet.dustSecretKey,
    },
    { ttl },
  );

  // Step 2: Sign with unshielded keystore
  const signed = await masterWallet.wallet.signRecipe(recipe, (payload: any) =>
    masterWallet.unshieldedKeystore.signData(payload),
  );

  // Step 3: Finalize
  const finalized = await masterWallet.wallet.finalizeRecipe(signed);

  // Step 4: Submit
  const txHash = await masterWallet.wallet.submitTransaction(finalized);

  logger?.info({ txHash }, 'Transfer complete');
  return String(txHash);
}

export async function fundAccount(
  masterWallet: WalletContext,
  address: string,
  amount: bigint = DEFAULT_NIGHT_AMOUNT,
): Promise<FundedAccount> {
  // Check master wallet has sufficient balance
  const balances = await getWalletBalances(masterWallet);
  if (balances.unshielded < amount) {
    throw new DevnetError(
      `Insufficient master wallet balance: ${balances.unshielded} < ${amount}`,
      'INSUFFICIENT_BALANCE',
      'The master wallet does not have enough NIGHT to fund this account.',
    );
  }

  const txHash = await transferNight(masterWallet, address, amount);
  logger?.info({ address, txHash }, 'Account funded');

  return {
    name: address.slice(0, 12) + '...',
    address,
    amount,
    txHash,
    hasDust: false,
  };
}

export async function fundAccountFromMnemonic(
  masterWallet: WalletContext,
  name: string,
  mnemonic: string,
  config: NetworkConfig,
  amount: bigint = DEFAULT_NIGHT_AMOUNT,
): Promise<FundedAccount> {
  logger?.info({ name }, 'Deriving wallet from mnemonic...');
  const recipientCtx = await initWalletFromMnemonic(mnemonic, config);

  // Get recipient address from unshielded keystore
  const recipientState = await import('rxjs').then((rx) =>
    rx.firstValueFrom(recipientCtx.wallet.state()),
  );
  // The address comes from the unshielded wallet's public key
  const { PublicKey: UnshieldedPublicKey } = await import(
    '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
  );
  const address = UnshieldedPublicKey.fromKeyStore(recipientCtx.unshieldedKeystore).toString();

  // Transfer NIGHT from master
  const txHash = await transferNight(masterWallet, address, amount);

  // Wait for recipient to see funds
  logger?.info({ name }, 'Waiting for recipient to sync funds...');
  await waitForFunds(recipientCtx.wallet);

  // Register DUST
  const hasDust = await registerNightForDust(recipientCtx);

  // Close recipient wallet
  await closeWallet(recipientCtx);

  return { name, address, amount, txHash, hasDust };
}

export async function fundAccountsFromFile(
  masterWallet: WalletContext,
  filePath: string,
  config: NetworkConfig,
): Promise<FundedAccount[]> {
  const raw = await readFile(filePath, 'utf-8');
  let accountsFile: AccountsFileFormat;
  try {
    accountsFile = JSON.parse(raw);
  } catch {
    throw new DevnetError(
      `Invalid JSON in accounts file: ${filePath}`,
      'INVALID_ACCOUNTS_FILE',
    );
  }

  if (!accountsFile.accounts || !Array.isArray(accountsFile.accounts)) {
    throw new DevnetError(
      'Accounts file must contain an "accounts" array',
      'INVALID_ACCOUNTS_FILE',
    );
  }

  if (accountsFile.accounts.length > MAX_ACCOUNTS_PER_BATCH) {
    throw new DevnetError(
      `Maximum ${MAX_ACCOUNTS_PER_BATCH} accounts per batch. Got ${accountsFile.accounts.length}.`,
      'TOO_MANY_ACCOUNTS',
    );
  }

  const funded: FundedAccount[] = [];
  for (const account of accountsFile.accounts) {
    if (account.mnemonic) {
      const result = await fundAccountFromMnemonic(
        masterWallet,
        account.name,
        account.mnemonic,
        config,
      );
      funded.push(result);
    } else {
      throw new DevnetError(
        `Account "${account.name}" has no mnemonic`,
        'INVALID_ACCOUNT_ENTRY',
      );
    }
  }

  return funded;
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/core/__tests__/funding.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/funding.ts src/core/__tests__/funding.test.ts
git commit -m "feat: core funding module with 4-step recipe transfer pattern"
```

---

### Task 5: Core Account Generation Module

**Files:**
- Create: `src/core/accounts.ts`
- Create: `src/core/__tests__/accounts.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/__tests__/accounts.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('accounts', () => {
  describe('generateAccounts', () => {
    it('generates the requested number of accounts with mnemonics', async () => {
      const { generateAccounts } = await import('../accounts.js');
      const accounts = await generateAccounts({ format: 'mnemonic', count: 3 });
      expect(accounts).toHaveLength(3);
      accounts.forEach((a, i) => {
        expect(a.name).toBe(`Account ${i + 1}`);
        expect(a.mnemonic).toBeDefined();
        expect(a.mnemonic!.split(' ')).toHaveLength(24);
        expect(a.privateKey).toBeUndefined();
      });
    });

    it('generates accounts with derived hex seed when format is privateKey', async () => {
      const { generateAccounts } = await import('../accounts.js');
      const accounts = await generateAccounts({ format: 'privateKey', count: 1 });
      expect(accounts[0].privateKey).toBeDefined();
      expect(accounts[0].privateKey).toMatch(/^[0-9a-f]{128}$/); // 64-byte hex seed
      expect(accounts[0].mnemonic).toBeUndefined();
    });

    it('defaults to count=1', async () => {
      const { generateAccounts } = await import('../accounts.js');
      const accounts = await generateAccounts({ format: 'mnemonic' });
      expect(accounts).toHaveLength(1);
    });
  });

  describe('writeAccountsFile', () => {
    it('writes accounts in the expected JSON format', async () => {
      const { writeAccountsFile } = await import('../accounts.js');
      const fs = await import('node:fs/promises');
      const writeSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue();

      await writeAccountsFile('/tmp/test-accounts.json', [
        { name: 'Account 1', mnemonic: 'word '.repeat(24).trim(), address: '' },
      ]);

      expect(writeSpy).toHaveBeenCalledOnce();
      const written = JSON.parse(writeSpy.mock.calls[0][1] as string);
      expect(written.accounts).toHaveLength(1);
      expect(written.accounts[0].name).toBe('Account 1');
      expect(written.accounts[0].mnemonic).toBeDefined();

      writeSpy.mockRestore();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/accounts.test.ts
```

Expected: FAIL — `../accounts.js` does not exist.

**Step 3: Write the accounts module**

> **Fix from review #5:** When `format === 'privateKey'`, derive the actual 64-byte hex seed from the mnemonic instead of storing the mnemonic in the `privateKey` field.

```typescript
// src/core/accounts.ts
import { writeFile } from 'node:fs/promises';
import type { GeneratedAccount, AccountsFileFormat, NetworkConfig, FundedAccount } from './types.js';
import {
  generateNewMnemonic,
  mnemonicToSeed,
  initWalletFromMnemonic,
  registerNightForDust,
  closeWallet,
} from './wallet.js';
import { fundAccount } from './funding.js';
import type { WalletContext } from './wallet.js';
import { DEFAULT_NIGHT_AMOUNT } from './config.js';
import type { Logger } from 'pino';

let logger: Logger | null = null;

export function setLogger(l: Logger): void {
  logger = l;
}

export interface GenerateOptions {
  format: 'mnemonic' | 'privateKey';
  count?: number;
}

export async function generateAccounts(opts: GenerateOptions): Promise<GeneratedAccount[]> {
  const count = opts.count ?? 1;
  const accounts: GeneratedAccount[] = [];

  for (let i = 0; i < count; i++) {
    const mnemonic = generateNewMnemonic();

    if (opts.format === 'privateKey') {
      // Derive actual hex seed from mnemonic (review fix #5)
      const seed = mnemonicToSeed(mnemonic);
      accounts.push({
        name: `Account ${i + 1}`,
        privateKey: seed.toString('hex'),
        address: '', // Address is derived when wallet is initialized on-chain
      });
    } else {
      accounts.push({
        name: `Account ${i + 1}`,
        mnemonic,
        address: '', // Address is derived when wallet is initialized on-chain
      });
    }
  }

  return accounts;
}

export async function generateAndFundAccounts(
  masterWallet: WalletContext,
  config: NetworkConfig,
  opts: GenerateOptions & { fund?: boolean; registerDust?: boolean },
): Promise<(GeneratedAccount & { funded?: boolean; dustRegistered?: boolean })[]> {
  const accounts = await generateAccounts(opts);
  const results = [];

  for (const account of accounts) {
    const mnemonic = account.mnemonic;
    // For privateKey format, we need the original mnemonic to init wallet.
    // Since we only stored the hex seed, we regenerate and use a fresh mnemonic
    // for funding. This means privateKey format accounts must be funded via
    // address, not mnemonic. For now, only mnemonic format supports auto-funding.
    if (!mnemonic) {
      results.push({ ...account, funded: false, dustRegistered: false });
      continue;
    }

    if (opts.fund) {
      logger?.info({ name: account.name }, 'Funding account...');
      const ctx = await initWalletFromMnemonic(mnemonic, config);

      // Get address from the unshielded keystore public key
      const { PublicKey: UnshieldedPublicKey } = await import(
        '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
      );
      const address = UnshieldedPublicKey.fromKeyStore(ctx.unshieldedKeystore).toString();
      account.address = address;

      await fundAccount(masterWallet, address, DEFAULT_NIGHT_AMOUNT);

      if (opts.registerDust) {
        const dustOk = await registerNightForDust(ctx);
        results.push({ ...account, funded: true, dustRegistered: dustOk });
      } else {
        results.push({ ...account, funded: true, dustRegistered: false });
      }

      await closeWallet(ctx);
    } else {
      results.push({ ...account, funded: false, dustRegistered: false });
    }
  }

  return results;
}

export async function writeAccountsFile(
  filePath: string,
  accounts: GeneratedAccount[],
): Promise<void> {
  const fileContent: AccountsFileFormat = {
    accounts: accounts.map((a) => ({
      name: a.name,
      ...(a.mnemonic ? { mnemonic: a.mnemonic } : {}),
      ...(a.privateKey ? { privateKey: a.privateKey } : {}),
    })),
  };
  await writeFile(filePath, JSON.stringify(fileContent, null, 2) + '\n', 'utf-8');
  logger?.info({ filePath, count: accounts.length }, 'Accounts file written');
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/core/__tests__/accounts.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/accounts.ts src/core/__tests__/accounts.test.ts
git commit -m "feat: core account generation with correct privateKey derivation"
```

---

### Task 6: Core Health Check Module

**Files:**
- Create: `src/core/health.ts`
- Create: `src/core/__tests__/health.test.ts`

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/__tests__/health.test.ts
```

Expected: FAIL — `../health.js` does not exist.

**Step 3: Write the health module**

```typescript
// src/core/health.ts
import { defaultConfig } from './config.js';

export interface ServiceHealth {
  healthy: boolean;
  responseTime?: number;
  error?: string;
}

export interface HealthReport {
  node: ServiceHealth;
  indexer: ServiceHealth;
  proofServer: ServiceHealth;
  allHealthy: boolean;
}

async function checkEndpoint(url: string): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return {
      healthy: response.ok,
      responseTime: Date.now() - start,
    };
  } catch (err) {
    return {
      healthy: false,
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkAllHealth(): Promise<HealthReport> {
  const [node, indexer, proofServer] = await Promise.all([
    checkEndpoint(`${defaultConfig.node}/health`),
    checkEndpoint(defaultConfig.indexer),
    checkEndpoint(`${defaultConfig.proofServer}/version`),
  ]);

  return {
    node,
    indexer,
    proofServer,
    allHealthy: node.healthy && indexer.healthy && proofServer.healthy,
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/core/__tests__/health.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/health.ts src/core/__tests__/health.test.ts
git commit -m "feat: core health check module for service endpoints"
```

---

### Task 7: NetworkManager + MCP Server with Network Tools

> **Review fix #1 (Major):** State ownership moves to a `NetworkManager` class in `src/core/`. No module-level mutable state in MCP or CLI layers. On construction, `NetworkManager` probes Docker to detect already-running containers.

**Files:**
- Create: `src/core/network-manager.ts`
- Create: `src/core/__tests__/network-manager.test.ts`
- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools/network.ts`
- Create: `src/mcp/tools/health.ts`
- Create: `src/mcp/tools/wallet.ts` (stub)
- Create: `src/mcp/tools/funding.ts` (stub)
- Create: `src/mcp/tools/accounts.ts` (stub)
- Create: `src/mcp/resources/config.ts`
- Create: `src/index.ts`

**Step 1: Write NetworkManager tests**

```typescript
// src/core/__tests__/network-manager.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the core modules
vi.mock('../docker.js', () => ({
  composeUp: vi.fn().mockResolvedValue(undefined),
  composeDown: vi.fn().mockResolvedValue(undefined),
  composePs: vi.fn().mockResolvedValue([]),
  composeLogs: vi.fn().mockResolvedValue(''),
  isDockerRunning: vi.fn().mockResolvedValue(true),
}));

vi.mock('../wallet.js', () => ({
  initMasterWallet: vi.fn().mockResolvedValue({
    wallet: { stop: vi.fn() },
    shieldedSecretKeys: {},
    dustSecretKey: {},
    unshieldedKeystore: {},
  }),
  registerNightForDust: vi.fn().mockResolvedValue(true),
  closeWallet: vi.fn().mockResolvedValue(undefined),
  setLogger: vi.fn(),
}));

import { NetworkManager } from '../network-manager.js';
import { composePs } from '../docker.js';

describe('NetworkManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts in stopped state', () => {
    const mgr = new NetworkManager();
    expect(mgr.getStatus()).toBe('stopped');
    expect(mgr.getMasterWallet()).toBeNull();
  });

  it('detects already-running containers', async () => {
    vi.mocked(composePs).mockResolvedValueOnce([
      { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: '' },
      { name: 'indexer', containerName: 'midnight-indexer', status: 'running', port: 8088, url: '' },
      { name: 'proof-server', containerName: 'midnight-proof-server', status: 'running', port: 6300, url: '' },
    ]);
    const mgr = new NetworkManager();
    await mgr.detectRunningNetwork();
    expect(mgr.getStatus()).toBe('running');
  });

  it('stays stopped when no containers are running', async () => {
    vi.mocked(composePs).mockResolvedValueOnce([]);
    const mgr = new NetworkManager();
    await mgr.detectRunningNetwork();
    expect(mgr.getStatus()).toBe('stopped');
  });

  it('start is a no-op when already running', async () => {
    const mgr = new NetworkManager();
    // Force to running state via detect
    vi.mocked(composePs).mockResolvedValueOnce([
      { name: 'node', containerName: 'midnight-node', status: 'running', port: 9944, url: '' },
      { name: 'indexer', containerName: 'midnight-indexer', status: 'running', port: 8088, url: '' },
      { name: 'proof-server', containerName: 'midnight-proof-server', status: 'running', port: 6300, url: '' },
    ]);
    await mgr.detectRunningNetwork();
    await mgr.ensureWallet();

    // Now start should be a no-op
    const result = await mgr.start({ pull: false });
    expect(result).toBe('already-running');
  });
});
```

**Step 2: Write NetworkManager implementation**

```typescript
// src/core/network-manager.ts
import type { Logger } from 'pino';
import type { NetworkConfig, NetworkStatus, ServiceStatus } from './types.js';
import { DevnetError } from './types.js';
import { defaultConfig } from './config.js';
import { composeUp, composeDown, composePs, composeLogs } from './docker.js';
import {
  initMasterWallet,
  registerNightForDust,
  closeWallet,
  type WalletContext,
} from './wallet.js';

export class NetworkManager {
  private status: NetworkStatus = 'stopped';
  private masterWallet: WalletContext | null = null;
  private logger: Logger | null = null;
  public readonly config: NetworkConfig;

  constructor(config?: NetworkConfig) {
    this.config = config ?? defaultConfig;
  }

  setLogger(l: Logger): void {
    this.logger = l;
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  getMasterWallet(): WalletContext | null {
    return this.masterWallet;
  }

  /**
   * Probe Docker to detect if network containers are already running.
   * Called on initialization to recover state after process restart.
   */
  async detectRunningNetwork(): Promise<void> {
    try {
      const services = await composePs();
      const allRunning =
        services.length >= 3 &&
        services.every((s) => s.status === 'running');

      if (allRunning) {
        this.logger?.info('Detected running network containers');
        this.status = 'running';
      }
    } catch {
      // Docker not available or compose not set up — stay stopped
    }
  }

  /**
   * Ensure the master wallet is initialized. If the network is running
   * but the wallet is null (e.g., after process restart), auto-init it.
   * Throws if the network is not running.
   */
  async ensureWallet(): Promise<WalletContext> {
    if (this.status !== 'running') {
      throw new DevnetError(
        'Network is not running. Call start-network first.',
        'NETWORK_NOT_RUNNING',
      );
    }

    if (!this.masterWallet) {
      this.logger?.info('Auto-initializing master wallet...');
      this.masterWallet = await initMasterWallet(this.config);
      await registerNightForDust(this.masterWallet);
    }

    return this.masterWallet;
  }

  async start(opts: { pull: boolean }): Promise<'started' | 'already-running'> {
    if (this.status === 'running') {
      return 'already-running';
    }

    this.status = 'starting';
    try {
      await composeUp({ pull: opts.pull });
      this.masterWallet = await initMasterWallet(this.config);
      await registerNightForDust(this.masterWallet);
      this.status = 'running';
      this.logger?.info('Network started and master wallet initialized');
      return 'started';
    } catch (err) {
      this.status = 'stopped';
      throw err;
    }
  }

  async stop(opts: { removeVolumes: boolean }): Promise<void> {
    this.status = 'stopping';
    try {
      if (this.masterWallet) {
        await closeWallet(this.masterWallet);
        this.masterWallet = null;
      }
      await composeDown({ removeVolumes: opts.removeVolumes });
    } finally {
      this.status = 'stopped';
    }
  }

  async restart(opts: { pull: boolean; removeVolumes: boolean }): Promise<void> {
    await this.stop({ removeVolumes: opts.removeVolumes });
    await this.start({ pull: opts.pull });
  }

  async getServices(): Promise<ServiceStatus[]> {
    return composePs();
  }

  async getLogs(opts: { service?: 'node' | 'indexer' | 'proof-server'; lines?: number }): Promise<string> {
    return composeLogs(opts);
  }

  /**
   * Graceful shutdown — close wallet but leave Docker containers running.
   */
  async shutdown(): Promise<void> {
    if (this.masterWallet) {
      await closeWallet(this.masterWallet);
      this.masterWallet = null;
    }
  }
}
```

**Step 3: Write MCP server setup**

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../core/network-manager.js';
import { registerNetworkTools } from './tools/network.js';
import { registerHealthTools } from './tools/health.js';
import { registerWalletTools } from './tools/wallet.js';
import { registerFundingTools } from './tools/funding.js';
import { registerAccountTools } from './tools/accounts.js';
import { registerResources } from './resources/config.js';

export function createServer(manager: NetworkManager): McpServer {
  const server = new McpServer(
    {
      name: 'midnight-local-devnet',
      version: '0.1.0',
    },
    {
      capabilities: {
        logging: {},
        resources: {},
        tools: {},
      },
    },
  );

  registerNetworkTools(server, manager);
  registerHealthTools(server);
  registerWalletTools(server, manager);
  registerFundingTools(server, manager);
  registerAccountTools(server, manager);
  registerResources(server, manager);

  return server;
}
```

**Step 4: Create the network tools (using NetworkManager, no module-level state)**

```typescript
// src/mcp/tools/network.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';

export function registerNetworkTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'start-network',
    'Start the local Midnight development network (node, indexer, proof-server). Initializes the genesis master wallet and registers DUST.',
    { pull: z.boolean().optional().describe('Pull latest Docker images before starting') },
    async ({ pull }) => {
      const result = await manager.start({ pull: pull ?? false });
      if (result === 'already-running') {
        return { content: [{ type: 'text', text: 'Network is already running.' }] };
      }
      const services = await manager.getServices();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'running',
            services: services.map((s) => ({ name: s.name, url: s.url, port: s.port })),
            config: manager.config,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'stop-network',
    'Stop the local Midnight development network and close all wallets.',
    { removeVolumes: z.boolean().optional().describe('Remove volumes (clean slate)') },
    async ({ removeVolumes }) => {
      await manager.stop({ removeVolumes: removeVolumes ?? false });
      return { content: [{ type: 'text', text: 'Network stopped.' }] };
    },
  );

  server.tool(
    'restart-network',
    'Restart the network. With removeVolumes, performs a clean-slate restart.',
    {
      pull: z.boolean().optional().describe('Pull latest Docker images'),
      removeVolumes: z.boolean().optional().describe('Remove volumes for clean restart'),
    },
    async ({ pull, removeVolumes }) => {
      await manager.restart({
        pull: pull ?? false,
        removeVolumes: removeVolumes ?? false,
      });
      const services = await manager.getServices();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'running',
            services: services.map((s) => ({ name: s.name, url: s.url, port: s.port })),
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'network-status',
    'Get current network status including per-service container status.',
    {},
    async () => {
      const status = manager.getStatus();
      if (status === 'stopped') {
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'stopped', services: [] }) }],
        };
      }
      const services = await manager.getServices();
      return {
        content: [{ type: 'text', text: JSON.stringify({ status, services }, null, 2) }],
      };
    },
  );

  server.tool(
    'network-logs',
    'Get recent logs from network services.',
    {
      service: z.enum(['node', 'indexer', 'proof-server']).optional().describe('Specific service'),
      lines: z.number().optional().describe('Number of log lines (default: 50)'),
    },
    async ({ service, lines }) => {
      const logs = await manager.getLogs({ service, lines });
      return { content: [{ type: 'text', text: logs }] };
    },
  );
}
```

**Step 5: Create health tools**

```typescript
// src/mcp/tools/health.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkAllHealth } from '../../core/health.js';
import { defaultConfig, DOCKER_IMAGES } from '../../core/config.js';

export function registerHealthTools(server: McpServer): void {
  server.tool(
    'health-check',
    'Check health of all network services by hitting their endpoints.',
    {},
    async () => {
      const health = await checkAllHealth();
      return {
        content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
      };
    },
  );

  server.tool(
    'get-network-config',
    'Get all endpoint URLs, network ID, and Docker image versions for connecting a DApp.',
    {},
    async () => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ ...defaultConfig, images: DOCKER_IMAGES }, null, 2),
        }],
      };
    },
  );
}
```

**Step 6: Create stub files for wallet, funding, and account tools**

```typescript
// src/mcp/tools/wallet.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
export function registerWalletTools(_server: McpServer, _manager: NetworkManager): void {
  // Implemented in Task 8
}

// src/mcp/tools/funding.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
export function registerFundingTools(_server: McpServer, _manager: NetworkManager): void {
  // Implemented in Task 8
}

// src/mcp/tools/accounts.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
export function registerAccountTools(_server: McpServer, _manager: NetworkManager): void {
  // Implemented in Task 8
}
```

**Step 7: Create MCP resources**

```typescript
// src/mcp/resources/config.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { defaultConfig, DOCKER_IMAGES } from '../../core/config.js';

export function registerResources(server: McpServer, manager: NetworkManager): void {
  server.resource(
    'devnet-config',
    'devnet://config',
    { description: 'Current network configuration including endpoints and image versions.', mimeType: 'application/json' },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        text: JSON.stringify({ ...defaultConfig, images: DOCKER_IMAGES }, null, 2),
      }],
    }),
  );

  server.resource(
    'devnet-status',
    'devnet://status',
    { description: 'Live network status including services and health.', mimeType: 'application/json' },
    async (uri) => {
      const status = manager.getStatus();
      let services: any[] = [];
      if (status !== 'stopped') {
        try {
          services = await manager.getServices();
        } catch {
          // Network might be partially up
        }
      }
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ status, services }, null, 2),
        }],
      };
    },
  );
}
```

**Step 8: Create the MCP entry point with signal handling**

> **Review fix #7:** Handle SIGINT/SIGTERM for graceful shutdown.

```typescript
// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './mcp/server.js';
import { NetworkManager } from './core/network-manager.js';

async function main() {
  const manager = new NetworkManager();

  // Detect if network is already running (recovers state after restart)
  await manager.detectRunningNetwork();

  const server = createServer(manager);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown: close wallet but leave Docker containers running
  const shutdown = async () => {
    await manager.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Step 9: Run tests and verify build**

```bash
npx vitest run src/core/__tests__/network-manager.test.ts
npx tsc --noEmit
```

Expected: Tests pass, build compiles.

**Step 10: Commit**

```bash
git add src/core/network-manager.ts src/core/__tests__/network-manager.test.ts src/mcp/ src/index.ts
git commit -m "feat: NetworkManager class, MCP server with network/health tools and resources"
```

---

### Task 8: MCP Wallet, Funding, and Account Tools

> All tools use `manager.ensureWallet()` from NetworkManager — no module-level state.

**Files:**
- Modify: `src/mcp/tools/wallet.ts`
- Modify: `src/mcp/tools/funding.ts`
- Modify: `src/mcp/tools/accounts.ts`

**Step 1: Implement wallet tools**

```typescript
// src/mcp/tools/wallet.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { getWalletBalances } from '../../core/wallet.js';

export function registerWalletTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'get-wallet-balances',
    'Get current NIGHT and DUST balances of the genesis master wallet.',
    {},
    async () => {
      const wallet = await manager.ensureWallet();
      const balances = await getWalletBalances(wallet);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            unshielded: balances.unshielded.toString(),
            shielded: balances.shielded.toString(),
            dust: balances.dust.toString(),
            total: balances.total.toString(),
          }, null, 2),
        }],
      };
    },
  );
}
```

**Step 2: Implement funding tools**

```typescript
// src/mcp/tools/funding.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { fundAccount, fundAccountFromMnemonic, fundAccountsFromFile } from '../../core/funding.js';

export function registerFundingTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'fund-account',
    'Transfer NIGHT tokens from master wallet to a Bech32 address. Default: 50,000 NIGHT.',
    {
      address: z.string().describe('Bech32 address to fund'),
      amount: z.string().optional().describe('Amount in smallest unit (default: 50,000 NIGHT)'),
    },
    async ({ address, amount }) => {
      const wallet = await manager.ensureWallet();
      const result = await fundAccount(
        wallet,
        address,
        amount ? BigInt(amount) : undefined,
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: result.address,
            amount: result.amount.toString(),
            txHash: result.txHash,
            hasDust: result.hasDust,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'fund-account-from-mnemonic',
    'Derive wallet from mnemonic, transfer NIGHT, and register DUST. Full account setup.',
    {
      name: z.string().describe('Display name for the account'),
      mnemonic: z.string().describe('BIP39 mnemonic phrase (24 words)'),
    },
    async ({ name, mnemonic }) => {
      const wallet = await manager.ensureWallet();
      const result = await fundAccountFromMnemonic(
        wallet,
        name,
        mnemonic,
        manager.config,
      );
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            name: result.name,
            address: result.address,
            amount: result.amount.toString(),
            txHash: result.txHash,
            hasDust: result.hasDust,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'fund-accounts-from-file',
    'Batch fund accounts from an accounts.json file. Each gets 50,000 NIGHT + DUST.',
    { filePath: z.string().describe('Path to accounts.json file') },
    async ({ filePath }) => {
      const wallet = await manager.ensureWallet();
      const results = await fundAccountsFromFile(wallet, filePath, manager.config);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(
            results.map((r) => ({
              name: r.name,
              address: r.address,
              amount: r.amount.toString(),
              txHash: r.txHash,
              hasDust: r.hasDust,
            })),
            null,
            2,
          ),
        }],
      };
    },
  );
}
```

**Step 3: Implement account generation tools**

```typescript
// src/mcp/tools/accounts.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { generateAccounts, generateAndFundAccounts, writeAccountsFile } from '../../core/accounts.js';

export function registerAccountTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'generate-test-account',
    'Generate random test accounts with BIP39 mnemonics or private keys. Optionally fund and register DUST.',
    {
      format: z.enum(['mnemonic', 'privateKey']).describe('Credential format'),
      count: z.number().optional().describe('Number of accounts (default: 1)'),
      fund: z.boolean().optional().describe('Fund accounts from master wallet'),
      registerDust: z.boolean().optional().describe('Register DUST for funded accounts'),
      outputFile: z.string().optional().describe('Write accounts to file'),
    },
    async ({ format, count, fund, registerDust: regDust, outputFile }) => {
      let accounts;

      if (fund) {
        const wallet = await manager.ensureWallet();
        accounts = await generateAndFundAccounts(
          wallet,
          manager.config,
          { format, count, fund: true, registerDust: regDust },
        );
      } else {
        accounts = await generateAccounts({ format, count });
      }

      if (outputFile) {
        await writeAccountsFile(outputFile, accounts);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(accounts, null, 2) }],
      };
    },
  );
}
```

**Step 4: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: Success.

**Step 5: Commit**

```bash
git add src/mcp/tools/wallet.ts src/mcp/tools/funding.ts src/mcp/tools/accounts.ts
git commit -m "feat: MCP wallet, funding, and account generation tools"
```

---

### Task 9: CLI Entry Point and Commands

> **Review fix #4:** One-shot CLI commands auto-initialize the wallet via `manager.ensureWallet()` when the network is already running. No need for wallet state to survive across process invocations.
>
> **Review fix #6:** Interactive mode detects running network via `manager.detectRunningNetwork()` before trying to start.
>
> **Review fix #7:** Signal handling for graceful Ctrl+C shutdown.

**Files:**
- Create: `src/cli.ts`
- Create: `src/cli/commands/network.ts`
- Create: `src/cli/commands/wallet.ts`
- Create: `src/cli/commands/accounts.ts`
- Create: `src/cli/interactive.ts`

**Step 1: Create the CLI entry point**

```typescript
// src/cli.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { NetworkManager } from './core/network-manager.js';
import { registerNetworkCommands } from './cli/commands/network.js';
import { registerWalletCommands } from './cli/commands/wallet.js';
import { registerAccountCommands } from './cli/commands/accounts.js';
import { startInteractiveMode } from './cli/interactive.js';

const manager = new NetworkManager();

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
  .name('midnight-devnet')
  .description('Manage a local Midnight development network')
  .version('0.1.0');

registerNetworkCommands(program, manager);
registerWalletCommands(program, manager);
registerAccountCommands(program, manager);

program
  .command('interactive')
  .description('Start interactive menu mode')
  .action(async () => {
    await startInteractiveMode(manager);
  });

// No arguments = interactive mode
if (process.argv.length <= 2) {
  startInteractiveMode(manager).catch(console.error);
} else {
  program.parse();
}
```

**Step 2: Create network CLI commands (uses shared NetworkManager)**

```typescript
// src/cli/commands/network.ts
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { checkAllHealth } from '../../core/health.js';

export function registerNetworkCommands(program: Command, manager: NetworkManager): void {
  program
    .command('start')
    .description('Start the local Midnight development network')
    .option('--pull', 'Pull latest Docker images before starting')
    .action(async (opts) => {
      console.log('Starting Midnight local devnet...');
      const result = await manager.start({ pull: opts.pull ?? false });
      if (result === 'already-running') {
        console.log('Network is already running.');
      } else {
        console.log('Network is ready.');
      }
      const services = await manager.getServices();
      console.table(services.map((s) => ({ Service: s.name, Port: s.port, URL: s.url, Status: s.status })));
    });

  program
    .command('stop')
    .description('Stop the local Midnight development network')
    .option('--remove-volumes', 'Remove volumes and containers')
    .action(async (opts) => {
      await manager.stop({ removeVolumes: opts.removeVolumes ?? false });
      console.log('Network stopped.');
    });

  program
    .command('restart')
    .description('Restart the network')
    .option('--pull', 'Pull latest Docker images')
    .option('--remove-volumes', 'Remove volumes for clean restart')
    .action(async (opts) => {
      await manager.restart({
        pull: opts.pull ?? false,
        removeVolumes: opts.removeVolumes ?? false,
      });
      console.log('Network restarted and ready.');
    });

  program
    .command('status')
    .description('Show network status')
    .action(async () => {
      try {
        const services = await manager.getServices();
        if (services.length === 0) {
          console.log('Network is not running.');
          return;
        }
        console.table(services.map((s) => ({
          Service: s.name,
          Status: s.status,
          Port: s.port,
          URL: s.url,
        })));
      } catch {
        console.log('Network is not running.');
      }
    });

  program
    .command('logs')
    .description('Show network service logs')
    .option('--service <name>', 'Specific service (node, indexer, proof-server)')
    .option('--lines <n>', 'Number of lines', '50')
    .action(async (opts) => {
      const logs = await manager.getLogs({
        service: opts.service,
        lines: parseInt(opts.lines, 10),
      });
      console.log(logs);
    });

  program
    .command('health')
    .description('Check health of all services')
    .action(async () => {
      const health = await checkAllHealth();
      console.table({
        Node: { Healthy: health.node.healthy, 'Response (ms)': health.node.responseTime },
        Indexer: { Healthy: health.indexer.healthy, 'Response (ms)': health.indexer.responseTime },
        'Proof Server': { Healthy: health.proofServer.healthy, 'Response (ms)': health.proofServer.responseTime },
      });
    });
}
```

**Step 3: Create wallet CLI commands (auto-init via ensureWallet)**

```typescript
// src/cli/commands/wallet.ts
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { getWalletBalances } from '../../core/wallet.js';
import { fundAccount, fundAccountsFromFile } from '../../core/funding.js';

export function registerWalletCommands(program: Command, manager: NetworkManager): void {
  program
    .command('balances')
    .description('Show master wallet balances')
    .action(async () => {
      const wallet = await manager.ensureWallet();
      const b = await getWalletBalances(wallet);
      console.table({
        Unshielded: b.unshielded.toString(),
        Shielded: b.shielded.toString(),
        DUST: b.dust.toString(),
        Total: b.total.toString(),
      });
    });

  program
    .command('fund <address>')
    .description('Fund an address with NIGHT tokens')
    .option('--amount <n>', 'Amount in NIGHT (default: 50000)')
    .action(async (address, opts) => {
      const wallet = await manager.ensureWallet();
      const amount = opts.amount ? BigInt(opts.amount) * 10n ** 6n : undefined;
      const result = await fundAccount(wallet, address, amount);
      console.log(`Funded ${result.address} with ${result.amount} NIGHT (tx: ${result.txHash})`);
    });

  program
    .command('fund-file <path>')
    .description('Fund accounts from an accounts.json file')
    .action(async (filePath) => {
      const wallet = await manager.ensureWallet();
      const results = await fundAccountsFromFile(wallet, filePath, manager.config);
      console.table(results.map((r) => ({
        Name: r.name,
        Address: r.address,
        Amount: r.amount.toString(),
        DUST: r.hasDust ? 'Yes' : 'No',
      })));
    });
}
```

**Step 4: Create account CLI commands**

```typescript
// src/cli/commands/accounts.ts
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { generateAccounts, generateAndFundAccounts, writeAccountsFile } from '../../core/accounts.js';

export function registerAccountCommands(program: Command, manager: NetworkManager): void {
  program
    .command('generate-accounts')
    .description('Generate random test accounts')
    .option('--count <n>', 'Number of accounts', '1')
    .option('--format <type>', 'mnemonic or privateKey', 'mnemonic')
    .option('--output <path>', 'Write to file in accounts.json format')
    .option('--fund', 'Fund accounts from master wallet')
    .option('--register-dust', 'Register DUST for funded accounts')
    .action(async (opts) => {
      const format = opts.format as 'mnemonic' | 'privateKey';
      const count = parseInt(opts.count, 10);

      let accounts;
      if (opts.fund) {
        const wallet = await manager.ensureWallet();
        accounts = await generateAndFundAccounts(wallet, manager.config, {
          format,
          count,
          fund: true,
          registerDust: opts.registerDust ?? false,
        });
      } else {
        accounts = await generateAccounts({ format, count });
      }

      if (opts.output) {
        await writeAccountsFile(opts.output, accounts);
        console.log(`Accounts written to ${opts.output}`);
      }

      console.table(accounts.map((a) => ({
        Name: a.name,
        Address: a.address || '(generated on fund)',
        ...(a.mnemonic ? { Mnemonic: a.mnemonic.split(' ').slice(0, 3).join(' ') + '...' } : {}),
      })));
    });
}
```

**Step 5: Create interactive mode (detects running network first)**

```typescript
// src/cli/interactive.ts
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { NetworkManager } from '../core/network-manager.js';
import { fundAccount, fundAccountsFromFile } from '../core/funding.js';
import { generateAccounts, writeAccountsFile } from '../core/accounts.js';
import { getWalletBalances } from '../core/wallet.js';

export async function startInteractiveMode(manager: NetworkManager): Promise<void> {
  const rli = createInterface({ input, output });

  console.log('Midnight Local Devnet — Interactive Mode\n');

  // Detect if network is already running (review fix #6)
  if (manager.getStatus() === 'running') {
    console.log('Detected running network. Initializing wallet...');
    await manager.ensureWallet();
    console.log('Ready.\n');
  } else {
    console.log('Starting network...');
    await manager.start({ pull: false });
    console.log('Network ready.\n');
  }

  const showMenu = () => {
    console.log('\nChoose an option:');
    console.log('  [1] Fund accounts from config file (NIGHT + DUST)');
    console.log('  [2] Fund account by address (NIGHT only)');
    console.log('  [3] Generate test accounts');
    console.log('  [4] Display master wallet balances');
    console.log('  [5] Show network status');
    console.log('  [6] Exit');
  };

  let running = true;
  while (running) {
    showMenu();
    const choice = await rli.question('> ');

    try {
      switch (choice.trim()) {
        case '1': {
          const path = await rli.question('Path to accounts JSON file: ');
          const wallet = await manager.ensureWallet();
          const results = await fundAccountsFromFile(wallet, path.trim(), manager.config);
          console.table(results.map((r) => ({ Name: r.name, Address: r.address, DUST: r.hasDust })));
          break;
        }
        case '2': {
          const addr = await rli.question('Bech32 address: ');
          const wallet = await manager.ensureWallet();
          await fundAccount(wallet, addr.trim());
          console.log('Funded.');
          break;
        }
        case '3': {
          const countStr = await rli.question('How many accounts? [1]: ');
          const count = parseInt(countStr.trim() || '1', 10);
          const accounts = await generateAccounts({ format: 'mnemonic', count });
          const outPath = await rli.question('Save to file? (path or empty to skip): ');
          if (outPath.trim()) {
            await writeAccountsFile(outPath.trim(), accounts);
          }
          console.table(accounts.map((a) => ({ Name: a.name, Mnemonic: a.mnemonic })));
          break;
        }
        case '4': {
          const wallet = await manager.ensureWallet();
          const b = await getWalletBalances(wallet);
          console.table({
            Unshielded: b.unshielded.toString(),
            Shielded: b.shielded.toString(),
            DUST: b.dust.toString(),
          });
          break;
        }
        case '5': {
          const services = await manager.getServices();
          console.table(services);
          break;
        }
        case '6':
          running = false;
          break;
        default:
          console.log('Invalid option.');
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
    }
  }

  console.log('\nShutting down wallet (containers left running)...');
  await manager.shutdown();
  rli.close();
  console.log('Goodbye.');
}
```

**Step 6: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: Success.

**Step 7: Commit**

```bash
git add src/cli.ts src/cli/
git commit -m "feat: CLI with one-shot commands, interactive mode, and signal handling"
```

---

### Task 10: Logging Setup

**Files:**
- Create: `src/core/logger.ts`
- Modify: `src/index.ts` — add logger initialization
- Modify: `src/cli.ts` — add logger initialization

**Step 1: Create logger module**

```typescript
// src/core/logger.ts
import pino from 'pino';

export function createLogger(level: string = 'info'): pino.Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  });
}
```

**Step 2: Wire loggers into modules**

Update `src/index.ts` and `src/cli.ts` to create a logger and pass it to `setLogger()` on the wallet, funding, and accounts modules, and to `manager.setLogger()`.

In `src/index.ts`, add before `createServer()`:
```typescript
import { createLogger } from './core/logger.js';
import { setLogger as setWalletLogger } from './core/wallet.js';
import { setLogger as setFundingLogger } from './core/funding.js';
import { setLogger as setAccountsLogger } from './core/accounts.js';

const logger = createLogger();
setWalletLogger(logger);
setFundingLogger(logger);
setAccountsLogger(logger);
manager.setLogger(logger);
```

In `src/cli.ts`, add after `const manager = new NetworkManager()`:
```typescript
import { createLogger } from './core/logger.js';
import { setLogger as setWalletLogger } from './core/wallet.js';
import { setLogger as setFundingLogger } from './core/funding.js';
import { setLogger as setAccountsLogger } from './core/accounts.js';

const logger = createLogger();
setWalletLogger(logger);
setFundingLogger(logger);
setAccountsLogger(logger);
manager.setLogger(logger);
```

**Step 3: Verify build compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/core/logger.ts src/index.ts src/cli.ts
git commit -m "feat: pino logging throughout core modules"
```

---

### Task 11: README and Final Polish

**Files:**
- Modify: `README.md`
- Create: `accounts.example.json`

**Step 1: Write README.md**

Write a README covering:
- What the tool does (one paragraph)
- Prerequisites (Node >= 22, Docker)
- Installation (`npm install`)
- Quick start (CLI: `npx midnight-devnet start`, MCP: add to `.mcp.json`)
- CLI command reference (table of all commands)
- MCP tool reference (table of all tools)
- MCP resource reference
- accounts.json format
- Docker services table
- Troubleshooting section

**Step 2: Create accounts.example.json**

```json
{
  "accounts": [
    {
      "name": "Alice",
      "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"
    },
    {
      "name": "Bob",
      "mnemonic": "zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote"
    }
  ]
}
```

**Step 3: Commit**

```bash
git add README.md accounts.example.json
git commit -m "docs: README with CLI and MCP reference"
```

---

### Task 12: Integration Testing

**Files:**
- Create: `src/__tests__/integration.test.ts`

This test requires Docker running and exercises the full lifecycle.

**Step 1: Write the integration test**

```typescript
// src/__tests__/integration.test.ts
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { NetworkManager } from '../core/network-manager.js';
import { getWalletBalances } from '../core/wallet.js';
import { generateAccounts, writeAccountsFile } from '../core/accounts.js';
import { checkAllHealth } from '../core/health.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// These tests require Docker and take several minutes
// Run with: npx vitest run src/__tests__/integration.test.ts --timeout 300000
describe.skip('integration', () => {
  let manager: NetworkManager;

  beforeAll(async () => {
    manager = new NetworkManager();
    await manager.start({ pull: false });
  }, 300_000);

  afterAll(async () => {
    if (manager) {
      await manager.stop({ removeVolumes: true });
    }
  }, 60_000);

  it('network services are all running', async () => {
    const services = await manager.getServices();
    expect(services).toHaveLength(3);
    services.forEach((s) => expect(s.status).toBe('running'));
  });

  it('health check passes', async () => {
    const health = await checkAllHealth();
    expect(health.allHealthy).toBe(true);
  });

  it('master wallet has NIGHT balance', async () => {
    const wallet = await manager.ensureWallet();
    const balances = await getWalletBalances(wallet);
    expect(balances.unshielded).toBeGreaterThan(0n);
  });

  it('generates accounts and writes to file', async () => {
    const accounts = await generateAccounts({ format: 'mnemonic', count: 2 });
    expect(accounts).toHaveLength(2);

    const outPath = join(tmpdir(), 'test-accounts.json');
    await writeAccountsFile(outPath, accounts);

    const { readFile } = await import('node:fs/promises');
    const content = JSON.parse(await readFile(outPath, 'utf-8'));
    expect(content.accounts).toHaveLength(2);
  });
});
```

**Step 2: Run unit tests to verify nothing is broken**

```bash
npx vitest run --testPathPattern 'core/__tests__'
```

Expected: All unit tests pass.

**Step 3: Commit**

```bash
git add src/__tests__/integration.test.ts
git commit -m "test: integration test suite for full lifecycle"
```

---

## Summary

| Task | Description | Key Changes from Original Plan |
|---|---|---|
| 1 | Project scaffold, types, config, docker compose | `moduleResolution: "node16"`, added vitest.config.ts |
| 2 | Core Docker module + unit tests | Fixed ESM mocking with `vi.hoisted()` pattern |
| 3 | Core wallet module + unit tests | **Complete rewrite**: factory functions, discriminated unions, recipe pattern, correct `createKeystore` sig |
| 4 | Core funding module + unit tests | **Complete rewrite**: 4-step recipe transfer, no `wallet.transferUnshielded()` |
| 5 | Core account generation + unit tests | Fixed `privateKey` format to derive actual hex seed |
| 6 | Core health check + unit tests | Added timeout and error edge case tests |
| 7 | NetworkManager + MCP server + network tools | **New**: `NetworkManager` class replaces module-level state, detects running containers |
| 8 | MCP wallet/funding/account tools | Uses `manager.ensureWallet()`, no duplicate state |
| 9 | CLI commands + interactive mode | Auto-init wallet via `ensureWallet()`, detect running network, signal handling |
| 10 | Logging setup | Unchanged |
| 11 | README + example files | Unchanged |
| 12 | Integration test suite | Uses `NetworkManager` |

### Review Recommendations Addressed

| # | Priority | Issue | Resolution |
|---|----------|-------|------------|
| 1 | Critical | Wallet SDK API is wrong | Tasks 3, 4 fully rewritten against reference repo patterns |
| 2 | Major | Module-level mutable state | `NetworkManager` class in Task 7, used by all layers |
| 3 | Medium | Thin tests / no MCP tests | Improved behavioral tests in Tasks 2, 5, 6, 7 |
| 4 | Medium | CLI state doesn't survive | `ensureWallet()` auto-inits in one-shot commands (Task 9) |
| 5 | Minor | `privateKey` format wrong | Derives actual hex seed from mnemonic (Task 5) |
| 6 | Minor | Interactive mode assumes stopped | `detectRunningNetwork()` called first (Task 9) |
| 7 | Minor | No signal handling | SIGINT/SIGTERM handlers in Tasks 7, 9 |
| 8 | Minor | Wrong moduleResolution | Changed to `"node16"` (Task 1) |

> **Important notes for the implementer:**
>
> - The wallet SDK patterns (factory functions, discriminated unions, recipe-based transfers, DUST registration) are taken directly from the reference repo (`hbulgarini/midnight-local-network/src/wallet.ts` and `src/funding.ts`). Verify method signatures against installed SDK types and adjust if needed.
> - `@midnight-ntwrk/*` packages are on the public npm registry. No `.npmrc` or private registry config needed.
> - Integration tests (Task 12) require Docker and pull ~2GB of images on first run.
> - The `docker compose ps --format json` output format varies between Docker Compose v2 versions. The parser in `docker.ts` handles both array and newline-delimited formats.
> - The MCP server uses `server.tool()` shorthand (name, description, schema, handler) rather than `server.registerTool()` with separate config objects. Verify which API the installed `@modelcontextprotocol/sdk` version supports and adjust accordingly.
