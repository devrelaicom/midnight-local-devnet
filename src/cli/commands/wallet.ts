import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { getWalletBalances } from '../../core/wallet.js';
import { fundAccount, fundAccountsFromFile } from '../../core/funding.js';

export function registerWalletCommands(program: Command, manager: NetworkManager): void {
  program
    .command('balances')
    .description('Show master wallet balances')
    .action(async () => {
      const wallet = await manager.ensureWallet();
      const b = await getWalletBalances(wallet);
      console.table({
        Unshielded: b.unshielded.toString(),
        Shielded: b.shielded.toString(),
        DUST: b.dust.toString(),
        Total: b.total.toString(),
      });
    });

  program
    .command('fund <address>')
    .description('Fund an address with NIGHT tokens')
    .option('--amount <n>', 'Amount in NIGHT (default: 50000)')
    .action(async (address: string, opts) => {
      const wallet = await manager.ensureWallet();
      const amount = opts.amount ? BigInt(opts.amount) * 10n ** 6n : undefined;
      const result = await fundAccount(wallet, address, amount);
      console.log(`Funded ${result.address} with ${result.amount} NIGHT (tx: ${result.txHash})`);
    });

  program
    .command('fund-file <path>')
    .description('Fund accounts from an accounts.json file')
    .action(async (filePath: string) => {
      const wallet = await manager.ensureWallet();
      const results = await fundAccountsFromFile(wallet, filePath, manager.config);
      console.table(results.map((r) => ({
        Name: r.name,
        Address: r.address,
        Amount: r.amount.toString(),
        DUST: r.hasDust ? 'Yes' : 'No',
      })));
    });
}
