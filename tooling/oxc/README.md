# @tooling/oxc

Shared [oxlint](https://oxc.rs) and [oxfmt](https://oxc.rs) configuration for the monorepo.

## Config Files

| File            | Purpose                          |
| --------------- | -------------------------------- |
| `base.json`     | Base oxlint rules for all layers |
| `apps.json`     | Overrides for `apps/`            |
| `core.json`     | Overrides for `core/`            |
| `packages.json` | Overrides for `packages/`        |
| `oxfmt.json`    | oxfmt formatter configuration    |

## Usage

Referenced in root `package.json` scripts:

```bash
bun run check    # oxlint
bun run format   # oxfmt
```
