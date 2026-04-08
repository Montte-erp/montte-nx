---
title: Montte CLI — Authentication
description: Login, logout, and credential management for the Montte CLI
---

# Authentication

## Commands

### `montte login`

Stores your API key locally in `~/.montte/config.json`.

```bash
montte login --key <api-key>
montte login --key <api-key> --host https://api.staging.montte.com
```

| Option | Required | Description |
|--------|----------|-------------|
| `--key` | Yes | Your Montte API key (starts with `mnt_live_` or `mnt_test_`) |
| `--host` | No | Override the API base URL (default: `https://api.montte.com`) |

### `montte logout`

Removes stored credentials from `~/.montte/config.json`.

```bash
montte logout
```

### `montte whoami`

Prints the first 8 characters of the active API key and the host if overridden.

```bash
montte whoami
# API Key: mnt_live...
# Host: https://api.staging.montte.com
```

## Environment Variables

Environment variables take precedence over the config file:

| Variable | Description |
|----------|-------------|
| `MONTTE_API_KEY` | API key |
| `MONTTE_HOST` | API base URL override |

Useful for CI/CD pipelines:

```bash
MONTTE_API_KEY=${{ secrets.MONTTE_API_KEY }} montte transactions list --json
```

## Error: "Not logged in"

If you run a command without authentication you will see:

```
Not logged in. Run: montte login --key <your-api-key>
```

Fix: run `montte login --key <key>` or set `MONTTE_API_KEY`.
