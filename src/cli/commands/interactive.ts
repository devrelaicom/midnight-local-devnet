import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { startInteractiveMode } from '../interactive.js';

export function registerInteractiveCommand(program: Command, manager: NetworkManager): void {
  program
    .command('interactive')
    .description('Start interactive menu mode')
    .action(async () => {
      try {
        await startInteractiveMode(manager);
      } catch (error) {
        console.error('Interactive mode error:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
