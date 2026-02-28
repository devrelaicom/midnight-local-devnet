# Browser-Based Dashboard Design

**Date:** 2026-02-28
**Status:** Approved
**Replaces:** Terminal dashboard (ink/React TUI)

## Summary

Replace the terminal-based ink/React dashboard with a browser-based dashboard. The `dashboard` CLI command starts a local Hono HTTP server, opens the user's default browser, and serves a single-page dashboard built with Preact + HTM (no build step). Live data flows over WebSocket. The browser can also send commands (start/stop network, fund wallets) back to the server.

## Architecture

```
CLI Command
  → Starts Hono server on localhost:PORT
  → Opens default browser
  → Ctrl+C gracefully shuts down

Hono Server (src/cli/dashboard/)
  ├─ GET /         → Single HTML page (inline CSS + JS)
  ├─ WS /ws        → WebSocket (live data + commands)
  └─ Polling Layer  → Reuses existing core modules
      ├─ substrate-rpc.ts    (node, 5s)
      ├─ proof-server-api.ts (proof, 10s)
      ├─ health.ts           (response times, 10s)
      ├─ docker.ts           (logs 3s, containers 10s)
      └─ wallet.ts           (balances, 10s)

Browser (single HTML file, no build step)
  ├─ Preact + HTM via ESM import maps (esm.sh CDN)
  ├─ Inter + JetBrains Mono via Google Fonts
  ├─ CSS custom properties (Midnight palette)
  ├─ WebSocket client with auto-reconnect
  └─ Responsive CSS Grid layout
```

### Key Decisions

- **Server-side polling** — single source of truth; one connection per service regardless of browser tab count
- **Single HTML file** — inline `<style>` and `<script type="module">`, served from a TypeScript template string; no static file directory
- **Preact + HTM from CDN** — zero frontend build step, component model without tooling overhead
- **WebSocket (not SSE)** — enables bidirectional communication for browser→server commands

## WebSocket Protocol

### Server → Client: State Snapshot (every 3-5s)

```json
{
  "type": "state",
  "data": {
    "node": {
      "chain": "midnight-devnet",
      "version": "0.1.0",
      "blockHeight": 1234,
      "avgBlockTime": 6.2,
      "peers": 0,
      "syncing": false,
      "responseTime": 45
    },
    "indexer": {
      "ready": true,
      "responseTime": 32
    },
    "proofServer": {
      "version": "0.8.0",
      "ready": true,
      "jobsProcessing": 1,
      "jobsPending": 0,
      "jobCapacity": 4,
      "proofVersions": ["1.0.0"]
    },
    "wallet": {
      "address": "0x...",
      "connected": true,
      "unshielded": "1000000",
      "shielded": "0",
      "dust": "500000"
    },
    "health": {
      "node": { "status": "healthy", "history": [45, 42, 50] },
      "indexer": { "status": "healthy", "history": [32, 35] },
      "proofServer": { "status": "healthy", "history": [120, 115] }
    },
    "containers": [
      { "name": "midnight-node", "status": "running", "port": 9944 }
    ],
    "logs": [
      { "service": "node", "level": "info", "message": "...", "timestamp": "..." }
    ]
  }
}
```

### Client → Server: Commands

```json
{ "type": "command", "action": "start" }
{ "type": "command", "action": "stop" }
{ "type": "command", "action": "fund", "address": "0x..." }
```

### Server → Client: Command Results

```json
{ "type": "result", "action": "start", "success": true }
{ "type": "result", "action": "start", "success": false, "error": "Docker not running" }
```

Balances serialized as strings (bigint). History arrays capped at 30 entries. Logs limited to last 100 entries per push.

## UI Layout

### Desktop (>1024px)

```
┌─ Header ────────────────────────────────────────────────┐
│  ◈ Midnight Devnet          ● Running   [Stop] [Fund]   │
└─────────────────────────────────────────────────────────┘

┌─ Node ──────────┐ ┌─ Indexer ───────┐ ┌─ Proof Server ──┐
│ Block #1234      │ │ ● Ready         │ │ ● Ready          │
│ ~6.2s block time │ │ 32ms response   │ │ Jobs: 1/4        │
│ 0 peers          │ │                 │ │ Pending: 0       │
│ v0.1.0           │ │                 │ │ v0.8.0           │
└─────────────────┘ └─────────────────┘ └──────────────────┘

┌─ Wallet ────────────────────────────────────────────────┐
│ 0x1234...abcd                                           │
│ NIGHT: 1,000,000 (unshielded) + 0 (shielded)           │
│ DUST:  500,000                                          │
└─────────────────────────────────────────────────────────┘

┌─ Response Times ────────────────────────────────────────┐
│ [SVG sparkline charts for node/indexer/proof]            │
└─────────────────────────────────────────────────────────┘

┌─ Logs ──────────────────────────────────────────────────┐
│ [Filter: All ▾] [Level: All ▾] [Search: ________]       │
│ 12:34:56 node    INFO  Block #1234 imported              │
│ ...scrollable, auto-scroll with pin-to-bottom...         │
└─────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

- **Desktop (>1024px):** 3 service cards in a row, wallet full-width
- **Tablet (768-1024px):** 2 cards per row, stacking
- **Mobile (<768px):** Single column

### Component Tree (Preact + HTM)

```
App
├── Header (network status, action buttons)
├── ServiceCards
│   ├── NodeCard
│   ├── IndexerCard
│   └── ProofServerCard
├── WalletCard
├── ResponseChart (SVG sparklines)
└── LogViewer (filter dropdowns, search, auto-scroll)
```

## Visual Design

### Color System

Midnight palette via CSS custom properties — deep blue-tinged darks with vivid indigo accents:

- Surfaces: `--mn-void` (#09090f), `--mn-surface` (#0f0f1e), `--mn-surface-alt` (#14142b)
- Borders: `--mn-border` (#1c1c3a), `--mn-border-bright` (#2a2a50)
- Accent: `--mn-accent` (#3b3bff), `--mn-accent-hover` (#5252ff), `--mn-accent-muted` (#2a2aaa)
- Text: `--mn-text` (#f0f0ff), `--mn-text-secondary` (#8080aa), `--mn-text-muted` (#505070)
- Semantic: `--mn-success` (#22c55e), `--mn-warning` (#eab308), `--mn-error` (#ef4444)
- Gradients: hero, accent, card overlays

### Typography

- **Body:** Inter (Google Fonts)
- **Monospace:** JetBrains Mono (Google Fonts) — all addresses, hashes, contract IDs, log messages

### Visual Language

- Dot-grid background pattern on page (`radial-gradient` at ~2% opacity)
- Accent glow orbs behind focal elements
- Outlined/stroke icons (Lucide via CDN) in `--mn-text-secondary` or `--mn-accent`
- Cards with `--mn-gradient-card` overlay on hover

### Motion

- Staggered fade-in + translate-y(8px) on page load
- `transition-all 200ms ease-out` on card hover
- Pulsing accent glow for active proof generation
- Smooth color transitions for transaction state changes
- No bounce, spring, or playful easing

## File Structure

### New Files

```
src/cli/dashboard/
├── server.ts           # Hono app, routes, WS, polling orchestration
├── state-collector.ts  # Aggregates core module data into state snapshot
└── html.ts             # Full HTML string (inline CSS + Preact/HTM JS)
```

### Kept Files (reused by server)

```
src/cli/dashboard/lib/
├── substrate-rpc.ts     # Substrate JSON-RPC client
├── proof-server-api.ts  # Proof server REST client
└── log-parser.ts        # Docker log parsing
```

### Deleted Files (old TUI)

```
src/cli/dashboard/
├── app.tsx              # ink root component
├── types.ts             # TUI-specific types
├── layouts/             # small, medium, large layouts
├── panels/              # node, indexer, proof, wallet, log, response-graph
├── components/          # panel-box, gauge, sparkline, status-badge
└── hooks/               # all use-*.ts polling hooks
```

### Modified Files

```
src/cli/commands/dashboard.ts  # Rewrite: Hono server + browser open
```

## Dependencies

### Added

- `hono` — HTTP framework
- `@hono/node-server` — Node.js adapter
- `open` — Cross-platform browser opener

### Removed

- `ink` — terminal UI framework
- `react` — React (was required by ink)
- `@types/react` — React types (dev)
- `ink-testing-library` — TUI test utils (dev)

## CLI Behavior

```bash
$ midnight-local-devnet dashboard
Dashboard running at http://localhost:31780
Press Ctrl+C to stop
```

- Port selection: start at 31780, increment if in use, max 10 attempts
- Auto-opens default browser via `open` package
- `--no-open` flag to suppress browser auto-open
- `--port <n>` flag to specify port
- Ctrl+C → graceful shutdown: close WS connections, stop server, shutdown network manager

## Error Handling

- **Port in use:** Try next port, up to 10 attempts
- **WebSocket disconnect:** Client auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s)
- **Service unavailable:** Card shows "offline" state with `--mn-error` color
- **Network not running:** Dashboard shows empty state with "Start Network" CTA
- **Command failure:** Toast/notification with error message from server

## Testing Strategy

- **Server tests:** Unit tests for state-collector (mock core modules), WebSocket message handling
- **HTML generation:** Snapshot test for html.ts output
- **Integration:** Manual testing of full flow (start dashboard → browser opens → live updates)
