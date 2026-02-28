import type { Command } from 'commander';
import type { NetworkManager } from '../../core/network-manager.js';

export function registerDashboardCommand(program: Command, manager: NetworkManager): void {
  program
    .command('dashboard')
    .description('Open realtime terminal dashboard for the local devnet')
    .action(async () => {
      // Dynamic import to avoid loading React/ink for non-dashboard commands
      const { render } = await import('ink');
      const React = await import('react');
      const { App } = await import('../dashboard/app.js');

      const { waitUntilExit } = render(
        React.createElement(App, { manager, config: manager.config }),
      );

      await waitUntilExit();
      await manager.shutdown();
    });
}
