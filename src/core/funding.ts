import { readFile } from 'node:fs/promises';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { PublicKey as UnshieldedPublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
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

  // Step 1: Build recipe via transferTransaction
  const recipe = await masterWallet.wallet.transferTransaction(
    [
      {
        type: 'unshielded' as const,
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
  const signed = await masterWallet.wallet.signRecipe(
    recipe,
    (data: Uint8Array) => masterWallet.unshieldedKeystore.signData(data),
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
  const address = UnshieldedPublicKey.fromKeyStore(recipientCtx.unshieldedKeystore).address;

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
