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
          type: 'text' as const,
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
          type: 'text' as const,
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
          type: 'text' as const,
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
