#!/usr/bin/env node
import { Command } from 'commander';
import { NetworkManager } from './core/network-manager.js';
import { registerNetworkCommands } from './cli/commands/network.js';
import { registerWalletCommands } from './cli/commands/wallet.js';
import { registerAccountCommands } from './cli/commands/accounts.js';
import { startInteractiveMode } from './cli/interactive.js';
import { createLogger } from './core/logger.js';
import { setLogger as setWalletLogger } from './core/wallet.js';
import { setLogger as setFundingLogger } from './core/funding.js';
import { setLogger as setAccountsLogger } from './core/accounts.js';

const manager = new NetworkManager();

const isInteractive = process.argv.length <= 2 || process.argv[2] === 'interactive';

// In interactive mode, send logs to stderr so they don't stomp on the readline prompt
const logger = createLogger('info', isInteractive ? process.stderr : process.stdout);
setWalletLogger(logger);
setFundingLogger(logger);
setAccountsLogger(logger);
manager.setLogger(logger);

// Detect existing containers before running any command
await manager.detectRunningNetwork();

// Graceful shutdown on Ctrl+C
const shutdown = async () => {
  await manager.shutdown();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

if (isInteractive) {
  startInteractiveMode(manager).catch(console.error);
} else {
  const program = new Command();

  program
    .name('midnight-local-devnet')
    .description('Manage a local Midnight development network')
    .version('0.1.1');

  registerNetworkCommands(program, manager);
  registerWalletCommands(program, manager);
  registerAccountCommands(program, manager);

  program.parse();
}
