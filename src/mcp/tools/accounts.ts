// src/mcp/tools/accounts.ts
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { generateAccounts, generateAndFundAccounts, writeAccountsFile } from '../../core/accounts.js';

export function registerAccountTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'generate-test-account',
    'Generate random test accounts with BIP39 mnemonics or private keys. Optionally fund and register DUST.',
    {
      format: z.enum(['mnemonic', 'privateKey']).describe('Credential format'),
      count: z.number().optional().describe('Number of accounts (default: 1)'),
      fund: z.boolean().optional().describe('Fund accounts from master wallet'),
      registerDust: z.boolean().optional().describe('Register DUST for funded accounts'),
      outputFile: z.string().optional().describe('Write accounts to file'),
    },
    async ({ format, count, fund, registerDust: regDust, outputFile }) => {
      let accounts;

      if (fund) {
        const wallet = await manager.ensureWallet();
        accounts = await generateAndFundAccounts(
          wallet,
          manager.config,
          { format, count, fund: true, registerDust: regDust },
        );
      } else {
        accounts = await generateAccounts({ format, count });
      }

      if (outputFile) {
        await writeAccountsFile(outputFile, accounts);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(accounts, null, 2) }],
      };
    },
  );
}
