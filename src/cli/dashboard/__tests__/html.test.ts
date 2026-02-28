import { describe, it, expect } from 'vitest';
import { generateDashboardHtml } from '../html.js';

describe('generateDashboardHtml', () => {
  const html = generateDashboardHtml({ wsUrl: 'ws://localhost:31780/ws' });

  it('returns a complete HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('includes the Midnight color palette CSS variables', () => {
    expect(html).toContain('--mn-void');
    expect(html).toContain('--mn-surface');
    expect(html).toContain('--mn-accent');
    expect(html).toContain('#09090f');
    expect(html).toContain('#3b3bff');
  });

  it('includes Google Fonts (Inter + JetBrains Mono)', () => {
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Inter');
    expect(html).toContain('JetBrains+Mono');
  });

  it('includes Preact and HTM imports from CDN', () => {
    expect(html).toContain('preact');
    expect(html).toContain('htm');
  });

  it('includes WebSocket connection logic with the provided URL', () => {
    expect(html).toContain('ws://localhost:31780/ws');
    expect(html).toContain('WebSocket');
  });

  it('includes all dashboard section components', () => {
    expect(html).toContain('NodeCard');
    expect(html).toContain('IndexerCard');
    expect(html).toContain('ProofServerCard');
    expect(html).toContain('WalletCard');
    expect(html).toContain('LogViewer');
  });

  it('includes inline SVG icons (lucide-style)', () => {
    expect(html).toContain('lucide');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
  });

  // --- New tests for wallet card overhaul ---

  it('includes new icon definitions (copy, pencil, trash, plus, x)', () => {
    expect(html).toContain('copy:');
    expect(html).toContain('pencil:');
    expect(html).toContain('trash:');
    expect(html).toContain('plus:');
    expect(html).toContain('x:');
  });

  it('includes walletSyncStatus and serverTime in defaultState', () => {
    expect(html).toContain("walletSyncStatus: 'idle'");
    expect(html).toContain("serverTime: ''");
  });

  it('includes sendMessage function for arbitrary WS messages', () => {
    expect(html).toContain('sendMessage');
    expect(html).toContain('JSON.stringify(msg)');
  });

  it('handles derive-result WS message type', () => {
    expect(html).toContain("msg.type === 'derive-result'");
    expect(html).toContain('setDeriveResult');
  });

  it('auto-syncs wallet on first WebSocket connect', () => {
    expect(html).toContain("action: 'sync-wallet'");
  });

  it('includes ImportWalletModal component', () => {
    expect(html).toContain('ImportWalletModal');
    expect(html).toContain('Import Wallet');
  });

  it('includes import modal tabs for mnemonic and address', () => {
    expect(html).toContain('modal-tabs');
    expect(html).toContain('modal-tab');
    expect(html).toContain("tab === 'mnemonic'");
    expect(html).toContain("tab === 'address'");
  });

  it('includes derive-address flow in import modal', () => {
    expect(html).toContain("action: 'derive-address'");
    expect(html).toContain('Derive Address');
    expect(html).toContain('derivedAddress');
  });

  it('includes wallet selector dropdown', () => {
    expect(html).toContain('wallet-select');
    expect(html).toContain('wallet-selector');
  });

  it('includes editable display names with inline edit', () => {
    expect(html).toContain('inline-edit-input');
    expect(html).toContain('handleStartEdit');
    expect(html).toContain('handleSaveEdit');
  });

  it('includes delete wallet with confirmation prompt', () => {
    expect(html).toContain('confirm-delete');
    expect(html).toContain('Delete this wallet?');
    expect(html).toContain('Yes, delete');
    expect(html).toContain('handleDelete');
  });

  it('includes address display with copy button', () => {
    expect(html).toContain('copy-btn');
    expect(html).toContain('handleCopy');
    expect(html).toContain('navigator.clipboard.writeText');
    expect(html).toContain("Copied!");
  });

  it('includes conditional balance display for master wallet only', () => {
    expect(html).toContain('showBalances');
    expect(html).toContain('isMaster');
    expect(html).toContain('balances not available');
  });

  it('includes sync status indicator with spinner', () => {
    expect(html).toContain('sync-indicator');
    expect(html).toContain('sync-spinner');
    expect(html).toContain('sync-glow');
    expect(html).toContain('Syncing...');
  });

  it('includes localStorage wallet persistence', () => {
    expect(html).toContain('mn-wallets');
    expect(html).toContain('localStorage');
    expect(html).toContain('loadWallets');
    expect(html).toContain('saveWallets');
  });

  it('includes master wallet as non-deletable default', () => {
    expect(html).toContain("id === 'master'");
    expect(html).toContain('Master Wallet');
  });

  it('includes modal overlay and dialog CSS styles', () => {
    expect(html).toContain('.modal-overlay');
    expect(html).toContain('.modal-dialog');
    expect(html).toContain('.modal-tabs');
    expect(html).toContain('.modal-tab');
  });

  it('includes wallet card CSS styles', () => {
    expect(html).toContain('.wallet-selector');
    expect(html).toContain('.wallet-select');
    expect(html).toContain('.inline-edit-input');
    expect(html).toContain('.icon-btn');
    expect(html).toContain('.copy-btn');
    expect(html).toContain('.confirm-delete');
    expect(html).toContain('.sync-indicator');
  });

  it('includes syncPulse animation keyframes', () => {
    expect(html).toContain('@keyframes syncPulse');
  });

  it('imports useMemo from preact/hooks', () => {
    expect(html).toContain('useMemo');
  });

  it('uses crypto.randomUUID for wallet IDs', () => {
    expect(html).toContain('crypto.randomUUID()');
  });

  // --- Task 5: Service card improvements ---

  // 5a: Proof server version display
  it('shows Server Version and Proof Versions in ProofServerCard', () => {
    expect(html).toContain('Server Version');
    expect(html).toContain('Proof Versions');
    expect(html).toContain('proofVersionsDisplay');
  });

  it('displays proofVersions as comma-separated list or None', () => {
    expect(html).toContain("proofServer.proofVersions.join(', ')");
    expect(html).toContain("'None'");
  });

  // 5b: Server time in card footers
  it('includes formatTime utility function', () => {
    expect(html).toContain('function formatTime');
    expect(html).toContain('toLocaleTimeString');
    expect(html).toContain("'--:--:--'");
  });

  it('includes card-footer CSS class', () => {
    expect(html).toContain('.card-footer');
  });

  it('passes serverTime prop to service cards', () => {
    expect(html).toContain('serverTime=${state.serverTime}');
  });

  it('renders card-footer with formatTime in each service card', () => {
    // Each card should have a card-footer div calling formatTime
    const footerMatches = html.match(/card-footer.*?formatTime/g);
    expect(footerMatches).not.toBeNull();
    expect(footerMatches!.length).toBeGreaterThanOrEqual(3);
  });

  // 5c: Conditional start/stop buttons
  it('includes conditional button rendering logic based on networkStatus', () => {
    expect(html).toContain("networkStatus === 'running'");
    expect(html).toContain("networkStatus === 'stopped'");
    expect(html).toContain("networkStatus === 'starting'");
    expect(html).toContain("networkStatus === 'stopping'");
    expect(html).toContain('renderButtons');
  });

  it('includes disabled button styling', () => {
    expect(html).toContain('.btn:disabled');
    expect(html).toContain('btn-spinner');
  });

  it('shows spinner text for starting and stopping states', () => {
    expect(html).toContain('Starting...');
    expect(html).toContain('Stopping...');
  });

  // 5d: Polling frequency control
  it('includes settings gear icon', () => {
    expect(html).toContain('settings:');
  });

  it('includes PollingSettings component', () => {
    expect(html).toContain('PollingSettings');
    expect(html).toContain('Polling Intervals');
  });

  it('includes polling settings popover CSS', () => {
    expect(html).toContain('.settings-popover');
    expect(html).toContain('.settings-wrapper');
    expect(html).toContain('.settings-input');
  });

  it('sends set-polling WS command on change', () => {
    expect(html).toContain("action: 'set-polling'");
  });

  it('persists polling config in localStorage', () => {
    expect(html).toContain('mn-polling-config');
    expect(html).toContain('POLLING_KEY');
  });

  it('includes number inputs for node, indexer, and proof server polling', () => {
    expect(html).toContain("handleChange('node'");
    expect(html).toContain("handleChange('indexer'");
    expect(html).toContain("handleChange('proofServer'");
  });

  it('passes sendMessage to Header for polling settings', () => {
    expect(html).toContain('sendMessage=${sendMessage}');
  });
});
