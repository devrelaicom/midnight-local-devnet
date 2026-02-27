# npm Publishing Design

## Goal

Rename the package to `@aaronbassett/midnight-local-devnet` and set up automated publishing to npm via GitHub Actions so users can run:

```bash
# CLI
npx @aaronbassett/midnight-local-devnet start

# MCP server config
{
  "mcpServers": {
    "midnight-devnet": {
      "command": "npx",
      "args": ["-y", "-p", "@aaronbassett/midnight-local-devnet", "midnight-devnet-mcp"]
    }
  }
}
```

## Package Configuration

Update `package.json`:

- **name**: `@aaronbassett/midnight-local-devnet`
- **Remove** `"private": true`
- **Add** `"publishConfig": { "access": "public" }` (required for scoped packages)
- **Add** `"files": ["dist/", "docker/"]` — whitelist only shipped artifacts
- **Update** `"bin"`:
  - `"midnight-local-devnet": "./dist/cli.js"` — the CLI (matches npx resolution for scoped packages)
  - `"midnight-devnet-mcp": "./dist/index.js"` — the MCP server
- **Add** metadata: `"description"`, `"repository"`, `"license"`, `"keywords"`

## GitHub Actions Workflow

### Publish Workflow (`.github/workflows/publish.yml`)

- **Trigger**: Push of tags matching `v*`
- **Single job** on `ubuntu-latest`
- **Steps**: checkout → setup Node 22 → `npm ci` → `npm run build` → `npm test` → `npm publish --provenance --access public`
- **Permissions**: `contents: read`, `id-token: write` (npm provenance via OIDC)
- **Secret**: `NPM_TOKEN` (granular access token scoped to `@aaronbassett/*`)

### Release Process

```bash
npm version patch   # or minor/major — bumps package.json and creates git tag
git push --follow-tags
# GitHub Action triggers automatically
```

## Code Changes

1. **`src/index.ts`** — add `#!/usr/bin/env node` shebang (needed for bin entry)
2. **`src/cli.ts`** — update `.name('midnight-devnet')` to `.name('midnight-local-devnet')` to match bin name
3. **No `.npmrc` needed** — `publishConfig` handles registry config
4. **No `.gitignore` changes** — already ignores `dist/` and `*.tgz`

## Architecture Decision: MCP Invocation

Chose separate bin entry (`midnight-devnet-mcp`) over a `--mcp` flag on the main CLI. Rationale:
- Cleaner separation of concerns
- MCP server config doesn't need to know about CLI flag syntax
- Each entry point has a single responsibility
