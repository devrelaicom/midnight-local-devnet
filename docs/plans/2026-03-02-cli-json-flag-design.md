# CLI `--json` Flag Design

## Goal

Add a `--json` flag to the CLI so all data-returning commands produce machine-parseable JSON on stdout, enabling scripting and piping (e.g. `midnight-local-devnet status --json | jq .`).

## Approach

Global flag on the root Commander program + a shared output helper.

### Output helper (`src/cli/output.ts`)

```typescript
interface OutputOptions { json?: boolean }
function output(data: unknown, opts: OutputOptions): void
function outputError(error: unknown, opts: OutputOptions): void
```

- `output()`: JSON mode writes `JSON.stringify(data, bigintReplacer, 2)` to stdout. Otherwise uses `console.table`/`console.log` as today.
- `outputError()`: JSON mode writes `{"error": "message"}` to stdout, sets `process.exitCode = 1`. Otherwise writes to stderr.
- Bigint replacer converts `bigint` values to strings for JSON serialization.

### Logger redirect

When `--json` is active, pino logger destination switches from `stdout` to `stderr` so progress messages don't contaminate the JSON output stream.

### Strict output

In `--json` mode, only valid JSON appears on stdout. All progress text ("Starting Midnight local devnet...") and log messages go to stderr or are suppressed.

## Per-command JSON shapes

| Command | JSON shape |
|---------|-----------|
| `start` | `{ status, services: [{name, port, url, status}] }` |
| `stop` | `{ status: "stopped" }` |
| `restart` | `{ status: "restarted" }` |
| `status` | `{ running, services: [{name, port, url, status}] }` |
| `health` | `{ node: {healthy, responseTime}, indexer: {...}, proofServer: {...}, allHealthy }` |
| `balances` | `{ unshielded, shielded, dust, total }` |
| `fund` | `{ address, amount, txHash }` |
| `fund-file` | `[{ name, address, amount, hasDust }]` |
| `generate-accounts` | `[{ name, address, mnemonic? }]` |
| `logs` | `[{ service, level, message, timestamp? }]` |

Notes:
- `generate-accounts` includes full mnemonic in JSON mode (not truncated).
- All bigint values serialized as strings.

## Error handling

Errors in `--json` mode output `{"error": "message"}` to stdout with exit code 1.

## Testing

Unit tests for the `output()` and `outputError()` helpers.
