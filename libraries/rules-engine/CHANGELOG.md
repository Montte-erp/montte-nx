# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2025-12-31

### Changed

- Removed unused imports and dead code
  - Removed unused `ConditionGroup` type import from index-builder
  - Removed unused `ConflictResolutionStrategySchema` import from config types
  - Removed unused `_cacheStats` variable from engine stats
  - Removed unused `_collectAllConditionIds` helper function from integrity validation

## [2.0.0] - 2025-12-24

### Added

- **Zod Schema-First Types**: All configuration types now built from Zod schemas
  - `CacheConfigSchema`, `ValidationConfigSchema`, `VersioningConfigSchema`, `LogLevelSchema`
  - `ConflictResolutionStrategySchema`, `EvaluateOptionsSchema`, `EvaluateConfigSchema`
  - `RuleStatsSchema`, `CacheStatsSchema`, `EngineStatsSchema`
  - `ValidationErrorSchema`, `ValidationResultSchema`, `ValidationOptionsSchema`
- **Hook Error Handling**: New `onHookError` callback for capturing hook errors
  - Previously hooks failed silently; now errors are reported via callback
- **Hook Timeout Protection**: New `hookTimeoutMs` config option
  - Prevents slow hooks from blocking engine execution indefinitely
  - Timeout errors are reported through `onHookError`
- **Orphaned Reference Detection**: `ImportResult` now includes `orphanedReferences`
  - Detects when imported RuleSets reference non-existent rule IDs
  - New `OrphanedReference` type exported
- **Shared Conditions Utility**: New internal `src/utils/conditions.ts`
  - `collectConditionFields()`, `collectConditionOperators()`, `countConditions()`
  - `calculateMaxDepth()`, `countConditionGroups()`
- **Config Helper Functions**: New functions replace constants
  - `getDefaultCacheConfig()`, `getDefaultValidationConfig()`, `getDefaultVersioningConfig()`
  - `getDefaultLogLevel()`, `getDefaultConflictResolution()`
  - `parseCacheConfig()`, `parseValidationConfig()`, `parseVersioningConfig()`

### Changed

- **Cache Eviction Performance**: O(n) → O(1) for oldest entry eviction
  - Now uses ES6 Map insertion order for FIFO eviction
- **Strict Mode Behavior**: `strictMode: true` now implicitly enables consequence validation
  - Previously required both `strictMode: true` and `validateConsequences: true`

### Removed

- **BREAKING**: Removed FP utility exports from `src/utils/pipe.ts`
  - `pipe()`, `compose()`, `identity()`, `always()`, `tap()`
  - These generic utilities are not domain-specific; use lodash/ramda instead
- **BREAKING**: Removed `delay()` from `src/utils/time.ts`
  - Low value utility; use `Bun.sleep()` or inline `new Promise(resolve => setTimeout(resolve, ms))`
- **BREAKING**: Removed `DEFAULT_*` constant exports
  - `DEFAULT_CACHE_CONFIG` → use `getDefaultCacheConfig()`
  - `DEFAULT_VALIDATION_CONFIG` → use `getDefaultValidationConfig()`
  - `DEFAULT_VERSIONING_CONFIG` → use `getDefaultVersioningConfig()`
  - `DEFAULT_ENGINE_CONFIG` → removed (use schema defaults)
- **BREAKING**: Removed internal mutable type exports
  - `MutableEngineState`, `MutableOptimizerState`, `MutableRuleStats`
  - These are internal implementation details

### Fixed

- **Silent Hook Errors**: All 11 hook execution functions now report errors via `onHookError`
- **Redundant Sorting**: Removed unnecessary sort in `evaluate()` (rules already sorted on add/update)

## [1.0.0] - 2025-12-10

### Added

- Initial release of the rules engine library
- **Engine**: Stateful rule management with `createEngine()`
  - Add, update, remove, enable/disable rules
  - Rule sets for grouping related rules
  - Configurable caching with TTL and max size
  - Lifecycle hooks (onBeforeEvaluation, onAfterEvaluation, onRuleMatch, onRuleError, onCacheHit)
  - Conflict resolution strategies: "all", "first-match", "highest-priority"
- **Fluent Builders**: Chainable APIs for building rules and conditions
  - `rule()` builder with full configuration options
  - Shorthand condition helpers: `num()`, `str()`, `bool()`, `date()`, `arr()`
  - Logical operators: `all()`, `any()`, `and()`, `or()`
- **Core Evaluation**: Built on `@f-o-t/condition-evaluator`
  - `evaluateRule()` and `evaluateRules()` functions
  - Filter rules by tags, category, enabled status
  - Sort rules by priority, name, created/updated date
  - Group rules by category, priority, enabled status, or custom function
- **Validation**: Comprehensive rule validation
  - Schema validation with Zod
  - Conflict detection (duplicate IDs, overlapping conditions, priority collisions, unreachable rules)
  - Integrity checks (negative priority, missing fields, invalid operators)
- **Simulation**: Test rules without side effects
  - `simulate()` for single context testing
  - `batchSimulate()` for multiple contexts
  - `whatIf()` for comparing rule set changes
- **Versioning**: Track rule changes with rollback support
  - Version store with full history
  - Rollback to any previous version
  - Prune old versions
- **Indexing & Optimization**: Fast rule lookups
  - Build indexes by field, tag, category, priority
  - Optimization suggestions for rule sets
- **Analysis**: Rule set analytics
  - Complexity analysis per rule
  - Field, operator, and consequence usage statistics
  - Find most complex rules
- **Serialization**: Import/export capabilities
  - JSON export/import with optional ID regeneration
  - Clone rules
  - Merge and diff rule sets
- **Utilities**: Functional programming helpers
  - `pipe()`, `compose()`, `identity()`, `always()`, `tap()`
  - `measureTime()`, `measureTimeAsync()`, `withTimeout()`, `delay()`
  - `generateId()`, `hashContext()`, `hashRules()`

### Changed

- **Internal refactor**: Removed 12 internal barrel files
  - All imports now use direct file paths instead of barrel re-exports
  - No public API changes - only internal module structure improvements
