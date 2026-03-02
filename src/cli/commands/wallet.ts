import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { getWalletBalances } from '../../core/wallet.js';
import { fundAccount, fundAccountsFromFile } from '../../core/funding.js';
import { output, outputError, type OutputOptions } from '../output.js';

export function registerWalletCommands(program: Command, manager: NetworkManager): void {
  program
    .command('balances')
    .description('Show master wallet balances')
    .action(async function (this: Command) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const wallet = await manager.ensureWallet();
        const b = await getWalletBalances(wallet);
        if (globals.json) {
          output({
            unshielded: b.unshielded.toString(),
            shielded: b.shielded.toString(),
            dust: b.dust.toString(),
            total: b.total.toString(),
          }, globals);
        } else {
          console.table({
            Unshielded: b.unshielded.toString(),
            Shielded: b.shielded.toString(),
            DUST: b.dust.toString(),
            Total: b.total.toString(),
          });
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('fund <address>')
    .description('Fund an address with NIGHT tokens')
    .option('--amount <n>', 'Amount in NIGHT (default: 50000)')
    .action(async function (this: Command, address: string, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const wallet = await manager.ensureWallet();
        let amount: bigint | undefined;
        if (opts.amount) {
          if (!/^[1-9]\d*$/.test(opts.amount)) {
            outputError('--amount must be a positive whole number of NIGHT tokens.', globals);
            return;
          }
          amount = BigInt(opts.amount) * 10n ** 6n;
        }
        const result = await fundAccount(wallet, address, amount);
        if (globals.json) {
          output({ address: result.address, amount: result.amount.toString(), txHash: result.txHash }, globals);
        } else {
          console.log(`Funded ${result.address} with ${result.amount} NIGHT (tx: ${result.txHash})`);
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('fund-file <path>')
    .description('Fund accounts from an accounts.json file')
    .action(async function (this: Command, filePath: string) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const wallet = await manager.ensureWallet();
        const results = await fundAccountsFromFile(wallet, filePath, manager.config);
        if (globals.json) {
          output(results.map((r) => ({
            name: r.name,
            address: r.address,
            amount: r.amount.toString(),
            hasDust: r.hasDust,
          })), globals);
        } else {
          console.table(results.map((r) => ({
            Name: r.name,
            Address: r.address,
            Amount: r.amount.toString(),
            DUST: r.hasDust ? 'Yes' : 'No',
          })));
        }
      } catch (err) {
        outputError(err, globals);
      }
    });
}
