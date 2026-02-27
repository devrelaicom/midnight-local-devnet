# npm Publishing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the package to `@aaronbassett/midnight-local-devnet`, configure it for npm publishing, and add a GitHub Actions workflow for automated tag-based releases with provenance.

**Architecture:** Single npm package with two bin entry points — CLI (`midnight-local-devnet`) and MCP server (`midnight-devnet-mcp`). Publishing is triggered by pushing `v*` git tags, handled by a single GitHub Actions job that builds, tests, and publishes with npm provenance.

**Tech Stack:** npm (publishing), GitHub Actions (CI/CD), Node.js 22

---

### Task 1: Update package.json for npm publishing

**Files:**
- Modify: `package.json`

**Step 1: Update package.json**

Replace the entire `package.json` with these changes applied:

1. Change `"name"` from `"midnight-local-devnet"` to `"@aaronbassett/midnight-local-devnet"`
2. Remove `"private": true`
3. Add `"description": "Local Midnight development network manager — CLI and MCP server"`
4. Add after `"version"`:
   ```json
   "description": "Local Midnight development network manager — CLI and MCP server",
   "license": "MIT",
   "repository": {
     "type": "git",
     "url": "git+https://github.com/devrelaicom/midnight-local-devnet.git"
   },
   "keywords": ["midnight", "blockchain", "devnet", "mcp", "development"],
   "publishConfig": {
     "access": "public"
   },
   "files": [
     "dist/",
     "docker/"
   ],
   ```
5. Change `"bin"` from:
   ```json
   "bin": {
     "midnight-devnet": "./dist/cli.js"
   },
   ```
   to:
   ```json
   "bin": {
     "midnight-local-devnet": "./dist/cli.js",
     "midnight-devnet-mcp": "./dist/index.js"
   },
   ```

**Step 2: Verify the changes parse correctly**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).name)"`
Expected: `@aaronbassett/midnight-local-devnet`

**Step 3: Run existing tests to confirm nothing is broken**

Run: `npm test`
Expected: All 30 unit tests pass (4 integration tests skipped)

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: rename package to @aaronbassett/midnight-local-devnet and configure for npm publishing"
```

---

### Task 2: Add shebang to MCP entry point

**Files:**
- Modify: `src/index.ts`

**Step 1: Add shebang line**

Add `#!/usr/bin/env node` as the very first line of `src/index.ts`, before the existing `// src/index.ts` comment. The file should start:

```typescript
#!/usr/bin/env node
// src/index.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
```

**Step 2: Build to verify compilation**

Run: `npm run build`
Expected: Compiles successfully with no errors.

**Step 3: Verify shebang is in compiled output**

Run: `head -1 dist/index.js`
Expected: `#!/usr/bin/env node`

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "chore: add shebang to MCP server entry point for bin usage"
```

---

### Task 3: Update CLI program name

**Files:**
- Modify: `src/cli.ts`

**Step 1: Update the Commander program name**

In `src/cli.ts`, change line 35:

From: `.name('midnight-devnet')`
To: `.name('midnight-local-devnet')`

**Step 2: Build and run help to verify**

Run: `npm run build && node dist/cli.js --help`
Expected: Help output shows `Usage: midnight-local-devnet [options] [command]`

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "chore: update CLI program name to match new bin entry"
```

---

### Task 4: Create GitHub Actions publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1: Create the workflow directory**

Run: `mkdir -p .github/workflows`

**Step 2: Create the publish workflow**

Create `.github/workflows/publish.yml` with this exact content:

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Step 3: Validate YAML syntax**

Run: `node -e "const fs = require('fs'); const yaml = fs.readFileSync('.github/workflows/publish.yml', 'utf8'); console.log('YAML length:', yaml.length, 'bytes — looks valid')"`
Expected: Prints byte count without error. (Full YAML validation requires a parser, but this confirms the file exists and is readable.)

**Step 4: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add GitHub Actions workflow for automated npm publishing"
```

---

### Task 5: Verify end-to-end with dry-run publish

**Files:**
- No file changes — validation only

**Step 1: Clean build**

Run: `rm -rf dist && npm run build`
Expected: Clean compilation.

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 3: Dry-run npm pack to verify package contents**

Run: `npm pack --dry-run`
Expected output should show:
- `dist/` files (compiled JS, declarations, source maps)
- `docker/` files (standalone.yml)
- `package.json`
- No `src/`, `node_modules/`, `.env`, or test files included

**Step 4: Verify bin entries resolve correctly**

Run: `node -e "const pkg = require('./package.json'); Object.entries(pkg.bin).forEach(([name, path]) => { const fs = require('fs'); const exists = fs.existsSync(path); console.log(name, '->', path, exists ? 'OK' : 'MISSING'); })"`
Expected:
```
midnight-local-devnet -> ./dist/cli.js OK
midnight-devnet-mcp -> ./dist/index.js OK
```

**Step 5: Verify both shebangs**

Run: `head -1 dist/cli.js && head -1 dist/index.js`
Expected:
```
#!/usr/bin/env node
#!/usr/bin/env node
```

---

### Task 6: Final commit and summary

**Files:**
- No file changes — wrap-up only

**Step 1: Verify clean git state**

Run: `git status`
Expected: Clean working tree, all changes committed.

**Step 2: Verify all commits**

Run: `git log --oneline -5`
Expected: 4 new commits for tasks 1-4.

**Step 3: Document the release process**

Print this summary for the user:

> **Setup required (one-time):**
> 1. Create an npm Granular Access Token at https://www.npmjs.com/settings/aaronbassett/tokens — scope it to publish packages under `@aaronbassett/*`
> 2. Add the token as `NPM_TOKEN` in GitHub repo secrets: https://github.com/devrelaicom/midnight-local-devnet/settings/secrets/actions
>
> **To publish a release:**
> ```bash
> npm version patch   # or minor / major
> git push --follow-tags
> ```
>
> **Users can then run:**
> ```bash
> # CLI
> npx @aaronbassett/midnight-local-devnet start
>
> # MCP server config
> {
>   "mcpServers": {
>     "midnight-devnet": {
>       "command": "npx",
>       "args": ["-y", "-p", "@aaronbassett/midnight-local-devnet", "midnight-devnet-mcp"]
>     }
>   }
> }
> ```
