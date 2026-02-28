import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';
import { startInteractiveMode } from '../interactive.js';

export function registerInteractiveCommand(program: Command, manager: NetworkManager): void {
  program
    .command('interactive')
    .description('Start interactive menu mode')
    .action(async () => {
      await startInteractiveMode(manager);
    });
}
