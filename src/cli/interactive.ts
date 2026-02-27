import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { NetworkManager } from '../core/network-manager.js';
import { fundAccount, fundAccountsFromFile } from '../core/funding.js';
import { generateAccounts, generateAndFundAccounts, writeAccountsFile } from '../core/accounts.js';
import { getWalletBalances } from '../core/wallet.js';
import { checkAllHealth } from '../core/health.js';

const MENU = `
  [1]  Start network
  [2]  Stop network
  [3]  Restart network
  [4]  Network status
  [5]  Service logs
  [6]  Health check
  [7]  Wallet balances
  [8]  Fund account by address
  [9]  Fund accounts from file
  [10] Generate test accounts
  [0]  Exit
`;

export async function startInteractiveMode(manager: NetworkManager): Promise<void> {
  const rli = createInterface({ input, output });

  console.log('Midnight Local Devnet — Interactive Mode\n');

  if (manager.getStatus() === 'running') {
    console.log('Detected running network. Initializing wallet...');
    await manager.ensureWallet();
    console.log('Ready.');
  }

  let running = true;
  while (running) {
    console.log(MENU);
    const choice = await rli.question('> ');

    try {
      switch (choice.trim()) {
        case '1': {
          console.log('Starting network...');
          const result = await manager.start({ pull: false });
          if (result === 'already-running') {
            console.log('Network is already running.');
          } else {
            console.log('Network is ready.');
          }
          const services = await manager.getServices();
          console.table(services.map((s) => ({ Service: s.name, Port: s.port, URL: s.url, Status: s.status })));
          break;
        }
        case '2': {
          await manager.stop({ removeVolumes: false });
          console.log('Network stopped.');
          break;
        }
        case '3': {
          const volAnswer = await rli.question('Remove volumes for clean restart? [y/N]: ');
          const removeVolumes = volAnswer.trim().toLowerCase() === 'y';
          console.log('Restarting...');
          await manager.restart({ pull: false, removeVolumes });
          console.log('Network restarted and ready.');
          break;
        }
        case '4': {
          try {
            const services = await manager.getServices();
            if (services.length === 0) {
              console.log('Network is not running.');
            } else {
              console.table(services.map((s) => ({ Service: s.name, Status: s.status, Port: s.port, URL: s.url })));
            }
          } catch {
            console.log('Network is not running.');
          }
          break;
        }
        case '5': {
          const svc = await rli.question('Service (node, indexer, proof-server) or all [all]: ');
          const lines = await rli.question('Number of lines [50]: ');
          const svcName = svc.trim() as 'node' | 'indexer' | 'proof-server' | undefined;
          const logs = await manager.getLogs({
            service: svcName || undefined,
            lines: parseInt(lines.trim() || '50', 10),
          });
          console.log(logs);
          break;
        }
        case '6': {
          const health = await checkAllHealth(manager.config);
          console.table({
            Node: { Healthy: health.node.healthy, 'Response (ms)': health.node.responseTime },
            Indexer: { Healthy: health.indexer.healthy, 'Response (ms)': health.indexer.responseTime },
            'Proof Server': { Healthy: health.proofServer.healthy, 'Response (ms)': health.proofServer.responseTime },
          });
          break;
        }
        case '7': {
          const wallet = await manager.ensureWallet();
          const b = await getWalletBalances(wallet);
          console.table({
            Unshielded: b.unshielded.toString(),
            Shielded: b.shielded.toString(),
            DUST: b.dust.toString(),
            Total: b.total.toString(),
          });
          break;
        }
        case '8': {
          const addr = await rli.question('Bech32 address: ');
          const amountStr = await rli.question('Amount in NIGHT [50000]: ');
          const wallet = await manager.ensureWallet();
          let amount: bigint | undefined;
          if (amountStr.trim()) {
            amount = BigInt(amountStr.trim()) * 10n ** 6n;
          }
          const result = await fundAccount(wallet, addr.trim(), amount);
          console.log(`Funded ${result.address} with ${result.amount} NIGHT (tx: ${result.txHash})`);
          break;
        }
        case '9': {
          const filePath = await rli.question('Path to accounts JSON file: ');
          const wallet = await manager.ensureWallet();
          const results = await fundAccountsFromFile(wallet, filePath.trim(), manager.config);
          console.table(results.map((r) => ({
            Name: r.name,
            Address: r.address,
            Amount: r.amount.toString(),
            DUST: r.hasDust ? 'Yes' : 'No',
          })));
          break;
        }
        case '10': {
          const countStr = await rli.question('How many accounts? [1]: ');
          const count = parseInt(countStr.trim() || '1', 10);
          const fundAnswer = await rli.question('Fund from master wallet? [y/N]: ');
          const shouldFund = fundAnswer.trim().toLowerCase() === 'y';

          let accounts;
          if (shouldFund) {
            const wallet = await manager.ensureWallet();
            accounts = await generateAndFundAccounts(wallet, manager.config, {
              format: 'mnemonic',
              count,
              fund: true,
              registerDust: true,
            });
          } else {
            accounts = await generateAccounts({ format: 'mnemonic', count });
          }

          const outPath = await rli.question('Save to file? (path or enter to skip): ');
          if (outPath.trim()) {
            await writeAccountsFile(outPath.trim(), accounts);
            console.log(`Accounts written to ${outPath.trim()}`);
          }
          console.table(accounts.map((a) => ({
            Name: a.name,
            Address: a.address || '(not funded)',
            Mnemonic: a.mnemonic ? a.mnemonic.split(' ').slice(0, 3).join(' ') + '...' : 'N/A',
          })));
          break;
        }
        case '0':
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
