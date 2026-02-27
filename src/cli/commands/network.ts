import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { checkAllHealth } from '../../core/health.js';

export function registerNetworkCommands(program: Command, manager: NetworkManager): void {
  program
    .command('start')
    .description('Start the local Midnight development network')
    .option('--pull', 'Pull latest Docker images before starting')
    .action(async (opts) => {
      console.log('Starting Midnight local devnet...');
      const result = await manager.start({ pull: opts.pull ?? false });
      if (result === 'already-running') {
        console.log('Network is already running.');
      } else {
        console.log('Network is ready.');
      }
      const services = await manager.getServices();
      console.table(services.map((s) => ({ Service: s.name, Port: s.port, URL: s.url, Status: s.status })));
    });

  program
    .command('stop')
    .description('Stop the local Midnight development network')
    .option('--remove-volumes', 'Remove volumes and containers')
    .action(async (opts) => {
      await manager.stop({ removeVolumes: opts.removeVolumes ?? false });
      console.log('Network stopped.');
    });

  program
    .command('restart')
    .description('Restart the network')
    .option('--pull', 'Pull latest Docker images')
    .option('--remove-volumes', 'Remove volumes for clean restart')
    .action(async (opts) => {
      await manager.restart({
        pull: opts.pull ?? false,
        removeVolumes: opts.removeVolumes ?? false,
      });
      console.log('Network restarted and ready.');
    });

  program
    .command('status')
    .description('Show network status')
    .action(async () => {
      try {
        const services = await manager.getServices();
        if (services.length === 0) {
          console.log('Network is not running.');
          return;
        }
        console.table(services.map((s) => ({
          Service: s.name,
          Status: s.status,
          Port: s.port,
          URL: s.url,
        })));
      } catch {
        console.log('Network is not running.');
      }
    });

  program
    .command('logs')
    .description('Show network service logs')
    .option('--service <name>', 'Specific service (node, indexer, proof-server)')
    .option('--lines <n>', 'Number of lines', '50')
    .action(async (opts) => {
      const logs = await manager.getLogs({
        service: opts.service,
        lines: parseInt(opts.lines, 10),
      });
      console.log(logs);
    });

  program
    .command('health')
    .description('Check health of all services')
    .action(async () => {
      const health = await checkAllHealth();
      console.table({
        Node: { Healthy: health.node.healthy, 'Response (ms)': health.node.responseTime },
        Indexer: { Healthy: health.indexer.healthy, 'Response (ms)': health.indexer.responseTime },
        'Proof Server': { Healthy: health.proofServer.healthy, 'Response (ms)': health.proofServer.responseTime },
      });
    });
}
