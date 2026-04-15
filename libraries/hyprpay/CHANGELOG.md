# Changelog

## [0.1.3]

### Fixed

- Exclude test files from subpaths build script (glob was picking up `*.test.ts`, bundling 617KB test files into the package)

## [0.1.2]

### Fixed

- Set correct default base URL to `https://app.montte.co` and fix RPC path from `/sdk/orpc` to `/api/sdk/hyprpay` — previous path never reached the server router

## [0.1.1]

### Fixed

- Better Auth plugin: replace request `after` hooks with `databaseHooks.user.create.after` — fires on every user creation regardless of sign-up method (email, magic link, OAuth, OTP); eliminates `TypeError: Cannot read properties of undefined (reading 'headers')` crash caused by raw async after-hook handlers returning `undefined` instead of a proper response object
- Better Auth plugin: replace try/catch on `onCustomerCreate` with `fromPromise` (neverthrow)
- Exclude test files from tsconfig and subpaths build script

## [0.1.0]

### Added

- Initial release of `@montte/hyprpay` SDK
- Customer lifecycle sync with Montte via oRPC contract
- Better Auth plugin integration (`./better-auth` subpath)
- Contract-first API design (`./contract` subpath)
