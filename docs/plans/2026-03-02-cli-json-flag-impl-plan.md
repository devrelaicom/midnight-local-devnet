# CLI `--json` Flag Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global `--json` flag so every data-returning CLI command outputs machine-parseable JSON on stdout.

**Architecture:** A shared output helper (`src/cli/output.ts`) handles JSON vs human formatting. The root Commander program gets a `--json` option; each command handler reads it via `optsWithGlobals()`. When active, the pino logger writes to stderr instead of stdout, and all `console.log`/`console.table` calls are replaced with the output helper.

**Tech Stack:** Commander.js, pino, vitest

---

### Task 1: Create the output helper with tests

**Files:**
- Create: `src/cli/output.ts`
- Create: `src/cli/__tests__/output.test.ts`

**Step 1: Write the failing tests**

Create `src/cli/__tests__/output.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { output, outputError } from '../output.js';

describe('output()', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints JSON to stdout when json is true', () => {
    const data = { name: 'test', value: 42 };
    output(data, { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual(data);
  });

  it('converts bigint values to strings in JSON mode', () => {
    const data = { balance: 1000000n };
    output(data, { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ balance: '1000000' });
  });

  it('calls console.log in human mode (json false)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    output('hello', { json: false });
    expect(spy).toHaveBeenCalledWith('hello');
  });

  it('calls console.log in human mode (json undefined)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    output('hello', {});
    expect(spy).toHaveBeenCalledWith('hello');
  });
});

describe('outputError()', () => {
  let stdoutWrite: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    process.exitCode = undefined;
  });
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('prints JSON error to stdout and sets exitCode when json is true', () => {
    outputError(new Error('boom'), { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ error: 'boom' });
    expect(process.exitCode).toBe(1);
  });

  it('handles string errors in JSON mode', () => {
    outputError('something broke', { json: true });
    const written = stdoutWrite.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual({ error: 'something broke' });
  });

  it('prints to stderr in human mode', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    outputError(new Error('boom'), { json: false });
    expect(spy).toHaveBeenCalledWith('Error:', 'boom');
    expect(process.exitCode).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/cli/__tests__/output.test.ts`
Expected: FAIL — module `../output.js` does not exist

**Step 3: Implement the output helper**

Create `src/cli/output.ts`:

```typescript
export interface OutputOptions {
  json?: boolean;
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function output(data: unknown, opts: OutputOptions): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, bigintReplacer, 2) + '\n');
  } else {
    console.log(data);
  }
}

export function outputError(error: unknown, opts: OutputOptions): void {
  const message = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
  if (opts.json) {
    process.stdout.write(JSON.stringify({ error: message }, null, 2) + '\n');
  } else {
    console.error('Error:', message);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/cli/__tests__/output.test.ts`
Expected: all 7 tests PASS

**Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 6: Commit**

```bash
git add src/cli/output.ts src/cli/__tests__/output.test.ts
git commit -m "feat: add CLI output helper for --json support"
```

---

### Task 2: Add global `--json` flag and redirect logger

**Files:**
- Modify: `src/cli.ts`

**Step 1: Add the `--json` option and conditional logger destination**

In `src/cli.ts`, the changes are:

1. Add `--json` option to the root program (must be **before** `program.parse()` and **before** subcommand registration so Commander propagates it).
2. Parse the `--json` flag early using `program.opts()` after a preliminary parse, then create the logger with the correct destination.

However, Commander doesn't support pre-parsing easily. The simpler approach: check `process.argv` directly for `--json` before creating the logger.

Replace the logger creation block in `src/cli.ts`:

```typescript
// Before (lines 16-20):
const logger = createLogger('info', process.stdout);

// After:
const jsonMode = process.argv.includes('--json');
const logger = createLogger('info', jsonMode ? process.stderr : process.stdout);
```

Add the `--json` option on the root program (after line 38, before the `register*` calls):

```typescript
program
  .name('midnight-local-devnet')
  .description('Manage a local Midnight development network')
  .version('0.2.1')
  .option('--json', 'Output results as JSON');
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: all pass (no behavioral changes yet)

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add global --json flag and redirect logger to stderr"
```

---

### Task 3: Update network commands (start, stop, restart, status, logs, health)

**Files:**
- Modify: `src/cli/commands/network.ts`

**Step 1: Update the file**

Add imports and update every action handler to use `output`/`outputError` and read `--json` via `this.optsWithGlobals()`:

```typescript
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { checkAllHealth } from '../../core/health.js';
import { output, outputError, type OutputOptions } from '../output.js';
import { parseLogLines } from '../dashboard/lib/log-parser.js';

export function registerNetworkCommands(program: Command, manager: NetworkManager): void {
  program
    .command('start')
    .description('Start the local Midnight development network')
    .option('--pull', 'Pull latest Docker images before starting')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        if (!globals.json) console.log('Starting Midnight local devnet...');
        const result = await manager.start({ pull: opts.pull ?? false });
        const status = result === 'already-running' ? 'already-running' : 'started';
        if (!globals.json) {
          console.log(result === 'already-running' ? 'Network is already running.' : 'Network is ready.');
        }
        const services = await manager.getServices();
        if (globals.json) {
          output({ status, services: services.map((s) => ({ name: s.name, port: s.port, url: s.url, status: s.status })) }, globals);
        } else {
          console.table(services.map((s) => ({ Service: s.name, Port: s.port, URL: s.url, Status: s.status })));
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('stop')
    .description('Stop the local Midnight development network')
    .option('--remove-volumes', 'Remove volumes and containers')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        await manager.stop({ removeVolumes: opts.removeVolumes ?? false });
        if (globals.json) {
          output({ status: 'stopped' }, globals);
        } else {
          console.log('Network stopped.');
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('restart')
    .description('Restart the network')
    .option('--pull', 'Pull latest Docker images')
    .option('--remove-volumes', 'Remove volumes for clean restart')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        await manager.restart({
          pull: opts.pull ?? false,
          removeVolumes: opts.removeVolumes ?? false,
        });
        if (globals.json) {
          output({ status: 'restarted' }, globals);
        } else {
          console.log('Network restarted and ready.');
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('status')
    .description('Show network status')
    .action(async function (this: Command) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const services = await manager.getServices();
        if (globals.json) {
          output({
            running: services.length > 0,
            services: services.map((s) => ({ name: s.name, port: s.port, url: s.url, status: s.status })),
          }, globals);
        } else {
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
        }
      } catch {
        if (globals.json) {
          output({ running: false, services: [] }, globals);
        } else {
          console.log('Network is not running.');
        }
      }
    });

  program
    .command('logs')
    .description('Show network service logs')
    .option('--service <name>', 'Specific service (node, indexer, proof-server)')
    .option('--lines <n>', 'Number of lines', '50')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const logs = await manager.getLogs({
          service: opts.service,
          lines: parseInt(opts.lines, 10),
        });
        if (globals.json) {
          output(parseLogLines(logs), globals);
        } else {
          console.log(logs);
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('health')
    .description('Check health of all services')
    .action(async function (this: Command) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const health = await checkAllHealth(manager.config);
        if (globals.json) {
          output(health, globals);
        } else {
          console.table({
            Node: { Healthy: health.node.healthy, 'Response (ms)': health.node.responseTime },
            Indexer: { Healthy: health.indexer.healthy, 'Response (ms)': health.indexer.responseTime },
            'Proof Server': { Healthy: health.proofServer.healthy, 'Response (ms)': health.proofServer.responseTime },
          });
        }
      } catch (err) {
        outputError(err, globals);
      }
    });
}
```

Key patterns:
- Each action uses `async function (this: Command, ...)` instead of arrow function so `this` refers to the Command instance.
- `this.optsWithGlobals()` retrieves the parent `--json` flag.
- Human-readable progress messages (e.g. "Starting Midnight local devnet...") are guarded with `if (!globals.json)`.
- Error handling wraps the body in try/catch calling `outputError`.

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: all pass

**Step 4: Commit**

```bash
git add src/cli/commands/network.ts
git commit -m "feat: add --json support to network commands"
```

---

### Task 4: Update wallet commands (balances, fund, fund-file)

**Files:**
- Modify: `src/cli/commands/wallet.ts`

**Step 1: Update the file**

```typescript
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { getWalletBalances } from '../../core/wallet.js';
import { fundAccount, fundAccountsFromFile } from '../../core/funding.js';
import { output, outputError, type OutputOptions } from '../output.js';

export function registerWalletCommands(program: Command, manager: NetworkManager): void {
  program
    .command('balances')
    .description('Show master wallet balances')
    .action(async function (this: Command) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const wallet = await manager.ensureWallet();
        const b = await getWalletBalances(wallet);
        if (globals.json) {
          output({
            unshielded: b.unshielded.toString(),
            shielded: b.shielded.toString(),
            dust: b.dust.toString(),
            total: b.total.toString(),
          }, globals);
        } else {
          console.table({
            Unshielded: b.unshielded.toString(),
            Shielded: b.shielded.toString(),
            DUST: b.dust.toString(),
            Total: b.total.toString(),
          });
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('fund <address>')
    .description('Fund an address with NIGHT tokens')
    .option('--amount <n>', 'Amount in NIGHT (default: 50000)')
    .action(async function (this: Command, address: string, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const wallet = await manager.ensureWallet();
        let amount: bigint | undefined;
        if (opts.amount) {
          if (!/^[1-9]\d*$/.test(opts.amount)) {
            outputError('--amount must be a positive whole number of NIGHT tokens.', globals);
            return;
          }
          amount = BigInt(opts.amount) * 10n ** 6n;
        }
        const result = await fundAccount(wallet, address, amount);
        if (globals.json) {
          output({ address: result.address, amount: result.amount.toString(), txHash: result.txHash }, globals);
        } else {
          console.log(`Funded ${result.address} with ${result.amount} NIGHT (tx: ${result.txHash})`);
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('fund-file <path>')
    .description('Fund accounts from an accounts.json file')
    .action(async function (this: Command, filePath: string) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const wallet = await manager.ensureWallet();
        const results = await fundAccountsFromFile(wallet, filePath, manager.config);
        if (globals.json) {
          output(results.map((r) => ({
            name: r.name,
            address: r.address,
            amount: r.amount.toString(),
            hasDust: r.hasDust,
          })), globals);
        } else {
          console.table(results.map((r) => ({
            Name: r.name,
            Address: r.address,
            Amount: r.amount.toString(),
            DUST: r.hasDust ? 'Yes' : 'No',
          })));
        }
      } catch (err) {
        outputError(err, globals);
      }
    });
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: all pass

**Step 4: Commit**

```bash
git add src/cli/commands/wallet.ts
git commit -m "feat: add --json support to wallet commands"
```

---

### Task 5: Update accounts command (generate-accounts)

**Files:**
- Modify: `src/cli/commands/accounts.ts`

**Step 1: Update the file**

```typescript
import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { generateAccounts, generateAndFundAccounts, writeAccountsFile } from '../../core/accounts.js';
import { output, outputError, type OutputOptions } from '../output.js';

export function registerAccountCommands(program: Command, manager: NetworkManager): void {
  program
    .command('generate-accounts')
    .description('Generate random test accounts')
    .option('--count <n>', 'Number of accounts', '1')
    .option('--format <type>', 'mnemonic or privateKey', 'mnemonic')
    .option('--output <path>', 'Write to file in accounts.json format')
    .option('--fund', 'Fund accounts from master wallet')
    .option('--register-dust', 'Register DUST for funded accounts')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
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
          if (!globals.json) console.log(`Accounts written to ${opts.output}`);
        }

        if (globals.json) {
          output(accounts.map((a) => ({
            name: a.name,
            address: a.address || null,
            ...(a.mnemonic ? { mnemonic: a.mnemonic } : {}),
          })), globals);
        } else {
          console.table(accounts.map((a) => ({
            Name: a.name,
            Address: a.address || '(generated on fund)',
            ...(a.mnemonic ? { Mnemonic: a.mnemonic.split(' ').slice(0, 3).join(' ') + '...' } : {}),
          })));
        }
      } catch (err) {
        outputError(err, globals);
      }
    });
}
```

Key difference: JSON mode outputs the **full** mnemonic (not truncated), since the purpose is machine consumption.

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: all pass

**Step 4: Commit**

```bash
git add src/cli/commands/accounts.ts
git commit -m "feat: add --json support to generate-accounts command"
```

---

### Task 6: Final verification

**Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: clean

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass

**Step 3: Spot-check `--help` output**

Run: `node dist/cli.js --help`
Expected: shows `--json` in the global options section

**Step 4: Commit any remaining changes and verify clean state**

```bash
git status
```
Expected: clean working tree
