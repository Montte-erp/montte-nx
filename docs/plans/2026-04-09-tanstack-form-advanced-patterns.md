# TanStack Form — Advanced Patterns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unlock server-side inline field errors, selective subscriptions, navigation guard, and async field validation using TanStack Form v1 advanced APIs — without introducing a new helper component, leveraging the existing `FieldError` from `@packages/ui/components/field`.

**Architecture:** Three changes propagate across all 28 form files: (1) `FieldError` updated to handle string errors from `onSubmitAsync`, (2) `onSubmitAsync` replaces `onError` toast in critical forms, (3) `form.Subscribe` receives typed selectors everywhere. `useBlocker` and async field validation are applied only where meaningful (edit forms and CNPJ/CPF fields).

**Tech Stack:** `@tanstack/react-form@1.28.5`, `@packages/ui/components/field` (FieldError), `@tanstack/react-router` (useBlocker), TanStack Form `onSubmitAsync`, `field.state.meta.*`

---

## Context

- **28 form files** — all in `apps/web/src/` under `features/*/ui/` and `routes/`
- **FieldError component** — `packages/ui/src/components/field.tsx:187`. Accepts `errors?: Array<{ message?: string } | undefined>`. Currently **does not handle string errors** — TanStack Form's `onSubmitAsync` field errors are strings, so they silently fail to render.
- **No `@tanstack/react-form-devtools` package** exists in the installed monorepo — skip the devtools phase from the issue.
- **Zod validator** — errors from Zod are `ZodIssue[]` (have `.message` ✅). Manual validators and `onSubmitAsync` produce `string[]` ❌ — these won't display in current `FieldError`.
- **Current server error pattern** — all forms use `useMutation` + `onError: (err) => toast.error(err.message)`. This needs to become `onSubmitAsync` for field-level errors.

---

## Task 1: Fix FieldError to handle string errors

**Files:**
- Modify: `packages/ui/src/components/field.tsx:187-249`

**Why:** `onSubmitAsync` server field errors are `string`. Current FieldError only reads `.message` from objects, so strings silently render nothing.

**Step 1: Update FieldError signature and logic**

In `packages/ui/src/components/field.tsx`, change FieldError to accept `string | { message?: string }`:

```tsx
function FieldError({
   className,
   children,
   errors,
   ...props
}: React.ComponentProps<"div"> & {
   errors?: Array<{ message?: string } | string | undefined>;
}) {
   const content = useMemo(() => {
      if (children) {
         return children;
      }

      if (!errors?.length) {
         return null;
      }

      const messages = errors
         .map((error) => (typeof error === "string" ? error : error?.message))
         .filter(Boolean);

      const unique = [...new Set(messages)];

      if (unique.length === 0) return null;
      if (unique.length === 1) return unique[0];

      return (
         <ul className="ml-4 flex list-disc flex-col gap-1">
            {unique.map((msg, index) => (
               <li key={`step-${index + 1}`}>{msg}</li>
            ))}
         </ul>
      );
   }, [children, errors]);

   if (!content) {
      return null;
   }

   return (
      <div
         className={cn("text-destructive text-sm font-normal", className)}
         data-slot="field-error"
         role="alert"
         {...props}
      >
         {content}
      </div>
   );
}
```

**Step 2: Verify existing usages still compile**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "field.tsx\|FieldError" | head -20
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add packages/ui/src/components/field.tsx
git commit -m "fix(ui): FieldError handles string errors from onSubmitAsync"
```

---

## Task 2: Migrate bills-form to onSubmitAsync with inline server errors

**Files:**
- Modify: `apps/web/src/features/bills/ui/bills-form.tsx`

**Why:** Bills is a critical financial form. Server errors like "Conta sem saldo" or conflicts should appear inline, not in a toast.

**Step 1: Read the current bills-form**

Read `apps/web/src/features/bills/ui/bills-form.tsx` fully before touching it.

**Step 2: Replace the mutation + onSubmit pattern**

Current pattern (all forms):
```tsx
const mutation = useMutation(orpc.bills.create.mutationOptions());

const form = useForm({
   defaultValues: { ... },
   onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ input: value });
      toast.success("Conta criada");
   },
});
```

New pattern with `onSubmitAsync`:
```tsx
const form = useForm({
   defaultValues: { ... },
   validators: {
      onSubmitAsync: async ({ value }) => {
         try {
            await orpc.bills.create.call({ input: value });
            toast.success("Conta criada");
            onSuccess?.();
            return null;
         } catch (err) {
            if (err instanceof WebAppError) {
               if (err.code === "CONFLICT") {
                  return { form: "Já existe uma conta com esses dados" };
               }
               if (err.code === "BAD_REQUEST") {
                  // map to specific fields when you know the field
                  return { form: err.message };
               }
            }
            return { form: "Erro inesperado. Tente novamente." };
         }
      },
   },
});
```

**Step 3: Add form-level error display**

Below the `<form>` element's fields, before the submit button:
```tsx
<form.Subscribe selector={(state) => state.errors}>
   {(errors) =>
      errors.length > 0 && (
         <FieldError errors={errors} />
      )
   }
</form.Subscribe>
```

**Step 4: Simplify the submit button**

```tsx
<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
   {([canSubmit, isSubmitting]) => (
      <Button type="submit" disabled={!canSubmit}>
         {isSubmitting ? <Spinner /> : "Salvar"}
      </Button>
   )}
</form.Subscribe>
```

**Step 5: Import WebAppError on the client**

```tsx
import { WebAppError } from "@core/logging/errors";
```

Wait — CLAUDE.md says "Frontend only imports inferred types via Inputs/Outputs — never imports backend schemas or `@core/*` packages." Check if `WebAppError` is re-exported from somewhere in the web app, or use a type check instead:

```tsx
// Safe pattern without importing @core:
const errorMessage = err instanceof Error ? err.message : "Erro inesperado";
// Or check err.code if it's serialized by oRPC middleware
```

Actually, oRPC serializes `WebAppError` over the wire. Check how client-side currently accesses `err.code`. Read `apps/web/src/integrations/orpc/client.ts` to understand the client error type before implementing.

**Step 6: Typecheck**

```bash
bun run typecheck 2>&1 | grep bills-form | head -20
```

**Step 7: Commit**

```bash
git add apps/web/src/features/bills/ui/bills-form.tsx
git commit -m "feat(bills): inline server errors via onSubmitAsync"
```

---

## Task 3: Migrate contacts-form to onSubmitAsync

**Files:**
- Modify: `apps/web/src/features/contacts/ui/contacts-form.tsx`

**Why:** Contact creation/editing has potential CNPJ conflicts and validation errors that should show inline.

Same pattern as Task 2. Key mappings to research:
- `CONFLICT` → `fields.document: "CNPJ/CPF já cadastrado"`
- `NOT_FOUND` → `form: "Contato não encontrado"`

**Step 1:** Read the form fully.
**Step 2:** Apply `onSubmitAsync` pattern from Task 2.
**Step 3:** Remove the `useMutation` hook if no longer used.
**Step 4:** Typecheck + commit.

```bash
git add apps/web/src/features/contacts/ui/contacts-form.tsx
git commit -m "feat(contacts): inline server errors via onSubmitAsync"
```

---

## Task 4: Migrate bank-accounts-form to onSubmitAsync

**Files:**
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`

**Why:** Bank account creation has strict validation (agency/account format, balance conflicts).

Same pattern. Commit separately:

```bash
git commit -m "feat(bank-accounts): inline server errors via onSubmitAsync"
```

---

## Task 5: Add selective selectors to all form.Subscribe usages

**Files:**
- Audit all 28 form files for `form.Subscribe` without selector or with `selector={(state) => state}`

**Step 1: Find non-selective Subscribe usages**

```bash
grep -rn "form.Subscribe" apps/web/src/features/ apps/web/src/routes/ --include="*.tsx" | grep -v "selector"
```

Any `form.Subscribe` without `selector` re-renders on every state change. Add the minimal selector.

**Step 2: Common patterns to apply**

Replace:
```tsx
// Anti-pattern — re-renders on every state change
<form.Subscribe>
   {(state) => <Button disabled={!state.canSubmit}>{state.isSubmitting ? <Spinner /> : "Salvar"}</Button>}
</form.Subscribe>
```

With:
```tsx
// ✅ Only re-renders when canSubmit or isSubmitting changes
<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
   {([canSubmit, isSubmitting]) => (
      <Button type="submit" disabled={!canSubmit}>
         {isSubmitting ? <Spinner /> : "Salvar"}
      </Button>
   )}
</form.Subscribe>
```

**Step 3: Typecheck**

```bash
bun run typecheck 2>&1 | grep -E "Subscribe|selector" | head -20
```

**Step 4: Commit**

```bash
git add -p  # stage only Subscribe selector changes
git commit -m "perf(forms): add selective selectors to all form.Subscribe usages"
```

---

## Task 6: Add useBlocker to edit forms

**Files:**
- Modify: `apps/web/src/features/contacts/ui/contacts-form.tsx`
- Modify: `apps/web/src/features/bills/ui/bills-form.tsx`
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`
- Modify: `apps/web/src/features/services/ui/services-form.tsx`

**Why:** Edit forms (not create) should warn users before navigating away with unsaved changes.

**Step 1: Import useBlocker**

```tsx
import { useBlocker } from "@tanstack/react-router";
```

**Step 2: Add inside the form component (after useForm)**

```tsx
useBlocker({
   shouldBlockFn: () => form.state.isDirty && !form.state.isSubmitted,
});
```

**Note:** `useBlocker` in TanStack Router shows a browser-native confirmation by default. If `useBlocker` API requires a `blocker` callback or `blockerFn`, read the current `@tanstack/react-router` types before implementing.

**Step 3: Only apply to edit mode**

```tsx
// Only block navigation when editing an existing record (not creating)
useBlocker({
   shouldBlockFn: () => isEditing && form.state.isDirty && !form.state.isSubmitted,
});
```

**Step 4: Typecheck + commit**

```bash
git add apps/web/src/features/{contacts,bills,bank-accounts,services}/ui/*.tsx
git commit -m "feat(forms): block navigation on unsaved changes"
```

---

## Task 7: Add async CNPJ validation on onboarding form

**Files:**
- Modify: `apps/web/src/routes/_authenticated/-onboarding/cnpj-step.tsx`

**Why:** The CNPJ step already has a mask but no async validation. Server-side CNPJ verification during onboarding would give immediate feedback.

**Step 1: Read cnpj-step.tsx fully.**

**Step 2: Add async validator to the CNPJ field**

```tsx
<form.Field
   name="cnpj"
   validators={{
      onBlurAsync: async ({ value }) => {
         const digits = value.replace(/\D/g, "");
         if (digits.length !== 14) return;
         // Call the existing CNPJ lookup endpoint if available
         // or use orpc.onboarding.validateCnpj.call({ input: { cnpj: digits } })
         // Return string error or undefined
      },
      onBlurAsyncDebounceMs: 500,
   }}
>
   {(field) => (
      <>
         <Input ... />
         {field.state.meta.isValidating && <Spinner size="sm" />}
         <FieldError errors={field.state.meta.errors} />
      </>
   )}
</form.Field>
```

**Note:** Only implement if there's an existing CNPJ validation endpoint. Read the onboarding router to check.

**Step 3: Commit**

```bash
git commit -m "feat(onboarding): async CNPJ validation on blur"
```

---

## Task 8: Update CLAUDE.md — TanStack Form Pattern Section

**Files:**
- Modify: `CLAUDE.md` — "TanStack Form Pattern" section

**Step 1: Add the following to the TanStack Form Pattern section**

```markdown
## TanStack Form Pattern

- **Schema at module level** — never define `z.object({...})` inside a component.
- **`isInvalid` check** — `field.state.meta.isTouched && field.state.meta.errors.length > 0`.
- **Accessibility** — always set `id`, `name`, `aria-invalid` on inputs; `htmlFor` on `<FieldLabel>`.
- **`children` prop** — always use `children={(field) => ...}` as explicit JSX prop.
- **FieldError** — use `<FieldError errors={field.state.meta.errors} />` from `@packages/ui/components/field`. No custom error display. Handles both string[] and ZodIssue[].
- **Server errors** — use `onSubmitAsync` (not `onError` toast) for field-level server validation. Return `{ fields: { fieldName: "message" } }` or `{ form: "message" }`.
- **Form-level errors** — display with `<form.Subscribe selector={(state) => state.errors}>{(errors) => <FieldError errors={errors} />}</form.Subscribe>`.
- **Selective Subscribe** — always pass a `selector` to `form.Subscribe` to avoid unnecessary re-renders. Use `as const` for tuple selectors.
- **Navigation guard** — use `useBlocker({ shouldBlockFn: () => form.state.isDirty && !form.state.isSubmitted })` in all edit forms.
- **Async field validation** — use `onBlurAsync` + `onBlurAsyncDebounceMs: 500`. Show `field.state.meta.isValidating` as a spinner next to the field.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document TanStack Form advanced patterns"
```

---

## Execution Order

1. Task 1 (FieldError fix) — unblocks everything else
2. Task 2-4 (onSubmitAsync) — high value, apply one at a time
3. Task 5 (selective Subscribe) — batch across all forms
4. Task 6 (useBlocker) — apply to edit forms
5. Task 7 (async CNPJ) — conditional on endpoint existence
6. Task 8 (CLAUDE.md) — last

## Pre-flight Checks

Before starting Task 2-4, read `apps/web/src/integrations/orpc/client.ts` to understand how `WebAppError` is exposed on the client side (it may be typed as a plain `Error` with a `code` property). Do not import `@core/logging/errors` in frontend code.
