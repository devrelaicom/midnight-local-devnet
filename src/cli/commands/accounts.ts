import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { generateAccounts, generateAndFundAccounts, writeAccountsFile } from '../../core/accounts.js';

export function registerAccountCommands(program: Command, manager: NetworkManager): void {
  program
    .command('generate-accounts')
    .description('Generate random test accounts')
    .option('--count <n>', 'Number of accounts', '1')
    .option('--format <type>', 'mnemonic or privateKey', 'mnemonic')
    .option('--output <path>', 'Write to file in accounts.json format')
    .option('--fund', 'Fund accounts from master wallet')
    .option('--register-dust', 'Register DUST for funded accounts')
    .action(async (opts) => {
      const format = opts.format as 'mnemonic' | 'privateKey';
      const count = parseInt(opts.count, 10);

      let accounts;
      if (opts.fund) {
        const wallet = await manager.ensureWallet();
        accounts = await generateAndFundAccounts(wallet, manager.config, {
          format,
          count,
          fund: true,
          registerDust: opts.registerDust ?? false,
        });
      } else {
        accounts = await generateAccounts({ format, count });
      }

      if (opts.output) {
        await writeAccountsFile(opts.output, accounts);
        console.log(`Accounts written to ${opts.output}`);
      }

      console.table(accounts.map((a) => ({
        Name: a.name,
        Address: a.address || '(generated on fund)',
        ...(a.mnemonic ? { Mnemonic: a.mnemonic.split(' ').slice(0, 3).join(' ') + '...' } : {}),
      })));
    });
}
