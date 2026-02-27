// src/core/__tests__/accounts.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

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
      const { writeFile } = await import('node:fs/promises');
      const writeSpy = vi.mocked(writeFile);
      writeSpy.mockClear();

      await writeAccountsFile('/tmp/test-accounts.json', [
        { name: 'Account 1', mnemonic: 'word '.repeat(24).trim(), address: '' },
      ]);

      expect(writeSpy).toHaveBeenCalledOnce();
      const written = JSON.parse(writeSpy.mock.calls[0][1] as string);
      expect(written.accounts).toHaveLength(1);
      expect(written.accounts[0].name).toBe('Account 1');
      expect(written.accounts[0].mnemonic).toBeDefined();
    });
  });
});
