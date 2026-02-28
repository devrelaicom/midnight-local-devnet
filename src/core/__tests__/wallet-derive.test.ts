import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wallet SDK dependencies before importing the module under test
vi.mock('@midnight-ntwrk/wallet-sdk-hd', () => ({
  HDWallet: {
    fromSeed: vi.fn(),
  },
  Roles: {
    NightExternal: 'NightExternal',
    Zswap: 'Zswap',
    Dust: 'Dust',
  },
}));

vi.mock('@midnight-ntwrk/wallet-sdk-unshielded-wallet', () => ({
  createKeystore: vi.fn(),
  InMemoryTransactionHistoryStorage: vi.fn(),
  PublicKey: {
    fromKeyStore: vi.fn(),
  },
  UnshieldedWallet: vi.fn(),
}));

vi.mock('@midnight-ntwrk/midnight-js-network-id', () => ({
  setNetworkId: vi.fn(),
}));

vi.mock('@midnight-ntwrk/wallet-sdk-facade', () => ({
  WalletFacade: vi.fn(),
}));

vi.mock('@midnight-ntwrk/wallet-sdk-shielded', () => ({
  ShieldedWallet: vi.fn(),
}));

vi.mock('@midnight-ntwrk/wallet-sdk-dust-wallet', () => ({
  DustWallet: vi.fn(),
}));

vi.mock('@midnight-ntwrk/ledger-v7', () => ({}));

vi.mock('ws', () => ({
  WebSocket: vi.fn(),
}));

import { HDWallet } from '@midnight-ntwrk/wallet-sdk-hd';
import { createKeystore, PublicKey as UnshieldedPublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { deriveAddressFromMnemonic } from '../wallet.js';

describe('deriveAddressFromMnemonic', () => {
  const validMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const networkId = 'undeployed';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a non-empty string from a valid mnemonic', () => {
    const mockKeys = { NightExternal: new Uint8Array(32) };
    const mockHdWallet = {
      selectAccount: vi.fn().mockReturnThis(),
      selectRoles: vi.fn().mockReturnThis(),
      deriveKeysAt: vi.fn().mockReturnValue({
        type: 'keysDerived',
        keys: mockKeys,
      }),
      clear: vi.fn(),
    };

    vi.mocked(HDWallet.fromSeed).mockReturnValue({
      type: 'seedOk',
      hdWallet: mockHdWallet,
    } as any);

    const mockKeystore = { fake: 'keystore' };
    vi.mocked(createKeystore).mockReturnValue(mockKeystore as any);
    vi.mocked(UnshieldedPublicKey.fromKeyStore).mockReturnValue({
      publicKey: 'midnight1testaddress123',
    } as any);

    const address = deriveAddressFromMnemonic(validMnemonic, networkId);

    expect(address).toBe('midnight1testaddress123');
    expect(typeof address).toBe('string');
    expect(address.length).toBeGreaterThan(0);

    // Verify HD wallet was cleared after derivation
    expect(mockHdWallet.clear).toHaveBeenCalled();
    // Verify correct derivation path
    expect(mockHdWallet.selectAccount).toHaveBeenCalledWith(0);
    expect(mockHdWallet.deriveKeysAt).toHaveBeenCalledWith(0);
    // Verify keystore created with correct networkId
    expect(createKeystore).toHaveBeenCalledWith(mockKeys.NightExternal, networkId);
  });

  it('throws DevnetError with HD_WALLET_ERROR on invalid seed', () => {
    vi.mocked(HDWallet.fromSeed).mockReturnValue({
      type: 'seedError',
    } as any);

    expect(() => deriveAddressFromMnemonic(validMnemonic, networkId)).toThrowError('Invalid mnemonic');

    try {
      deriveAddressFromMnemonic(validMnemonic, networkId);
    } catch (err: any) {
      expect(err.code).toBe('HD_WALLET_ERROR');
      expect(err.name).toBe('DevnetError');
    }
  });

  it('throws DevnetError with KEY_DERIVATION_ERROR on key derivation failure', () => {
    const mockHdWallet = {
      selectAccount: vi.fn().mockReturnThis(),
      selectRoles: vi.fn().mockReturnThis(),
      deriveKeysAt: vi.fn().mockReturnValue({
        type: 'derivationError',
      }),
      clear: vi.fn(),
    };

    vi.mocked(HDWallet.fromSeed).mockReturnValue({
      type: 'seedOk',
      hdWallet: mockHdWallet,
    } as any);

    expect(() => deriveAddressFromMnemonic(validMnemonic, networkId)).toThrowError(
      'Key derivation failed',
    );

    // Reset mock to test again for error code
    vi.mocked(HDWallet.fromSeed).mockReturnValue({
      type: 'seedOk',
      hdWallet: mockHdWallet,
    } as any);

    try {
      deriveAddressFromMnemonic(validMnemonic, networkId);
    } catch (err: any) {
      expect(err.code).toBe('KEY_DERIVATION_ERROR');
      expect(err.name).toBe('DevnetError');
    }

    // HD wallet should still be cleared even before the error
    expect(mockHdWallet.clear).toHaveBeenCalled();
  });
});
