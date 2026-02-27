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
