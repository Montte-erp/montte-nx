# @tooling/boundary

Module boundary enforcement for the monorepo. Ensures import rules between layers are respected.

## Rules

```
apps      → can import from: packages, core, libraries, tooling
libraries → can import from: packages, core, tooling
packages  → can import from: core, tooling
core      → can import from: tooling
tooling   → cannot import from any workspace layer
```

Packages within the same layer can import from each other.

## Usage

```bash
bun run check-boundaries
```

Scans all `.ts`/`.tsx` source files and reports violations.
