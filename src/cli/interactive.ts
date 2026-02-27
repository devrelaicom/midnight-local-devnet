import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { NetworkManager } from '../core/network-manager.js';
import { fundAccount, fundAccountsFromFile } from '../core/funding.js';
import { generateAccounts, writeAccountsFile } from '../core/accounts.js';
import { getWalletBalances } from '../core/wallet.js';

export async function startInteractiveMode(manager: NetworkManager): Promise<void> {
  const rli = createInterface({ input, output });

  console.log('Midnight Local Devnet — Interactive Mode\n');

  if (manager.getStatus() === 'running') {
    console.log('Detected running network. Initializing wallet...');
    await manager.ensureWallet();
    console.log('Ready.\n');
  } else {
    console.log('Starting network...');
    await manager.start({ pull: false });
    console.log('Network ready.\n');
  }

  const showMenu = () => {
    console.log('\nChoose an option:');
    console.log('  [1] Fund accounts from config file (NIGHT + DUST)');
    console.log('  [2] Fund account by address (NIGHT only)');
    console.log('  [3] Generate test accounts');
    console.log('  [4] Display master wallet balances');
    console.log('  [5] Show network status');
    console.log('  [6] Exit');
  };

  let running = true;
  while (running) {
    showMenu();
    const choice = await rli.question('> ');

    try {
      switch (choice.trim()) {
        case '1': {
          const path = await rli.question('Path to accounts JSON file: ');
          const wallet = await manager.ensureWallet();
          const results = await fundAccountsFromFile(wallet, path.trim(), manager.config);
          console.table(results.map((r) => ({ Name: r.name, Address: r.address, DUST: r.hasDust })));
          break;
        }
        case '2': {
          const addr = await rli.question('Bech32 address: ');
          const wallet = await manager.ensureWallet();
          await fundAccount(wallet, addr.trim());
          console.log('Funded.');
          break;
        }
        case '3': {
          const countStr = await rli.question('How many accounts? [1]: ');
          const count = parseInt(countStr.trim() || '1', 10);
          const accounts = await generateAccounts({ format: 'mnemonic', count });
          const outPath = await rli.question('Save to file? (path or empty to skip): ');
          if (outPath.trim()) {
            await writeAccountsFile(outPath.trim(), accounts);
          }
          console.table(accounts.map((a) => ({ Name: a.name, Mnemonic: a.mnemonic })));
          break;
        }
        case '4': {
          const wallet = await manager.ensureWallet();
          const b = await getWalletBalances(wallet);
          console.table({
            Unshielded: b.unshielded.toString(),
            Shielded: b.shielded.toString(),
            DUST: b.dust.toString(),
          });
          break;
        }
        case '5': {
          const services = await manager.getServices();
          console.table(services);
          break;
        }
        case '6':
          running = false;
          break;
        default:
          console.log('Invalid option.');
      }
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
    }
  }

  console.log('\nShutting down wallet (containers left running)...');
  await manager.shutdown();
  rli.close();
  console.log('Goodbye.');
}
