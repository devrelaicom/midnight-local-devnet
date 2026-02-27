import { writeFile } from 'node:fs/promises';
import type { GeneratedAccount, AccountsFileFormat, NetworkConfig, FundedAccount } from './types.js';
import {
  generateNewMnemonic,
  mnemonicToSeed,
  initWalletFromMnemonic,
  waitForFunds,
  registerNightForDust,
  closeWallet,
} from './wallet.js';
import { fundAccount } from './funding.js';
import type { WalletContext } from './wallet.js';
import { PublicKey as UnshieldedPublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
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
    if (!mnemonic) {
      results.push({ ...account, funded: false, dustRegistered: false });
      continue;
    }

    if (opts.fund) {
      logger?.info({ name: account.name }, 'Funding account...');
      const ctx = await initWalletFromMnemonic(mnemonic, config);

      try {
        const address = UnshieldedPublicKey.fromKeyStore(ctx.unshieldedKeystore).address;
        account.address = address;

        await fundAccount(masterWallet, address, DEFAULT_NIGHT_AMOUNT);
        await waitForFunds(ctx.wallet);

        if (opts.registerDust) {
          const dustOk = await registerNightForDust(ctx);
          results.push({ ...account, funded: true, dustRegistered: dustOk });
        } else {
          results.push({ ...account, funded: true, dustRegistered: false });
        }
      } finally {
        await closeWallet(ctx);
      }
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
