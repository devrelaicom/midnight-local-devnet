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

// ── Lightweight address derivation (no network calls) ────────────────────

export function deriveAddressFromMnemonic(mnemonic: string, networkId: string): string {
  setNetworkId(networkId);
  const seed = mnemonicToSeed(mnemonic);
  const hdResult = HDWallet.fromSeed(seed);
  if (hdResult.type !== 'seedOk') {
    throw new DevnetError('Invalid mnemonic', 'HD_WALLET_ERROR');
  }
  const { hdWallet } = hdResult;
  try {
    const derivation = hdWallet
      .selectAccount(0)
      .selectRoles([Roles.NightExternal] as const)
      .deriveKeysAt(0);
    if (derivation.type !== 'keysDerived') {
      throw new DevnetError('Key derivation failed', 'KEY_DERIVATION_ERROR');
    }
    const keystore = createKeystore(derivation.keys[Roles.NightExternal], networkId as any);
    return UnshieldedPublicKey.fromKeyStore(keystore).publicKey;
  } finally {
    hdWallet.clear();
  }
}

// ── Wallet address extraction ──────────────────────────────────────────────

export function getWalletAddress(ctx: WalletContext): string {
  return UnshieldedPublicKey.fromKeyStore(ctx.unshieldedKeystore).publicKey;
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
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust] as const)
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

  // Shielded wallet config: networkId + sync + proving + submission
  const shieldedConfig = {
    networkId: config.networkId as any,
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    provingServerUrl: new URL(config.proofServer),
    relayURL,
  };

  // Unshielded wallet config: networkId + sync + transacting + txHistoryStorage
  const unshieldedConfig = {
    networkId: config.networkId as any,
    indexerClientConnection: {
      indexerHttpUrl: config.indexer,
      indexerWsUrl: config.indexerWS,
    },
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  };

  // Dust wallet config: networkId + costParameters + sync + proving + submission
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
  const shieldedWallet = ShieldedWallet(shieldedConfig as any).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet(unshieldedConfig as any).startWithPublicKey(
    UnshieldedPublicKey.fromKeyStore(unshieldedKeystore),
  );
  const dustWallet = DustWallet(dustConfig as any).startWithSecretKey(
    dustSecretKey,
    ledger.LedgerParameters.initialParameters().dust,
  );

  // 5. WalletFacade: 3 sub-wallets
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

export function waitForFunds(wallet: WalletFacade, timeoutMs = 60_000): Promise<bigint> {
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
      Rx.timeout(timeoutMs),
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

export async function registerNightForDust(ctx: WalletContext): Promise<boolean> {
  logger?.info('Registering NIGHT UTXOs for DUST generation...');
  try {
    const state = await Rx.firstValueFrom(ctx.wallet.state());

    const unregistered = state.unshielded?.availableCoins?.filter(
      (coin: any) => !coin.meta?.registeredForDustGeneration,
    );

    if (!unregistered || unregistered.length === 0) {
      logger?.info('No unregistered UTXOs found (may already be registered)');
      return true;
    }

    const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      UnshieldedPublicKey.fromKeyStore(ctx.unshieldedKeystore).publicKey,
      (payload: Uint8Array) => ctx.unshieldedKeystore.signData(payload),
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
    await ctx.wallet.stop();
  } catch {
    // Ignore stop errors
  }
}
