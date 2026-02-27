// src/mcp/tools/wallet.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NetworkManager } from '../../core/network-manager.js';
import { getWalletBalances } from '../../core/wallet.js';

export function registerWalletTools(server: McpServer, manager: NetworkManager): void {
  server.tool(
    'get-wallet-balances',
    'Get current NIGHT and DUST balances of the genesis master wallet.',
    {},
    async () => {
      const wallet = await manager.ensureWallet();
      const balances = await getWalletBalances(wallet);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            unshielded: balances.unshielded.toString(),
            shielded: balances.shielded.toString(),
            dust: balances.dust.toString(),
            total: balances.total.toString(),
          }, null, 2),
        }],
      };
    },
  );
}
