/**
 * Generates a complete single-page HTML dashboard for the Midnight local devnet.
 * Uses Preact + HTM via CDN import maps. All CSS and JS are inline.
 */
function safeJsonInScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

export function generateDashboardHtml({ wsUrl }: { wsUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Midnight Devnet Dashboard</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

  <script type="importmap">
  {
    "imports": {
      "preact": "https://esm.sh/preact@10.25.4",
      "preact/hooks": "https://esm.sh/preact@10.25.4/hooks",
      "htm/preact": "https://esm.sh/htm@3.1.1/preact?external=preact"
    }
  }
  </script>

  <style>
    :root {
      --mn-void: #09090f;
      --mn-surface: #0f0f1e;
      --mn-surface-alt: #14142b;
      --mn-border: #1c1c3a;
      --mn-border-bright: #2a2a50;
      --mn-accent: #3b3bff;
      --mn-accent-hover: #5252ff;
      --mn-accent-muted: #2a2aaa;
      --mn-accent-glow: rgba(59, 59, 255, 0.25);
      --mn-text: #f0f0ff;
      --mn-text-secondary: #8080aa;
      --mn-text-muted: #505070;
      --mn-success: #22c55e;
      --mn-warning: #eab308;
      --mn-error: #ef4444;
      --mn-gradient-hero: linear-gradient(135deg, #1a1a4a 0%, #09090f 50%, #0f1a2f 100%);
      --mn-gradient-accent: linear-gradient(135deg, #3b3bff 0%, #6b3bff 100%);
      --mn-gradient-card: linear-gradient(180deg, rgba(59, 59, 255, 0.08) 0%, transparent 60%);
    }

    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--mn-void);
      background-image: radial-gradient(circle, rgba(59, 59, 255, 0.02) 1px, transparent 1px);
      background-size: 24px 24px;
      color: var(--mn-text);
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .mono {
      font-family: 'JetBrains Mono', monospace;
    }

    #app {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px;
    }

    /* --- Animations --- */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .fade-in {
      animation: fadeInUp 0.35s ease-out both;
    }

    /* --- Header --- */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
      padding: 20px 24px;
      background: var(--mn-surface);
      border: 1px solid var(--mn-border);
      border-radius: 12px;
      position: relative;
      overflow: hidden;
    }

    .header::before {
      content: '';
      position: absolute;
      top: -60%;
      left: -10%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(59, 59, 255, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      position: relative;
      z-index: 1;
    }

    .logo {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--mn-text);
    }

    .logo-icon {
      color: var(--mn-accent);
      margin-right: 4px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      background: var(--mn-surface-alt);
      border: 1px solid var(--mn-border);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-dot.running { background: var(--mn-success); box-shadow: 0 0 6px var(--mn-success); }
    .status-dot.stopped { background: var(--mn-error); }
    .status-dot.starting, .status-dot.stopping { background: var(--mn-warning); animation: pulse 1.5s ease-in-out infinite; }
    .status-dot.unknown { background: var(--mn-text-muted); }

    .header-actions {
      display: flex;
      gap: 8px;
      position: relative;
      z-index: 1;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--mn-border);
      background: var(--mn-surface-alt);
      color: var(--mn-text);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease-out;
    }

    .btn:hover {
      border-color: var(--mn-border-bright);
      background: var(--mn-border);
    }

    .btn-primary {
      background: var(--mn-accent);
      border-color: var(--mn-accent);
      color: var(--mn-text);
    }

    .btn-primary:hover {
      background: var(--mn-accent-hover);
      border-color: var(--mn-accent-hover);
    }

    .btn-danger {
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--mn-error);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--mn-error);
    }

    /* --- Cards Grid --- */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .card {
      background: var(--mn-surface);
      border: 1px solid var(--mn-border);
      border-radius: 12px;
      padding: 20px;
      transition: border-color 0.2s ease-out, box-shadow 0.2s ease-out;
      position: relative;
    }

    .card:hover {
      border-color: var(--mn-border-bright);
      box-shadow: 0 4px 24px var(--mn-accent-glow);
    }

    .card:hover::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 12px;
      background: var(--mn-gradient-card);
      pointer-events: none;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--mn-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .card-health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .card-health-dot.healthy { background: var(--mn-success); box-shadow: 0 0 6px var(--mn-success); }
    .card-health-dot.unhealthy { background: var(--mn-error); box-shadow: 0 0 6px var(--mn-error); }

    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 600;
      color: var(--mn-text);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 12px;
      color: var(--mn-text-muted);
      margin-top: 2px;
    }

    .stat-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding: 8px 0;
    }

    .stat-row:not(:last-child) {
      border-bottom: 1px solid var(--mn-border);
    }

    .stat-row-label {
      font-size: 13px;
      color: var(--mn-text-secondary);
    }

    .stat-row-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      color: var(--mn-text);
    }

    /* --- Gauge --- */
    .gauge-container {
      margin-top: 12px;
    }

    .gauge-bar {
      width: 100%;
      height: 6px;
      background: var(--mn-surface-alt);
      border-radius: 3px;
      overflow: hidden;
    }

    .gauge-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease-out, background 0.3s ease-out;
    }

    .gauge-label {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 11px;
      color: var(--mn-text-muted);
    }

    /* --- Wallet Card (full-width) --- */
    .full-width {
      grid-column: 1 / -1;
    }

    .wallet-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }

    .wallet-address {
      grid-column: 1 / -1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--mn-text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 10px 14px;
      background: var(--mn-surface-alt);
      border-radius: 8px;
      border: 1px solid var(--mn-border);
    }

    .balance-item {
      text-align: center;
    }

    .balance-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 22px;
      font-weight: 600;
      color: var(--mn-text);
    }

    .balance-label {
      font-size: 12px;
      color: var(--mn-text-muted);
      margin-top: 2px;
    }

    /* --- Response Chart --- */
    .chart-section {
      margin-bottom: 16px;
    }

    .sparkline-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
    }

    .sparkline-row:not(:last-child) {
      border-bottom: 1px solid var(--mn-border);
    }

    .sparkline-label {
      width: 100px;
      font-size: 13px;
      color: var(--mn-text-secondary);
      flex-shrink: 0;
    }

    .sparkline-svg {
      flex: 1;
      height: 32px;
    }

    .sparkline-value {
      width: 60px;
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--mn-text-muted);
      flex-shrink: 0;
    }

    /* --- Log Viewer --- */
    .log-viewer {
      background: var(--mn-surface);
      border: 1px solid var(--mn-border);
      border-radius: 12px;
      overflow: hidden;
    }

    .log-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mn-border);
      background: var(--mn-surface-alt);
    }

    .log-select {
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--mn-border);
      background: var(--mn-surface);
      color: var(--mn-text);
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      cursor: pointer;
      outline: none;
    }

    .log-select:focus {
      border-color: var(--mn-accent);
    }

    .log-search {
      flex: 1;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--mn-border);
      background: var(--mn-surface);
      color: var(--mn-text);
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      outline: none;
    }

    .log-search::placeholder {
      color: var(--mn-text-muted);
    }

    .log-search:focus {
      border-color: var(--mn-accent);
    }

    .log-entries {
      max-height: 320px;
      overflow-y: auto;
      padding: 8px 0;
      scroll-behavior: smooth;
    }

    .log-entries::-webkit-scrollbar {
      width: 6px;
    }

    .log-entries::-webkit-scrollbar-track {
      background: transparent;
    }

    .log-entries::-webkit-scrollbar-thumb {
      background: var(--mn-border-bright);
      border-radius: 3px;
    }

    .log-line {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 3px 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.6;
    }

    .log-line:hover {
      background: var(--mn-surface-alt);
    }

    .log-tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
      min-width: 52px;
      text-align: center;
    }

    .log-tag.node { background: rgba(59, 59, 255, 0.15); color: #7070ff; }
    .log-tag.indexer { background: rgba(99, 59, 255, 0.15); color: #9070ff; }
    .log-tag.proof { background: rgba(139, 59, 255, 0.15); color: #b070ff; }

    .log-level {
      font-size: 10px;
      font-weight: 500;
      min-width: 40px;
      flex-shrink: 0;
    }

    .log-level.info { color: var(--mn-text-muted); }
    .log-level.warn { color: var(--mn-warning); }
    .log-level.error { color: var(--mn-error); }

    .log-message {
      color: var(--mn-text-secondary);
      word-break: break-all;
    }

    /* --- Modal Overlay --- */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 9, 15, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 150;
      backdrop-filter: blur(4px);
    }

    .modal-dialog {
      background: var(--mn-surface);
      border: 1px solid var(--mn-border);
      border-radius: 12px;
      padding: 24px;
      width: 480px;
      max-width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 16px 64px rgba(9, 9, 15, 0.8);
      animation: fadeInUp 0.2s ease-out;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--mn-text);
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--mn-text-secondary);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .modal-close:hover {
      color: var(--mn-text);
      background: var(--mn-surface-alt);
    }

    /* --- Import Modal Tabs --- */
    .modal-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--mn-border);
    }

    .modal-tab {
      flex: 1;
      padding: 10px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--mn-text-secondary);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }

    .modal-tab:hover {
      color: var(--mn-text);
    }

    .modal-tab.active {
      color: var(--mn-accent);
      border-bottom-color: var(--mn-accent);
    }

    .modal-field {
      margin-bottom: 14px;
    }

    .modal-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--mn-text-secondary);
      margin-bottom: 6px;
    }

    .modal-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--mn-border);
      background: var(--mn-surface-alt);
      color: var(--mn-text);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }

    .modal-input:focus {
      border-color: var(--mn-accent);
    }

    .modal-input.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }

    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 20px;
    }

    /* --- Wallet Selector Dropdown --- */
    .wallet-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .wallet-select {
      flex: 1;
      min-width: 0;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--mn-border);
      background: var(--mn-surface-alt);
      color: var(--mn-text);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      cursor: pointer;
      outline: none;
      transition: border-color 0.15s;
    }

    .wallet-select:focus {
      border-color: var(--mn-accent);
    }

    /* --- Inline Edit Input --- */
    .inline-edit-input {
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--mn-accent);
      background: var(--mn-surface-alt);
      color: var(--mn-text);
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      outline: none;
      width: 180px;
    }

    /* --- Icon Button --- */
    .icon-btn {
      background: none;
      border: none;
      color: var(--mn-text-muted);
      cursor: pointer;
      padding: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.15s;
    }

    .icon-btn:hover {
      color: var(--mn-text);
      background: var(--mn-surface-alt);
    }

    .icon-btn.danger:hover {
      color: var(--mn-error);
      background: rgba(239, 68, 68, 0.1);
    }

    /* --- Copy Button --- */
    .copy-btn {
      background: none;
      border: none;
      color: var(--mn-text-muted);
      cursor: pointer;
      padding: 4px 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border-radius: 4px;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      transition: all 0.15s;
    }

    .copy-btn:hover {
      color: var(--mn-text);
      background: var(--mn-surface-alt);
    }

    .copy-btn.copied {
      color: var(--mn-success);
    }

    /* --- Pulsing Sync Animation --- */
    @keyframes syncPulse {
      0%, 100% { box-shadow: 0 0 0 0 var(--mn-accent-glow); }
      50% { box-shadow: 0 0 12px 4px var(--mn-accent-glow); }
    }

    .sync-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--mn-text-secondary);
    }

    .sync-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--mn-border);
      border-top-color: var(--mn-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .sync-glow {
      animation: syncPulse 2s ease-in-out infinite;
      border-radius: 12px;
    }

    /* --- Confirm Delete Inline Prompt --- */
    .confirm-delete {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--mn-surface-alt);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      font-size: 12px;
      color: var(--mn-text-secondary);
      animation: fadeInUp 0.15s ease-out;
    }

    .confirm-delete .btn {
      padding: 4px 10px;
      font-size: 11px;
    }

    /* --- Wallet Card Header Row --- */
    .wallet-header-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .wallet-address-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* --- Connection Overlay --- */
    .connection-overlay {
      position: fixed;
      inset: 0;
      background: rgba(9, 9, 15, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      backdrop-filter: blur(4px);
    }

    .connection-message {
      text-align: center;
      color: var(--mn-text-secondary);
    }

    .connection-message h2 {
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--mn-text);
    }

    .connection-message p {
      font-size: 14px;
    }

    .connection-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--mn-border);
      border-top-color: var(--mn-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* --- Toast --- */
    .toast-container {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast {
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid var(--mn-border);
      background: var(--mn-surface);
      color: var(--mn-text);
      animation: slideInRight 0.2s ease-out;
      min-width: 240px;
      box-shadow: 0 8px 32px rgba(9, 9, 15, 0.5);
    }

    .toast.success { border-left: 3px solid var(--mn-success); }
    .toast.error { border-left: 3px solid var(--mn-error); }
    .toast.fade-out { animation: fadeOut 0.3s ease-out forwards; }

    /* --- Responsive --- */
    @media (max-width: 768px) {
      #app { padding: 12px; }
      .header { flex-direction: column; gap: 12px; padding: 16px; }
      .wallet-grid { grid-template-columns: 1fr; }
      .sparkline-row { flex-direction: column; align-items: flex-start; gap: 4px; }
      .sparkline-label { width: auto; }
      .sparkline-value { width: auto; text-align: left; }
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import { h, render } from 'preact';
    import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
    import { html } from 'htm/preact';

    // --- Lucide icon SVGs (inline, stroke-based) ---
    // Using simple inline SVG paths instead of full lucide library for performance
    const icons = {
      play: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>\`,
      square: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>\`,
      box: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>\`,
      database: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>\`,
      shield: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>\`,
      wallet: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>\`,
      activity: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>\`,
      terminal: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>\`,
      search: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>\`,
      copy: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>\`,
      pencil: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>\`,
      trash: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>\`,
      plus: html\`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>\`,
      x: html\`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>\`,
    };

    // --- WebSocket URL (injected at generation time) ---
    const WS_URL = ${safeJsonInScript(wsUrl)};

    // --- Utility functions ---
    function formatNumber(n) {
      if (n == null) return '--';
      return n.toLocaleString();
    }

    function formatBalance(val) {
      if (val == null || val === '0') return '0';
      const num = BigInt(val);
      return num.toLocaleString();
    }

    function truncateAddress(addr) {
      if (!addr) return '--';
      if (addr.length <= 20) return addr;
      return addr.slice(0, 10) + '...' + addr.slice(-8);
    }

    function formatMs(ms) {
      if (ms == null) return '--';
      return ms < 1000 ? ms.toFixed(0) + 'ms' : (ms / 1000).toFixed(2) + 's';
    }

    function gaugeColor(pct) {
      if (pct >= 90) return 'var(--mn-error)';
      if (pct >= 70) return 'var(--mn-warning)';
      return 'var(--mn-success)';
    }

    // --- Default state ---
    const defaultState = {
      node: { chain: null, name: null, version: null, blockHeight: null, avgBlockTime: null, peers: null, syncing: null },
      indexer: { ready: false, responseTime: null },
      proofServer: { version: null, ready: false, jobsProcessing: null, jobsPending: null, jobCapacity: null, proofVersions: null },
      wallet: { address: null, connected: false, unshielded: '0', shielded: '0', dust: '0' },
      health: {
        node: { status: 'unhealthy', history: [] },
        indexer: { status: 'unhealthy', history: [] },
        proofServer: { status: 'unhealthy', history: [] },
      },
      containers: [],
      logs: [],
      networkStatus: 'unknown',
      walletSyncStatus: 'idle',
      serverTime: '',
    };

    // --- Toast component ---
    function ToastContainer({ toasts, onRemove }) {
      return html\`
        <div class="toast-container">
          \${toasts.map(t => html\`
            <div key=\${t.id} class="toast \${t.type} \${t.fading ? 'fade-out' : ''}"
                 onAnimationEnd=\${() => t.fading && onRemove(t.id)}>
              \${t.message}
            </div>
          \`)}
        </div>
      \`;
    }

    // --- ConnectionStatus ---
    function ConnectionStatus({ connected }) {
      if (connected) return null;
      return html\`
        <div class="connection-overlay">
          <div class="connection-message">
            <div class="connection-spinner"></div>
            <h2>Reconnecting...</h2>
            <p>Attempting to connect to dashboard server</p>
          </div>
        </div>
      \`;
    }

    // --- Header ---
    function Header({ networkStatus, onStart, onStop }) {
      const statusLabel = networkStatus.charAt(0).toUpperCase() + networkStatus.slice(1);
      return html\`
        <div class="header fade-in">
          <div class="header-left">
            <div class="logo"><span class="logo-icon">◈</span> Midnight Devnet</div>
            <div class="status-badge">
              <span class="status-dot \${networkStatus}"></span>
              \${statusLabel}
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" onClick=\${onStart}>\${icons.play} Start</button>
            <button class="btn btn-danger" onClick=\${onStop}>\${icons.square} Stop</button>
          </div>
        </div>
      \`;
    }

    // --- NodeCard ---
    function NodeCard({ node, health }) {
      const blockTimeStr = node.avgBlockTime != null ? (node.avgBlockTime / 1000).toFixed(1) + 's' : '--';
      return html\`
        <div class="card fade-in" style="animation-delay: 0ms">
          <div class="card-header">
            <div class="card-title">
              \${icons.box}
              Node
            </div>
            <span class="card-health-dot \${health.status}"></span>
          </div>
          <div class="stat-value mono">\${formatNumber(node.blockHeight)}</div>
          <div class="stat-label">Block Height</div>
          <div style="margin-top: 14px">
            <div class="stat-row">
              <span class="stat-row-label">Avg Block Time</span>
              <span class="stat-row-value">\${blockTimeStr}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Peers</span>
              <span class="stat-row-value">\${formatNumber(node.peers)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">Version</span>
              <span class="stat-row-value">\${node.version || '--'}</span>
            </div>
          </div>
        </div>
      \`;
    }

    // --- IndexerCard ---
    function IndexerCard({ indexer, health }) {
      return html\`
        <div class="card fade-in" style="animation-delay: 150ms">
          <div class="card-header">
            <div class="card-title">
              \${icons.database}
              Indexer
            </div>
            <span class="card-health-dot \${health.status}"></span>
          </div>
          <div class="stat-value mono" style="font-size: 22px; color: \${indexer.ready ? 'var(--mn-success)' : 'var(--mn-error)'}">\${indexer.ready ? 'Ready' : 'Not Ready'}</div>
          <div class="stat-label">Service Status</div>
          <div style="margin-top: 14px">
            <div class="stat-row">
              <span class="stat-row-label">Response Time</span>
              <span class="stat-row-value">\${formatMs(indexer.responseTime)}</span>
            </div>
          </div>
        </div>
      \`;
    }

    // --- ProofServerCard ---
    function ProofServerCard({ proofServer, health }) {
      const capacity = proofServer.jobCapacity || 1;
      const processing = proofServer.jobsProcessing || 0;
      const pct = Math.min(100, (processing / capacity) * 100);
      return html\`
        <div class="card fade-in" style="animation-delay: 300ms">
          <div class="card-header">
            <div class="card-title">
              \${icons.shield}
              Proof Server
            </div>
            <span class="card-health-dot \${health.status}"></span>
          </div>
          <div class="stat-value mono" style="font-size: 22px; color: \${proofServer.ready ? 'var(--mn-success)' : 'var(--mn-error)'}">\${proofServer.ready ? 'Ready' : 'Not Ready'}</div>
          <div class="stat-label">Service Status</div>
          <div class="gauge-container">
            <div class="gauge-bar">
              <div class="gauge-fill" style="width: \${pct}%; background: \${gaugeColor(pct)}"></div>
            </div>
            <div class="gauge-label">
              <span>Jobs: \${formatNumber(processing)} / \${formatNumber(capacity)}</span>
              <span>Pending: \${formatNumber(proofServer.jobsPending)}</span>
            </div>
          </div>
          <div style="margin-top: 10px">
            <div class="stat-row">
              <span class="stat-row-label">Version</span>
              <span class="stat-row-value">\${proofServer.version || '--'}</span>
            </div>
          </div>
        </div>
      \`;
    }

    // --- localStorage helpers for wallet list ---
    const WALLETS_KEY = 'mn-wallets';

    function loadWallets() {
      try {
        const raw = localStorage.getItem(WALLETS_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* ignore */ }
      return [];
    }

    function saveWallets(wallets) {
      localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
    }

    // --- ImportWalletModal ---
    function ImportWalletModal({ onClose, onImport, sendMessage, deriveResult }) {
      const [tab, setTab] = useState('mnemonic');
      const [mnemonic, setMnemonic] = useState('');
      const [address, setAddress] = useState('');
      const [displayName, setDisplayName] = useState('');
      const [deriving, setDeriving] = useState(false);
      const [derivedAddress, setDerivedAddress] = useState(null);

      // Watch for derive-result coming in
      useEffect(() => {
        if (deriveResult && deriving) {
          setDerivedAddress(deriveResult);
          setDeriving(false);
        }
      }, [deriveResult, deriving]);

      const handleDerive = useCallback(() => {
        if (!mnemonic.trim()) return;
        setDeriving(true);
        setDerivedAddress(null);
        sendMessage({ type: 'command', action: 'derive-address', mnemonic: mnemonic.trim() });
      }, [mnemonic, sendMessage]);

      const handleImport = useCallback(() => {
        if (tab === 'mnemonic') {
          if (!derivedAddress) return;
          onImport({
            id: crypto.randomUUID(),
            publicKey: derivedAddress,
            displayName: displayName.trim() || 'Imported Wallet',
            hasMnemonic: true,
          });
        } else {
          if (!address.trim()) return;
          onImport({
            id: crypto.randomUUID(),
            publicKey: address.trim(),
            displayName: displayName.trim() || 'Imported Wallet',
          });
        }
        onClose();
      }, [tab, derivedAddress, address, displayName, onImport, onClose]);

      return html\`
        <div class="modal-overlay" onClick=\${(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div class="modal-dialog">
            <div class="modal-header">
              <span class="modal-title">Import Wallet</span>
              <button class="modal-close" onClick=\${onClose}>\${icons.x}</button>
            </div>
            <div class="modal-tabs">
              <button class="modal-tab \${tab === 'mnemonic' ? 'active' : ''}" onClick=\${() => { setTab('mnemonic'); setDerivedAddress(null); }}>Mnemonic</button>
              <button class="modal-tab \${tab === 'address' ? 'active' : ''}" onClick=\${() => setTab('address')}>Address</button>
            </div>
            \${tab === 'mnemonic' ? html\`
              <div class="modal-field">
                <label class="modal-label">Mnemonic Phrase</label>
                <input class="modal-input mono" type="text" placeholder="Enter mnemonic words..."
                       value=\${mnemonic} onInput=\${e => setMnemonic(e.target.value)} />
              </div>
              <div style="margin-bottom: 14px">
                <button class="btn" onClick=\${handleDerive} disabled=\${deriving || !mnemonic.trim()}>
                  \${deriving ? 'Deriving...' : 'Derive Address'}
                </button>
                \${derivedAddress ? html\`
                  <div style="margin-top: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--mn-success); word-break: break-all;">
                    Derived: \${truncateAddress(derivedAddress)}
                  </div>
                \` : null}
              </div>
            \` : html\`
              <div class="modal-field">
                <label class="modal-label">Public Key / Address</label>
                <input class="modal-input mono" type="text" placeholder="Paste public key..."
                       value=\${address} onInput=\${e => setAddress(e.target.value)} />
              </div>
            \`}
            <div class="modal-field">
              <label class="modal-label">Display Name (optional)</label>
              <input class="modal-input" type="text" placeholder="e.g. My Wallet"
                     value=\${displayName} onInput=\${e => setDisplayName(e.target.value)} />
            </div>
            <div class="modal-actions">
              <button class="btn" onClick=\${onClose}>Cancel</button>
              <button class="btn btn-primary" onClick=\${handleImport}
                      disabled=\${tab === 'mnemonic' ? !derivedAddress : !address.trim()}>
                Import
              </button>
            </div>
          </div>
        </div>
      \`;
    }

    // --- WalletCard ---
    function WalletCard({ wallet, walletSyncStatus, sendMessage, onOpenImportModal, importHandlerRef }) {
      // Load wallets from localStorage, ensuring master wallet is always first
      const [wallets, setWallets] = useState(() => {
        const stored = loadWallets();
        const hasMaster = stored.some(w => w.id === 'master');
        if (!hasMaster) {
          const masterEntry = { id: 'master', publicKey: wallet.address || '', displayName: 'Master Wallet' };
          const all = [masterEntry, ...stored];
          saveWallets(all);
          return all;
        }
        return stored;
      });

      const [selectedId, setSelectedId] = useState('master');
      const [editingId, setEditingId] = useState(null);
      const [editName, setEditName] = useState('');
      const [deletingId, setDeletingId] = useState(null);
      const [copied, setCopied] = useState(false);

      // Keep master wallet address in sync with server state
      useEffect(() => {
        if (wallet.address) {
          setWallets(prev => {
            const updated = prev.map(w => w.id === 'master' ? { ...w, publicKey: wallet.address } : w);
            saveWallets(updated);
            return updated;
          });
        }
      }, [wallet.address]);

      const selectedWallet = useMemo(() => {
        return wallets.find(w => w.id === selectedId) || wallets[0] || null;
      }, [wallets, selectedId]);

      const isMaster = selectedWallet && selectedWallet.id === 'master';

      const handleImportWallet = useCallback((newWallet) => {
        setWallets(prev => {
          const updated = [...prev, newWallet];
          saveWallets(updated);
          return updated;
        });
        setSelectedId(newWallet.id);
      }, []);

      // Expose import handler to parent via ref
      useEffect(() => {
        if (importHandlerRef) importHandlerRef.current = handleImportWallet;
      }, [importHandlerRef, handleImportWallet]);

      const handleStartEdit = useCallback((w) => {
        setEditingId(w.id);
        setEditName(w.displayName);
      }, []);

      const handleSaveEdit = useCallback(() => {
        if (!editingId) return;
        setWallets(prev => {
          const updated = prev.map(w => w.id === editingId ? { ...w, displayName: editName.trim() || w.displayName } : w);
          saveWallets(updated);
          return updated;
        });
        setEditingId(null);
      }, [editingId, editName]);

      const handleDelete = useCallback((id) => {
        setWallets(prev => {
          const updated = prev.filter(w => w.id !== id);
          saveWallets(updated);
          return updated;
        });
        setDeletingId(null);
        if (selectedId === id) setSelectedId('master');
      }, [selectedId]);

      const handleCopy = useCallback((text) => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }, []);

      const showBalances = isMaster && walletSyncStatus !== 'syncing';
      const displayAddress = selectedWallet ? selectedWallet.publicKey : null;

      return html\`
        <div class="card full-width fade-in \${walletSyncStatus === 'syncing' ? 'sync-glow' : ''}" style="animation-delay: 450ms">
          <div class="card-header">
            <div class="card-title">
              \${icons.wallet}
              Wallet
              \${walletSyncStatus === 'syncing' ? html\`
                <span class="sync-indicator">
                  <span class="sync-spinner"></span>
                  Syncing...
                </span>
              \` : null}
            </div>
            <span class="card-health-dot \${wallet.connected ? 'healthy' : 'unhealthy'}"></span>
          </div>

          <div class="wallet-header-row">
            <div class="wallet-selector">
              \${editingId === (selectedWallet && selectedWallet.id) ? html\`
                <input class="inline-edit-input" type="text" value=\${editName}
                       onInput=\${e => setEditName(e.target.value)}
                       onBlur=\${handleSaveEdit}
                       onKeyDown=\${e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                       autofocus />
              \` : html\`
                <select class="wallet-select" value=\${selectedId}
                        onChange=\${e => { setSelectedId(e.target.value); setDeletingId(null); }}>
                  \${wallets.map(w => html\`
                    <option key=\${w.id} value=\${w.id}>\${w.displayName}</option>
                  \`)}
                </select>
              \`}
              <button class="icon-btn" title="Rename wallet" onClick=\${() => selectedWallet && handleStartEdit(selectedWallet)}>
                \${icons.pencil}
              </button>
              \${selectedWallet && selectedWallet.id !== 'master' ? html\`
                <button class="icon-btn danger" title="Delete wallet" onClick=\${() => setDeletingId(selectedWallet.id)}>
                  \${icons.trash}
                </button>
              \` : null}
            </div>
            <button class="btn" onClick=\${onOpenImportModal}>
              \${icons.plus} Import
            </button>
          </div>

          \${deletingId ? html\`
            <div class="confirm-delete">
              <span>Delete this wallet?</span>
              <button class="btn btn-danger" onClick=\${() => handleDelete(deletingId)}>Yes, delete</button>
              <button class="btn" onClick=\${() => setDeletingId(null)}>Cancel</button>
            </div>
          \` : null}

          <div class="wallet-grid">
            <div class="wallet-address">
              <div class="wallet-address-row">
                <span class="mono" title=\${displayAddress || ''} style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                  \${displayAddress ? truncateAddress(displayAddress) : 'No wallet connected'}
                </span>
                \${displayAddress ? html\`
                  <button class="copy-btn \${copied ? 'copied' : ''}" onClick=\${() => handleCopy(displayAddress)}>
                    \${icons.copy}
                    \${copied ? 'Copied!' : 'Copy'}
                  </button>
                \` : null}
              </div>
            </div>
            \${showBalances ? html\`
              <div class="balance-item">
                <div class="balance-value">\${formatBalance(wallet.unshielded)}</div>
                <div class="balance-label">NIGHT (Unshielded)</div>
              </div>
              <div class="balance-item">
                <div class="balance-value">\${formatBalance(wallet.shielded)}</div>
                <div class="balance-label">NIGHT (Shielded)</div>
              </div>
              <div class="balance-item">
                <div class="balance-value">\${formatBalance(wallet.dust)}</div>
                <div class="balance-label">DUST</div>
              </div>
            \` : isMaster && walletSyncStatus === 'syncing' ? html\`
              <div class="balance-item" style="grid-column: 1 / -1; text-align: center;">
                <div class="sync-indicator" style="justify-content: center;">
                  <span class="sync-spinner"></span>
                  Syncing balances...
                </div>
              </div>
            \` : !isMaster ? html\`
              <div class="balance-item" style="grid-column: 1 / -1; text-align: center;">
                <div style="font-size: 13px; color: var(--mn-text-muted); padding: 8px 0;">
                  \${selectedWallet && selectedWallet.hasMnemonic ? 'Derived address — balances not available' : 'Address only — balances not available'}
                </div>
              </div>
            \` : null}
          </div>
        </div>

      \`;
    }

    // --- Sparkline ---
    function Sparkline({ data, color, width, height }) {
      if (!data || data.length < 2) {
        return html\`<svg class="sparkline-svg" viewBox="0 0 \${width} \${height}" preserveAspectRatio="none">
          <line x1="0" y1=\${height / 2} x2=\${width} y2=\${height / 2} stroke="var(--mn-border)" stroke-width="1" />
        </svg>\`;
      }
      const max = Math.max(...data, 1);
      const min = Math.min(...data, 0);
      const range = max - min || 1;
      const step = width / (data.length - 1);
      const points = data.map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');

      return html\`
        <svg class="sparkline-svg" viewBox="0 0 \${width} \${height}" preserveAspectRatio="none">
          <polyline points=\${points} fill="none" stroke=\${color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      \`;
    }

    // --- ResponseChart ---
    function ResponseChart({ health }) {
      const lastVal = (arr) => arr.length > 0 ? formatMs(arr[arr.length - 1]) : '--';
      return html\`
        <div class="card full-width chart-section fade-in" style="animation-delay: 600ms">
          <div class="card-header">
            <div class="card-title">
              \${icons.activity}
              Response Times
            </div>
          </div>
          <div class="sparkline-row">
            <span class="sparkline-label">Node</span>
            <\${Sparkline} data=\${health.node.history} color="var(--mn-accent)" width=\${400} height=\${32} />
            <span class="sparkline-value">\${lastVal(health.node.history)}</span>
          </div>
          <div class="sparkline-row">
            <span class="sparkline-label">Indexer</span>
            <\${Sparkline} data=\${health.indexer.history} color="#6b3bff" width=\${400} height=\${32} />
            <span class="sparkline-value">\${lastVal(health.indexer.history)}</span>
          </div>
          <div class="sparkline-row">
            <span class="sparkline-label">Proof Server</span>
            <\${Sparkline} data=\${health.proofServer.history} color="#9b3bff" width=\${400} height=\${32} />
            <span class="sparkline-value">\${lastVal(health.proofServer.history)}</span>
          </div>
        </div>
      \`;
    }

    // --- LogViewer ---
    function LogViewer({ logs }) {
      const [serviceFilter, setServiceFilter] = useState('all');
      const [levelFilter, setLevelFilter] = useState('all');
      const [searchText, setSearchText] = useState('');
      const [pinBottom, setPinBottom] = useState(true);
      const entriesRef = useRef(null);

      const filteredLogs = logs.filter(log => {
        if (serviceFilter !== 'all' && log.service !== serviceFilter) return false;
        if (levelFilter !== 'all' && log.level !== levelFilter) return false;
        if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase()) && !(log.raw || '').toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
      });

      useEffect(() => {
        if (pinBottom && entriesRef.current) {
          entriesRef.current.scrollTop = entriesRef.current.scrollHeight;
        }
      }, [filteredLogs.length, pinBottom]);

      const handleScroll = useCallback((e) => {
        const el = e.target;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        setPinBottom(atBottom);
      }, []);

      return html\`
        <div class="log-viewer fade-in" style="animation-delay: 750ms">
          <div class="log-toolbar">
            \${icons.terminal}
            <select class="log-select" value=\${serviceFilter} onChange=\${e => setServiceFilter(e.target.value)}>
              <option value="all">All Services</option>
              <option value="node">Node</option>
              <option value="indexer">Indexer</option>
              <option value="proof-server">Proof Server</option>
            </select>
            <select class="log-select" value=\${levelFilter} onChange=\${e => setLevelFilter(e.target.value)}>
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
            <input class="log-search" type="text" placeholder="Search logs..." value=\${searchText} onInput=\${e => setSearchText(e.target.value)} />
          </div>
          <div class="log-entries" ref=\${entriesRef} onScroll=\${handleScroll}>
            \${filteredLogs.map((log, i) => html\`
              <div class="log-line" key=\${log.service + '-' + i + '-' + (log.message || '').slice(0, 20)}>
                <span class="log-tag \${(log.service || '').replace('-', '')}">\${log.service || 'sys'}</span>
                <span class="log-level \${log.level}">\${(log.level || 'info').toUpperCase()}</span>
                <span class="log-message">\${log.message || log.raw || ''}</span>
              </div>
            \`)}
            \${filteredLogs.length === 0 && html\`
              <div class="log-line"><span class="log-message" style="color: var(--mn-text-muted)">No log entries</span></div>
            \`}
          </div>
        </div>
      \`;
    }

    // --- App ---
    function App() {
      const [state, setState] = useState(defaultState);
      const [connected, setConnected] = useState(false);
      const [toasts, setToasts] = useState([]);
      const wsRef = useRef(null);
      const reconnectTimer = useRef(null);
      const backoff = useRef(1000);
      const toastId = useRef(0);

      const addToast = useCallback((message, type) => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type, fading: false }]);
        setTimeout(() => {
          setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t));
        }, 2700);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
      }, []);

      const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, []);

      const sendCommand = useCallback((action) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'command', action }));
        }
      }, []);

      const sendMessage = useCallback((msg) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(msg));
        }
      }, []);

      const [deriveResult, setDeriveResult] = useState(null);
      const [showImportModal, setShowImportModal] = useState(false);
      const importHandlerRef = useRef(null);

      useEffect(() => {
        function connect() {
          const ws = new WebSocket(WS_URL);
          wsRef.current = ws;

          ws.addEventListener('open', () => {
            setConnected(true);
            backoff.current = 1000;
            // Auto-sync wallet on first connect
            ws.send(JSON.stringify({ type: 'command', action: 'sync-wallet' }));
          });

          ws.addEventListener('message', (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'state') {
                setState(msg.data);
              } else if (msg.type === 'result') {
                addToast(msg.message || (msg.success ? 'Command succeeded' : 'Command failed'), msg.success ? 'success' : 'error');
              } else if (msg.type === 'derive-result') {
                setDeriveResult(msg.address || null);
              }
            } catch (e) {
              // ignore malformed messages
            }
          });

          ws.addEventListener('close', () => {
            setConnected(false);
            scheduleReconnect();
          });

          ws.addEventListener('error', () => {
            ws.close();
          });
        }

        function scheduleReconnect() {
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
          reconnectTimer.current = setTimeout(() => {
            backoff.current = Math.min(backoff.current * 2, 30000);
            connect();
          }, backoff.current);
        }

        connect();

        return () => {
          if (wsRef.current) wsRef.current.close();
          if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        };
      }, [addToast]);

      return html\`
        <\${ConnectionStatus} connected=\${connected} />
        <\${ToastContainer} toasts=\${toasts} onRemove=\${removeToast} />
        <\${Header} networkStatus=\${state.networkStatus} onStart=\${() => sendCommand('start')} onStop=\${() => sendCommand('stop')} />
        <div class="cards-grid">
          <\${NodeCard} node=\${state.node} health=\${state.health.node} />
          <\${IndexerCard} indexer=\${state.indexer} health=\${state.health.indexer} />
          <\${ProofServerCard} proofServer=\${state.proofServer} health=\${state.health.proofServer} />
        </div>
        <div class="cards-grid">
          <\${WalletCard} wallet=\${state.wallet} walletSyncStatus=\${state.walletSyncStatus} sendMessage=\${sendMessage} onOpenImportModal=\${() => { setDeriveResult(null); setShowImportModal(true); }} importHandlerRef=\${importHandlerRef} />
        </div>
        <div class="cards-grid">
          <\${ResponseChart} health=\${state.health} />
        </div>
        <\${LogViewer} logs=\${state.logs} />
        \${showImportModal ? html\`
          <\${ImportWalletModal}
            onClose=\${() => setShowImportModal(false)}
            onImport=\${(w) => importHandlerRef.current && importHandlerRef.current(w)}
            sendMessage=\${sendMessage}
            deriveResult=\${deriveResult}
          />
        \` : null}
      \`;
    }

    render(html\`<\${App} />\`, document.getElementById('app'));
  </script>

  <!-- lucide-style icons rendered as inline SVGs above -->
</body>
</html>`;
}
