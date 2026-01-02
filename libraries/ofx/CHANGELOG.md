# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2026-01-02

### Added

- `decodeOfxBuffer(buffer: Uint8Array): string` - Decodes an OFX buffer to string with automatic charset detection
  - Detects encoding from OFX header (CHARSET field)
  - Handles windows-1252, UTF-8, and Latin-1 variants
  - Single source of truth for buffer decoding across the library

### Changed

- Refactored `parseBuffer` to use `decodeOfxBuffer` internally
- Refactored `parseBatchStream` to use `decodeOfxBuffer` instead of inline encoding detection
  - Removed ~12 lines of duplicate charset detection code
- Consolidated all buffer-to-string conversion logic into `decodeOfxBuffer`

## [2.3.1] - 2025-12-31

### Changed

- **WHATWG-compliant encoding mapping**: ISO-8859-1 / Latin-1 variants now map to `windows-1252`
  - `8859-1`, `ISO-8859-1`, `LATIN1`, `LATIN-1` → `windows-1252` (previously `iso-8859-1`)
  - Per WHATWG Encoding Standard, browsers treat ISO-8859-1 as windows-1252
  - Improves compatibility with real-world OFX files from Brazilian banks
- Default header parsing encoding changed from `iso-8859-1` to `windows-1252`
- Replaced `as any` type casts with `as Bun.Encoding` for TextDecoder instances
- Removed biome-ignore lint suppressions that are no longer needed
- Removed unused type imports (`OFXAccountType`, `OFXTransactionType`) from generator module

## [2.3.0] - 2025-12-25

### Added

- Zod schemas for generator input validation
  - `generateHeaderOptionsSchema` - Runtime validation for OFX header generation options
  - `generateTransactionInputSchema` - Runtime validation for transaction input
  - `generateBankStatementOptionsSchema` - Runtime validation for bank statement options
  - `generateCreditCardStatementOptionsSchema` - Runtime validation for credit card statement options
  - All generator types now use `z.infer<typeof schema>` for type safety

### Security

- **CRITICAL**: Added prototype pollution protection in SGML parser
  - Prevents malicious OFX files from polluting `__proto__`, `constructor`, or `prototype`
  - Protects against potential remote code execution via crafted OFX data
- Improved hash collision resistance in auto-generated FITID values
  - Changed from `hash & hash` (redundant) to `hash | 0` (proper 32-bit conversion)
  - Better hash distribution reduces collision probability

### Changed

- Consolidated duplicate entity decoding logic into shared utilities
  - Removed 20+ lines of duplicate code between `parser.ts` and `stream.ts`
  - Single source of truth for HTML entity handling (`ENTITY_MAP`, `ENTITY_REGEX`, `decodeEntities`)
- Made internal-only schemas non-exported from public API
  - `extendedAccountTypeSchema` and `flexibleBankAccountSchema` remain internal
  - Added documentation explaining their purpose (Brazilian bank OFX quirks)
- Converted `DateComponents` from interface to Zod schema for consistency
- Improved TypeScript type annotations for `TextDecoder` encoding parameters
  - Replaced awkward `as unknown as "utf-8"` casts with documented `as any` + biome-ignore
  - Added clear comments explaining runtime vs TypeScript type limitations

### Fixed

- TypeScript compilation errors in strict mode for encoding parameters

## [2.2.0] - 2025-12-23

### Added

- Batch streaming API for processing multiple OFX files in a single operation
  - `parseBatchStream(files)` - AsyncGenerator yielding batch events (file_start, transaction, file_complete, batch_complete)
  - `parseBatchStreamToArray(files)` - Helper to collect all batch results into arrays
  - `BatchFileInput` type for batch file input (filename + buffer)
  - `BatchStreamEvent` type for typed batch event handling
  - `BatchParsedFile` type for parsed file results
- Progress tracking per file with transaction counts
- Error isolation: one file failing doesn't stop the batch
- Yields control to main thread between files for UI responsiveness

### Performance

- Memory-efficient sequential file processing
- ~66,000 transactions/sec throughput maintained across batch operations

## [2.1.0] - 2025-12-08

### Added

- Binary buffer parsing with automatic encoding detection
  - `parseBuffer(Uint8Array)` - Parse OFX from binary data with correct encoding
  - `parseBufferOrThrow(Uint8Array)` - Throwing variant of parseBuffer
  - `getEncodingFromCharset(charset)` - Get TextDecoder encoding from OFX CHARSET value
- UTF-8 auto-detection for files that declare wrong encoding (common in Brazilian banks)
- Support for `BANKACCTFROM` as alternative to `CCACCTFROM` in credit card statements (Brazilian bank variation)
- SONRS normalization to handle `DTSERVER`/`LANGUAGE` inside `STATUS` (malformed but common in Brazilian OFX)
- Auto-generation of `FITID` for transactions missing it (deterministic hash from date+amount+name)
- Streaming API now supports encoding detection via `StreamOptions.encoding`

### Changed

- `FITID` is now optional in transaction schema (auto-generated if missing)
- `TRNUID` and `STATUS` are now optional in statement transaction responses
- Improved single-line header parsing for compact OFX files

### Fixed

- Portuguese/Latin characters (ã, é, ç, etc.) now correctly preserved when parsing Windows-1252 or ISO-8859-1 encoded files
- Files declaring CHARSET:1252 but actually encoded as UTF-8 now parse correctly via auto-detection

### Encoding Support

Supported charset mappings:
- `1252`, `WINDOWS-1252`, `CP1252` → `windows-1252`
- `8859-1`, `ISO-8859-1`, `LATIN1`, `LATIN-1` → `iso-8859-1`
- `UTF-8`, `UTF8`, `NONE`, `` → `utf-8`

## [2.0.0] - 2025-12-07

### Changed

- Removed `schemas` object export to fix TypeScript type inference issues
- All OFX types are now exported directly as named type exports instead of via a `schemas` object

### Breaking Changes

- The `schemas` export has been removed. If you were using `import { schemas } from '@f-o-t/ofx'`, you now need to import types directly: `import type { OFXDocument, OFXTransaction } from '@f-o-t/ofx'`

## [1.3.0] - 2025-12-05

### Added

- Streaming API for processing large OFX files with low memory footprint
  - `parseStream()` - AsyncGenerator yielding events (header, transaction, account, balance, complete)
  - `parseStreamToArray()` - Helper to collect all stream events into arrays
  - `StreamEvent` type for typed event handling
  - Supports both `ReadableStream<Uint8Array>` and `AsyncIterable<string>` inputs

### Performance

- Optimized parser with lazy entity decoding (only decode when `&` present)
- Optimized string cleaning with combined regexes and early returns
- Single-pass date parsing with regex capture groups instead of multiple `substring()` + `parseInt()` calls
- Direct array accumulation in extractors instead of spread + `.flat()`
- Lazy escape with early returns when no special characters present
- Targeted transaction normalization traversing only known OFX paths
- Array-based string building in generator with loops instead of `.map().join()`
- Streaming achieves ~66,000 transactions/sec throughput

## [1.2.1] - 2025-12-05

### Added

- OFX file generation capabilities for bank and credit card statements.
- `generateHeader()` for creating OFX headers.
- `formatOfxDate()` for consistent OFX date formatting.
- `escapeOfxText()` for proper text escaping within OFX tags.
- `generateTransaction()` for creating individual OFX transaction entries.
- `generateBankStatement()` for creating complete OFX bank statements.
- `generateCreditCardStatement()` for creating complete OFX credit card statements.

## [1.2.0] - 2025-11-27

### Fixed

- Fixed parsing of mixed XML/SGML format OFX files (files with both `<TAG>value</TAG>` and `<TAG>value` styles)
- Closing tags now correctly find their matching opening tag instead of popping the wrong element from the stack

### Changed

- Optimized `addToContent` to mutate arrays in place instead of using spread operator
- Optimized `sgmlToObject` to use `Map` for O(1) tag stack lookups instead of `findIndex` O(n)

### Performance

- ~38% faster parsing on real-world files
- ~6.5x faster on 5K transactions (241ms → 37ms)
- ~7x faster on 10K transactions (832ms → 113ms)
- ~10x faster on 50K transactions (4255ms → 442ms)

## [1.1.1] - 2025-11-27

### Changed

- Updated package exports to point to dist files for proper module resolution

## [1.1.0] - 2025-11-27

### Changed

- Reordered object properties in `parseDateComponents` and `parseTimezone` for consistency (alphabetical order)

## [1.0.0] - 2025-11-26

### Added

- Full OFX/SGML parsing with Zod schema validation
- Support for bank statements (`BANKMSGSRSV1`) and credit card statements (`CREDITCARDMSGSRSV1`)
- Transaction extraction with `getTransactions()`
- Account info extraction with `getAccountInfo()`
- Balance extraction with `getBalance()`
- Sign-on info extraction with `getSignOnInfo()`
- Date parsing with timezone support and `toDate()` conversion
- All 18 OFX transaction types supported
- Type-safe parsing with `parse()` (returns `ParseResult`) and `parseOrThrow()`
- Exported schemas for custom validation

### Performance

- Handles ~10K transactions (typical annual business statement) in ~800ms
- Handles ~25K transactions in ~1.3s
- Handles ~50K transactions in ~4.3s
- Extraction operations remain sub-millisecond even on large datasets
