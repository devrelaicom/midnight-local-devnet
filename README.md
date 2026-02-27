# @aaronbassett/midnight-local-devnet

[![npm version](https://img.shields.io/npm/v/@aaronbassett/midnight-local-devnet)](https://www.npmjs.com/package/@aaronbassett/midnight-local-devnet)

A CLI and MCP (Model Context Protocol) server for managing a local Docker-based Midnight development network. It spins up a Midnight node, indexer, and proof server in Docker containers, initializes a genesis master wallet pre-loaded with NIGHT tokens and DUST, and provides commands to fund test accounts, generate wallets, and monitor network health -- all from the command line or from any MCP-compatible AI assistant.

## Prerequisites

- **Node.js >= 22**
- **Docker** (Docker Desktop or Docker Engine with Compose v2)

## Quick Start

### CLI

Run with no arguments to enter interactive mode:

```bash
npx @aaronbassett/midnight-local-devnet
```

Or start the network directly:

```bash
npx @aaronbassett/midnight-local-devnet start
```

### MCP Server

Add to your MCP client configuration (Claude Code, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "midnight-devnet": {
      "command": "npx",
      "args": ["-y", "-p", "@aaronbassett/midnight-local-devnet", "midnight-devnet-mcp"]
    }
  }
}
```

The MCP server communicates over stdio and exposes tools and resources that an AI assistant can use to manage the devnet on your behalf.

## CLI Command Reference

All commands can be run via `npx @aaronbassett/midnight-local-devnet <command>`.

| Command | Description | Options |
|---|---|---|
| `start` | Start the local Midnight devnet | `--pull` Pull latest Docker images |
| `stop` | Stop the devnet | `--remove-volumes` Remove volumes and containers |
| `restart` | Restart the network | `--pull`, `--remove-volumes` |
| `status` | Show network status and per-service info | |
| `logs` | Show network service logs | `--service <name>` (node, indexer, proof-server), `--lines <n>` (default: 50) |
| `health` | Check health of all services | |
| `balances` | Show master wallet NIGHT/DUST balances | |
| `fund <address>` | Fund a Bech32 address with NIGHT tokens | `--amount <n>` Amount in NIGHT (default: 50,000) |
| `fund-file <path>` | Fund all accounts from an accounts.json file | |
| `generate-accounts` | Generate random test accounts | `--count <n>`, `--format <mnemonic\|privateKey>`, `--output <path>`, `--fund`, `--register-dust` |
| `interactive` | Start interactive menu mode | |

Running with no arguments automatically enters interactive mode.

## MCP Tool Reference

| Tool | Description | Parameters |
|---|---|---|
| `start-network` | Start the devnet (node, indexer, proof-server) | `pull?` boolean |
| `stop-network` | Stop the devnet and close wallets | `removeVolumes?` boolean |
| `restart-network` | Restart the network | `pull?` boolean, `removeVolumes?` boolean |
| `network-status` | Get current network and per-service status | |
| `network-logs` | Get recent logs from services | `service?` (node, indexer, proof-server), `lines?` number |
| `health-check` | Check health of all service endpoints | |
| `get-network-config` | Get endpoint URLs, network ID, image versions | |
| `get-wallet-balances` | Get NIGHT and DUST balances of master wallet | |
| `fund-account` | Transfer NIGHT to a Bech32 address | `address` string, `amount?` string |
| `fund-account-from-mnemonic` | Derive wallet from mnemonic, fund NIGHT, register DUST | `name` string, `mnemonic` string |
| `fund-accounts-from-file` | Batch fund accounts from accounts.json | `filePath` string |
| `generate-test-account` | Generate random test accounts | `format` (mnemonic\|privateKey), `count?`, `fund?`, `registerDust?`, `outputFile?` |

## MCP Resource Reference

| URI | Description |
|---|---|
| `devnet://config` | Current network configuration: endpoints, network ID, Docker image versions |
| `devnet://status` | Live network status including per-service container state |

Resources are read-only and can be accessed by any MCP client to display context to an AI assistant.

## accounts.json Format

The `fund-file` CLI command and `fund-accounts-from-file` MCP tool accept a JSON file describing accounts to fund. Each account is identified by a mnemonic; the tool derives its wallet, transfers NIGHT tokens, and registers DUST.

```json
{
  "accounts": [
    {
      "name": "Alice",
      "mnemonic": "abandon abandon abandon ... art"
    },
    {
      "name": "Bob",
      "mnemonic": "zoo zoo zoo ... vote"
    }
  ]
}
```

See `accounts.example.json` for a complete example with valid 24-word BIP39 mnemonics.

Each account entry requires:

- **name** -- A display label for the account.
- **mnemonic** -- A 24-word BIP39 mnemonic phrase.

## Docker Services

The devnet runs three containers managed via Docker Compose:

| Service | Container Name | Image | Port | URL |
|---|---|---|---|---|
| Node | midnight-node | `midnightntwrk/midnight-node:0.20.0` | 9944 | `http://127.0.0.1:9944` |
| Indexer | midnight-indexer | `midnightntwrk/indexer-standalone:3.0.0` | 8088 | `http://127.0.0.1:8088/api/v3/graphql` |
| Proof Server | midnight-proof-server | `midnightntwrk/proof-server:7.0.0` | 6300 | `http://127.0.0.1:6300` |

The indexer also exposes a WebSocket endpoint at `ws://127.0.0.1:8088/api/v3/graphql/ws`.

The network ID is `undeployed` (development mode).

## Network Endpoints for DApp Development

When connecting a Midnight DApp to the local devnet, use the following configuration:

```typescript
const config = {
  indexer: 'http://127.0.0.1:8088/api/v3/graphql',
  indexerWS: 'ws://127.0.0.1:8088/api/v3/graphql/ws',
  node: 'http://127.0.0.1:9944',
  proofServer: 'http://127.0.0.1:6300',
  networkId: 'undeployed',
};
```

You can also retrieve this configuration at runtime via the `get-network-config` MCP tool or the `devnet://config` MCP resource.

## Development

To work on this project locally:

```bash
git clone https://github.com/devrelaicom/midnight-local-devnet.git
cd midnight-local-devnet
npm install
npm run build
```

Run the CLI from source:

```bash
node --enable-source-maps dist/cli.js start
```

Run the MCP server from source:

```bash
node --enable-source-maps dist/index.js
```

Run tests:

```bash
npm test
```

## Troubleshooting

### Docker containers fail to start

Make sure Docker is running and your user has permissions to use it:

```bash
docker info
```

If you see a permission error, add your user to the `docker` group or use `sudo`.

### Port conflicts

The devnet uses ports 9944, 8088, and 6300. If another process is using one of these ports, stop it before starting the devnet:

```bash
lsof -i :9944
lsof -i :8088
lsof -i :6300
```

### Containers are unhealthy

Run the health check to see which service is not responding:

```bash
npx @aaronbassett/midnight-local-devnet health
```

Check the logs for the failing service:

```bash
npx @aaronbassett/midnight-local-devnet logs --service node
npx @aaronbassett/midnight-local-devnet logs --service indexer
npx @aaronbassett/midnight-local-devnet logs --service proof-server
```

### Clean restart

If the network is in a broken state, do a clean restart that removes all volumes:

```bash
npx @aaronbassett/midnight-local-devnet restart --remove-volumes
```

This removes all chain data and starts fresh.

### Wallet sync takes too long

The master wallet must synchronize with the chain on first start. This can take 10--30 seconds depending on your machine. The CLI and MCP server wait for synchronization automatically.

### "Network is not running" error

The tool detects running containers on startup. If you stopped the containers externally (e.g. via `docker compose down`), run `start` again:

```bash
npx @aaronbassett/midnight-local-devnet start
```

## Acknowledgments

This project is based on [midnight-local-network](https://github.com/hbulgarini/midnight-local-network) by [@hbulgarini](https://github.com/hbulgarini). Thank you for the initial version that made this possible.

## License

MIT
