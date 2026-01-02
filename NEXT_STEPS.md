# Workflows Package Refactoring - Next Steps

This document outlines the remaining work after the `packages/workflows` refactoring.

## Summary of Completed Work

### Dead Code Removal
- Removed 4 phantom export paths from `package.json` (analysis, simulation, validation, versioning)
- Removed unused functions: `fromWorkflowRule`, `getScheduleJobs`, `hasScheduleJob`
- Consolidated duplicate logic in `queue/consumer.ts`

### Code Quality Improvements
- Added `@internal` JSDoc annotations to test-only functions
- Extracted shared utilities to `utils/bills-helpers.ts`
- Created `constants.ts` with all magic numbers extracted
- Refactored `engine/runner.ts` with helper functions to reduce duplication

### Type Safety & Schemas
- Added Zod dependency to workflows package
- Created Zod schemas in `schemas/` directory:
  - `event.schema.ts` - WorkflowEvent validation
  - `config.schema.ts` - Engine and schedule configuration
  - `action-field.schema.ts` - Action field type definitions
  - `action-definition.schema.ts` - Full action definition schema

### Typesafe Action Config System
- Created `lib/define-action.ts` with pure functional action factory
- Created `config/actions/index.ts` with unified `actionsConfig` export
- Added new package exports: `./schemas/*` and `./config/actions`

---

## Phase 9: Testing (Pending)

### Handler Unit Tests
Create tests for all 12 untested handlers in `__tests__/handlers/`:

```
add-tag.test.ts
remove-tag.test.ts
set-category.test.ts
set-cost-center.test.ts
create-transaction.test.ts
mark-as-transfer.test.ts
update-description.test.ts
send-push-notification.test.ts
send-email.test.ts
send-bills-digest.test.ts
fetch-bills-report.test.ts
format-data.test.ts
```

Each test should cover:
- Success cases (happy path)
- Error handling (invalid inputs, missing context)
- Edge cases (empty strings, nulls, boundary values)
- Dry-run behavior where applicable

### Schema Validation Tests
Create `__tests__/schemas/` with tests for:
- Valid inputs pass Zod schemas
- Invalid inputs fail with clear errors
- Edge cases (empty strings, null values)

### Performance Benchmarks
Create `__tests__/performance/handlers.bench.ts`:
- Measure execution time per handler
- Set baseline thresholds (e.g., <100ms per action)

---

## Frontend Integration

### 1. Update Imports

Replace the old `ACTION_DEFINITIONS` import with the new `actionsConfig`:

```typescript
// Before
import { ACTION_DEFINITIONS, getActionDefinition } from "@packages/workflows/types/actions";

// After
import { actionsConfig, getAction, hasActionTabs } from "@packages/workflows/config/actions";
```

### 2. Use New Helper Functions

```typescript
import {
  actionsConfig,
  getAction,
  getActionTabs,
  getFieldsForTab,
  getAllActions,
  getActionsForTrigger,
  hasActionTabs,
} from "@packages/workflows/config/actions";

// Get a specific action config
const setCategoryConfig = getAction("set_category");

// Check if action has tabs
if (hasActionTabs("send_bills_digest")) {
  const tabs = getActionTabs("send_bills_digest");
  // Render tab UI
}

// Get fields for a specific tab
const filterFields = getFieldsForTab("send_bills_digest", "filters");

// Get all actions for a trigger type
const scheduleActions = getActionsForTrigger("schedule");
```

### 3. Update Action Config Component

The new action config system supports:
- **Tabs**: Actions can define `tabs` array with `{ id, label, icon?, order, description? }`
- **Field ordering**: Fields have `tab` and `order` properties
- **Dynamic options**: Select/multiselect fields with empty `options: []` should be populated dynamically

Example component structure:

```tsx
function ActionConfigForm({ actionType }: { actionType: ActionType }) {
  const config = getAction(actionType);

  if (hasActionTabs(actionType)) {
    const tabs = getActionTabs(actionType);
    return (
      <Tabs defaultValue={config.defaultTab}>
        <TabsList>
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id}>
            <FieldList fields={getFieldsForTab(actionType, tab.id)} />
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return <FieldList fields={config.fields} />;
}
```

### 4. Field Type Mapping

Map field types to UI components:

| Field Type | Component |
|------------|-----------|
| `string` | `<Input />` |
| `number` | `<Input type="number" />` |
| `boolean` | `<Switch />` or `<Checkbox />` |
| `select` | `<Select />` |
| `multiselect` | `<MultiSelect />` |
| `template` | `<Textarea />` with variable hints |
| `category-split` | Custom category split component |

### 5. Handle dependsOn

Fields with `dependsOn` should only be shown when the dependency is met:

```tsx
function shouldShowField(field: ActionField, formValues: Record<string, unknown>): boolean {
  if (!field.dependsOn) return true;
  return formValues[field.dependsOn.field] === field.dependsOn.value;
}
```

---

## Migration Checklist

- [ ] Update all imports from `ACTION_DEFINITIONS` to `actionsConfig`
- [ ] Replace `getActionDefinition()` with `getAction()`
- [ ] Remove any hardcoded `hasSpecialTabs` logic (now use `hasActionTabs()`)
- [ ] Update action config forms to support tabs
- [ ] Implement field ordering by `order` property
- [ ] Handle `dependsOn` field visibility
- [ ] Add dynamic option loading for select/multiselect fields with empty options
- [ ] Update tests to use new imports
- [ ] Run full type check after migration: `bunx nx run-many -t typecheck`

---

## Environment Variables

The refactoring introduced a new environment variable for the dashboard URL:

```env
# Optional - defaults to https://app.montte.co
DASHBOARD_URL=https://your-dashboard-url.com
```

This is used by `getBillsPageUrl()` in `constants.ts` for email links.

---

## Files Changed Summary

### New Files
- `packages/workflows/src/constants.ts`
- `packages/workflows/src/utils/bills-helpers.ts`
- `packages/workflows/src/schemas/event.schema.ts`
- `packages/workflows/src/schemas/config.schema.ts`
- `packages/workflows/src/schemas/action-field.schema.ts`
- `packages/workflows/src/schemas/action-definition.schema.ts`
- `packages/workflows/src/lib/define-action.ts`
- `packages/workflows/src/config/actions/index.ts`

### Modified Files
- `packages/workflows/package.json` - Added zod dependency and new exports
- `packages/workflows/src/queue/queues.ts` - Using constants
- `packages/workflows/src/queue/schedule-jobs.ts` - Using constants
- `packages/workflows/src/engine/factory.ts` - Using constants
- `packages/workflows/src/engine/runner.ts` - Refactored with helpers
- `packages/workflows/src/engine/consequence-definitions.ts` - Added missing action types
- `packages/workflows/src/actions/handlers/send-bills-digest.ts` - Using shared utilities
- `packages/workflows/src/actions/handlers/fetch-bills-report.ts` - Using shared utilities
- `packages/workflows/src/actions/registry.ts` - Added @internal annotations
- `packages/workflows/src/engine/adapter.ts` - Added @internal annotations
- `packages/workflows/src/types/rules.ts` - Removed unused function
