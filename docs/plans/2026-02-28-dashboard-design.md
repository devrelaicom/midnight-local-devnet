# Dashboard Command Design

**Date:** 2026-02-28
**Status:** Approved
**Scope:** Remove default interactive mode, add `dashboard` command

## Overview

Two changes to the CLI:

1. **Remove default interactive mode** — Running `midnight-local-devnet` with no subcommand now shows help (Commander default). The interactive mode remains available via `midnight-local-devnet interactive`.
2. **Add `dashboard` command** — A gtop-style realtime terminal dashboard showing the state of all local Midnight devnet services. Designed for a secondary terminal pane while developing in Claude Code or similar.

## Technology

- **ink** (React for CLIs) — Flexbox layout, component composition, built-in focus management
- **Independent polling hooks** — Each data source has its own React hook with its own poll interval
- No RxJS-to-React bridge complexity; wallet state bridged via `useEffect` + `subscribe`

## Data Sources

| Source | API | Poll Interval | Data |
|--------|-----|---------------|------|
| Docker | `docker compose ps` | 5s | Container status per service |
| Node | Substrate JSON-RPC `:9944` | 5s | Block height, chain name, peers, sync, version, block time |
| Indexer | HTTP `:8088/ready` + GraphQL | 10s | Indexed height, lag vs node, readiness |
| Proof Server | REST `:6300` | 10s | Version, proof versions, jobs processing/pending/capacity |
| Health | HTTP endpoints | 10s | Per-service response times (with history for sparklines) |
| Wallet | SDK `wallet.state()` rxjs | Reactive | Per-address NIGHT (unshielded + shielded), DUST |
| Logs | `docker compose logs --tail` | 3s | Combined log stream from all services |

### Proof Server API

| Endpoint | Response |
|----------|----------|
| `/health` | `{"status":"ok","timestamp":"..."}` |
| `/version` | Plain text, e.g. `8.0.0-rc.4` |
| `/ready` | `{"status":"ok","jobsProcessing":N,"jobsPending":N,"jobCapacity":N,"timestamp":"..."}` (503 when busy) |
| `/proof-versions` | Plain text, e.g. `["V2"]` |

### Substrate Node JSON-RPC

| Method | Returns |
|--------|---------|
| `system_chain` | Chain name |
| `system_name` | Node name |
| `system_version` | Version string |
| `system_health` | `{ peers, isSyncing, shouldHavePeers }` |
| `chain_getHeader` | Best block header (number, timestamp) |

## Responsive Breakpoints

Three breakpoints at 40 / 80 / 120 columns:

### Small (< 40 cols)

Single column, ultra-compact. Each service on one line with inline status. Wallet shows selected address only. Logs get remaining vertical space.

```
┌─ Midnight Devnet ──────────┐
│ ● node    :9944  ▲ #1042   │
│ ● indexer :8088  ▲ #1040   │
│ ● proof   :6300  ▲ 0/4     │
├─ Wallet (master) ──────────┤
│ NIGHT  50,000              │
│ DUST    1,234              │
├─ Logs ─────────────────────┤
│ [node]  new block #1042    │
│ [idx]   synced to #1040    │
│ [proof] job complete       │
└────────────────────────────┘
```

### Medium (40-119 cols)

Two-column grid. Per-service detail panels. Wallet shows address list. Logs span full width at bottom with filter controls.

```
┌─ Node ────────────┬─ Proof Server ────┐
│ Block: #1042      │ Version: 8.0.0    │
│ Chain: midnight    │ Proofs: V2        │
│ Peers: 0          │ Jobs: 1/4 proc    │
│ Sync: idle        │ Pending: 0        │
│ Version: 0.20.0   │ Status: Ready     │
├─ Indexer ─────────┼─ Wallet ──────────┤
│ Indexed: #1040    │ > master          │
│ Lag: 2 blocks     │   NIGHT  50,000   │
│ Status: ready     │   DUST    1,234   │
│                   │   dev-1            │
│                   │   NIGHT   5,000   │
├─ Logs (all) ──────┴───────────────────┤
│ [node]  new block #1042              │
│ [idx]   indexing block #1041         │
│ [proof] proof job started            │
│ Filter: s=service l=level /=search   │
└──────────────────────────────────────┘
```

### Large (120+ cols)

Three-column top row with all service panels + wallet. Response time sparklines. Logs panel with full filter bar.

```
┌─ Node ──────────────┬─ Indexer ─────────┬─ Proof Server ─────┬─ Wallet ──────────┐
│ Block: #1042        │ Indexed: #1040    │ Version: 8.0.0     │ > master          │
│ Avg time: 6.2s      │ Lag: 2 blocks     │ Proofs: V2         │   NIGHT  50,000   │
│ Chain: midnight      │ Status: ready     │ Status: Ready      │   DUST    1,234   │
│ Peers: 0            │ Response: 8ms     │ Jobs: ██░░ 1/4     │   dev-1            │
│ Sync: idle          │                   │ Pending: 0         │   NIGHT   5,000   │
│ Version: 0.20.0     │                   │ Capacity: 75%      │                   │
├─ Response Times ────┴───────────────────┼────────────────────┴───────────────────┤
│ node  ▂▃▃▂▅▃▃▂▃▃ 12ms                  │ Logs (all services)                   │
│ idx   ▂▂▂▃▂▂▂▂▂▂  8ms                  │ [node]  new block #1042               │
│ proof ▃▅▇▅▃▅▇▅▃▃ 45ms                  │ [idx]   indexing block #1041          │
│                                         │ [proof] proof job started             │
│                                         │ Filter: s=service l=level /=search    │
└─────────────────────────────────────────┴───────────────────────────────────────┘
```

## Component Architecture

```
<App>
  ├── useTerminalSize()
  ├── useBreakpoint(width) → 'small' | 'medium' | 'large'
  │
  ├── Data hooks:
  │   ├── useServices()          — docker ps, 5s poll
  │   ├── useNodeInfo()          — JSON-RPC to node, 5s poll
  │   ├── useIndexerInfo()       — indexer ready + GraphQL, 10s poll
  │   ├── useProofServer()       — /ready, /version, /proof-versions, 10s poll
  │   ├── useHealth()            — health endpoints + response time history, 10s poll
  │   ├── useWalletState()       — rxjs wallet.state() bridge, reactive
  │   └── useLogs()              — docker compose logs, 3s poll
  │
  ├── <Header />                 — title + uptime + network status
  │
  ├── Layout (breakpoint-switched):
  │   ├── <NodePanel />          — block height, avg block time, chain, peers, sync, version
  │   ├── <IndexerPanel />       — indexed height, lag vs node, status
  │   ├── <ProofPanel />         — version, proof versions, jobs gauge, status
  │   ├── <WalletPanel />        — multi-address list, switchable, per-address balances
  │   ├── <LogPanel />           — combined color-coded stream, filterable
  │   └── <ResponseGraph />      — sparkline of response time history (large only)
  │
  └── <StatusBar />              — keybind help, focused panel name
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Cycle focus between panels |
| Up/Down | Scroll logs (when LogPanel focused), switch address (when WalletPanel focused) |
| `s` | Cycle log service filter (all → node → indexer → proof-server → all) |
| `l` | Cycle log level filter (all → info → warn → error → all) |
| `/` | Enter substring search mode for logs |
| `q` / Ctrl+C | Exit dashboard |

## File Structure

```
src/cli/
  dashboard/
    app.tsx                    — Root component, breakpoint logic, layout switching
    hooks/
      use-terminal-size.ts     — Watch stdout columns/rows via resize event
      use-services.ts          — Poll docker compose ps
      use-node-info.ts         — JSON-RPC calls to node
      use-indexer-info.ts      — Indexer ready + GraphQL block height
      use-proof-server.ts      — Proof server REST endpoints
      use-health.ts            — Health checks with response time history
      use-wallet-state.ts      — rxjs wallet.state() → React state bridge
      use-logs.ts              — Poll docker compose logs, parse + filter
    panels/
      node-panel.tsx           — Node details display
      indexer-panel.tsx        — Indexer details display
      proof-panel.tsx          — Proof server details, job capacity gauge
      wallet-panel.tsx         — Multi-address list, balance display
      log-panel.tsx            — Color-coded, filterable, scrollable logs
      response-graph.tsx       — Sparkline of response time history (large only)
    layouts/
      small.tsx                — Single column compact layout
      medium.tsx               — Two-column grid
      large.tsx                — Three-column with graphs
    components/
      panel-box.tsx            — Reusable bordered panel with title, focus highlight
      status-badge.tsx         — Color-coded status indicator (●)
      gauge.tsx                — Visual capacity bar (proof server jobs)
      sparkline.tsx            — Unicode sparkline chart
    lib/
      substrate-rpc.ts         — Minimal Substrate JSON-RPC client (fetch-based)
      proof-server-api.ts      — Proof server REST client
      log-parser.ts            — Parse docker compose log lines, extract service/level
  commands/
    dashboard.ts               — Commander registration, launches ink render
```

## Error Handling

- **Network not running:** Dashboard starts regardless. Panels show "offline" / "unavailable" states. Polls continue — panels update live when services come up.
- **Wallet failure:** WalletPanel shows "Connecting..." spinner. If init fails, shows "Wallet unavailable." Retries when services transition to running.
- **Partial failures:** Each panel is independent. One service down doesn't affect others.
- **Terminal resize:** Debounced by 100ms. Ink handles re-render.
- **Graceful exit:** Close wallet connection, clear screen, restore terminal. Never stops Docker containers.

## Dependencies

New production dependencies:
- `ink` — React terminal UI framework
- `react` — Required by ink
- `ink-spinner` — Loading spinners (optional, ink may include)

New dev dependencies:
- `@types/react` — React type definitions
- `ink-testing-library` — Test helper for ink components

## Testing

- **Unit tests:** `substrate-rpc.ts`, `proof-server-api.ts`, `log-parser.ts` with mocked fetch
- **Hook tests:** Each hook tested with mocked data sources
- **Component tests:** Panels tested via ink's `render()` test helper
- **Integration test:** Render App with mocked hooks, verify layout switches at breakpoints

## CLI Changes

- Remove auto-launch of interactive mode when no subcommand given
- Keep `interactive.ts` — register as `midnight-local-devnet interactive` command
- Add `midnight-local-devnet dashboard` command
- No subcommand → Commander shows help (default behavior)
