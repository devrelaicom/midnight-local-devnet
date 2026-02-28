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
      expect(typeof wallet.deriveAddressFromMnemonic).toBe('function');
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
