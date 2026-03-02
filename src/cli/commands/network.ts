import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { checkAllHealth } from '../../core/health.js';
import { output, outputError, type OutputOptions } from '../output.js';
import { parseLogLines } from '../dashboard/lib/log-parser.js';

export function registerNetworkCommands(program: Command, manager: NetworkManager): void {
  program
    .command('start')
    .description('Start the local Midnight development network')
    .option('--pull', 'Pull latest Docker images before starting')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        if (!globals.json) console.log('Starting Midnight local devnet...');
        const result = await manager.start({ pull: opts.pull ?? false });
        const status = result === 'already-running' ? 'already-running' : 'started';
        if (!globals.json) {
          console.log(result === 'already-running' ? 'Network is already running.' : 'Network is ready.');
        }
        const services = await manager.getServices();
        if (globals.json) {
          output({ status, services: services.map((s) => ({ name: s.name, port: s.port, url: s.url, status: s.status })) }, globals);
        } else {
          console.table(services.map((s) => ({ Service: s.name, Port: s.port, URL: s.url, Status: s.status })));
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('stop')
    .description('Stop the local Midnight development network')
    .option('--remove-volumes', 'Remove volumes and containers')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        await manager.stop({ removeVolumes: opts.removeVolumes ?? false });
        if (globals.json) {
          output({ status: 'stopped' }, globals);
        } else {
          console.log('Network stopped.');
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('restart')
    .description('Restart the network')
    .option('--pull', 'Pull latest Docker images')
    .option('--remove-volumes', 'Remove volumes for clean restart')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        await manager.restart({
          pull: opts.pull ?? false,
          removeVolumes: opts.removeVolumes ?? false,
        });
        if (globals.json) {
          output({ status: 'restarted' }, globals);
        } else {
          console.log('Network restarted and ready.');
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('status')
    .description('Show network status')
    .action(async function (this: Command) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const services = await manager.getServices();
        if (globals.json) {
          output({
            running: services.length > 0,
            services: services.map((s) => ({ name: s.name, port: s.port, url: s.url, status: s.status })),
          }, globals);
        } else {
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
        }
      } catch {
        if (globals.json) {
          output({ running: false, services: [] }, globals);
        } else {
          console.log('Network is not running.');
        }
      }
    });

  program
    .command('logs')
    .description('Show network service logs')
    .option('--service <name>', 'Specific service (node, indexer, proof-server)')
    .option('--lines <n>', 'Number of lines', '50')
    .action(async function (this: Command, opts) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const logs = await manager.getLogs({
          service: opts.service,
          lines: parseInt(opts.lines, 10),
        });
        if (globals.json) {
          output(parseLogLines(logs), globals);
        } else {
          console.log(logs);
        }
      } catch (err) {
        outputError(err, globals);
      }
    });

  program
    .command('health')
    .description('Check health of all services')
    .action(async function (this: Command) {
      const globals = this.optsWithGlobals() as OutputOptions;
      try {
        const health = await checkAllHealth(manager.config);
        if (globals.json) {
          output(health, globals);
        } else {
          console.table({
            Node: { Healthy: health.node.healthy, 'Response (ms)': health.node.responseTime },
            Indexer: { Healthy: health.indexer.healthy, 'Response (ms)': health.indexer.responseTime },
            'Proof Server': { Healthy: health.proofServer.healthy, 'Response (ms)': health.proofServer.responseTime },
          });
        }
      } catch (err) {
        outputError(err, globals);
      }
    });
}
