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
