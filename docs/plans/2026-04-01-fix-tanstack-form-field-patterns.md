# TanStack Form Field Pattern Fix — MON-214

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all TanStack Form + Field component usages across apps/web/src to follow the correct accessibility, validation, and style pattern.

**Architecture:** Four categories of fixes: (1) global `isInvalid` check, (2) Zod schemas at module level, (3) accessibility attributes on inputs/labels, (4) `children` prop style. Also update CLAUDE.md.

**Tech Stack:** React, TanStack Form, Zod, shadcn Field components, TypeScript

**Worktree:** `/home/yorizel/Documents/montte-nx/.worktrees/mon-214-fix-tanstack-form/`

---

## Issue Summary

### Files with schema inside component function (must move to module level):
- `apps/web/src/routes/auth/sign-in/email.tsx` — `const schema = z.object` at line 23
- `apps/web/src/routes/auth/email-verification.tsx` — `const schema = z.object` at line 32
- `apps/web/src/routes/auth/magic-link.tsx` — `const schema = z.object` at line 26
- `apps/web/src/layout/dashboard/ui/-sidebar-scope-switcher/create-team-form.tsx` — `const schema = z.object` at line 78

### Files with `!field.state.meta.isValid` (all 21 files, 90 occurrences):
All files in `apps/web/src/features/` and `apps/web/src/routes/` and `apps/web/src/layout/` that use `form.Field`.

### Files with missing a11y attributes (need id/name/aria-invalid on inputs + htmlFor on FieldLabel):
Most feature forms. Need per-file audit.

### Children prop style (`{(field) => ...}` → `children={(field) => ...}`):
All `form.Field` usages across all files.

---

## Task 1: Global isInvalid Fix

**Files:** All 21 files identified above (in worktree)
**Worktree path:** `/home/yorizel/Documents/montte-nx/.worktrees/mon-214-fix-tanstack-form/`

**Step 1:** Run global sed in worktree to replace `!field.state.meta.isValid` with `field.state.meta.errors.length > 0`:

```bash
cd /home/yorizel/Documents/montte-nx/.worktrees/mon-214-fix-tanstack-form
find apps/web/src -name "*.tsx" | xargs sed -i 's/!field\.state\.meta\.isValid/field.state.meta.errors.length > 0/g'
```

**Step 2:** Verify no instances remain:
```bash
grep -r "!field.state.meta.isValid" apps/web/src --include="*.tsx"
```
Expected: no output.

**Step 3:** Commit:
```bash
git add -A
git commit -m "fix(forms): replace !isValid with errors.length > 0 for isInvalid check"
```

---

## Task 2: Move Zod Schemas to Module Level

**Files:**
- `apps/web/src/routes/auth/sign-in/email.tsx`
- `apps/web/src/routes/auth/email-verification.tsx`
- `apps/web/src/routes/auth/magic-link.tsx`
- `apps/web/src/layout/dashboard/ui/-sidebar-scope-switcher/create-team-form.tsx`

For each file: read the file, extract the `const schema = z.object({...})` declaration from inside the component function and place it at module level (after imports, before the component). Rename if needed to avoid conflicts (e.g., `signInSchema`, `verificationSchema`, `magicLinkSchema`, `createTeamSchema`).

**Step 1:** Edit each file (read first, then move schema to module level).

**Step 2:** Verify no `const schema` inside component functions remain:
```bash
grep -n "const schema = z" apps/web/src/routes/auth/sign-in/email.tsx apps/web/src/routes/auth/email-verification.tsx apps/web/src/routes/auth/magic-link.tsx apps/web/src/layout/dashboard/ui/-sidebar-scope-switcher/create-team-form.tsx
```
Expected: all results at line numbers before the component function.

**Step 3:** Commit:
```bash
git add -A
git commit -m "fix(forms): move Zod schemas to module level to prevent re-creation on render"
```

---

## Task 3: Fix Accessibility Attributes + Children Prop Style

For each form file, apply both fixes simultaneously:
1. Add `id={field.name}`, `name={field.name}`, `aria-invalid={isInvalid}` to input elements inside `form.Field`
2. Add `htmlFor={field.name}` to `<FieldLabel>` elements inside `form.Field`
3. Change `<form.Field name="x">{(field) => ...}</form.Field>` to `<form.Field name="x" children={(field) => ...} />`

**Files to fix (in order of complexity):**

### Group A — Feature forms:
- `apps/web/src/features/categories/ui/categories-form.tsx`
- `apps/web/src/features/categories/ui/subcategory-form.tsx`
- `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`
- `apps/web/src/features/bills/ui/bills-form.tsx`
- `apps/web/src/features/bills/ui/bill-from-transaction-dialog-stack.tsx`
- `apps/web/src/features/budget-goals/ui/budget-goal-dialog-stack.tsx`
- `apps/web/src/features/contacts/ui/contacts-form.tsx`
- `apps/web/src/features/credit-cards/ui/credit-cards-form.tsx`
- `apps/web/src/features/services/ui/services-form.tsx`
- `apps/web/src/features/services/ui/subscription-form.tsx`
- `apps/web/src/features/transactions/ui/transaction-dialog-stack.tsx`

### Group B — Layout + Route forms:
- `apps/web/src/layout/dashboard/ui/-sidebar-scope-switcher/create-team-form.tsx`
- `apps/web/src/layout/dashboard/ui/-sidebar-scope-switcher/manage-organization-form.tsx`
- `apps/web/src/routes/auth/email-verification.tsx`
- `apps/web/src/routes/auth/forgot-password.tsx`
- `apps/web/src/routes/auth/magic-link.tsx`
- `apps/web/src/routes/auth/sign-in/email.tsx`
- `apps/web/src/routes/auth/sign-up.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-form.tsx`
- `apps/web/src/routes/_authenticated/-onboarding/profile-step.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/profile.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/contatos.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/estoque.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/financeiro.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/dashboards/-dashboards/create-dashboard-form.tsx`

**Note on `children` prop conversion:**
- `<form.Field name="x">\n  {(field) => ...}\n</form.Field>` becomes `<form.Field name="x" children={(field) => ...} />`
- For multi-line render functions, the self-closing tag is fine only if the function is on one logical block. Keep readable formatting.
- `form.Subscribe` with `{(state) => ...}` syntax — also convert to `children={(state) => ...}` for consistency.

**Note on a11y for non-Input elements (Select, Combobox, ColorPicker):**
- For `<Select>`, `<Combobox>` and other custom components, only add `id` and `name` if the component accepts those props. Check component signatures.
- `aria-invalid` should be added where supported.
- Focus on `<Input>`, `<PasswordInput>`, `<Textarea>` — these always accept a11y attributes.

**Step 1:** Read and fix each file (groups can be done in parallel).

**Step 2:** Verify all `form.Field` now use `children=` prop style:
```bash
grep -rn "form\.Field name=" apps/web/src --include="*.tsx" | grep -v "children="
```
Expected: no output (or only `form.Subscribe` usages if those weren't converted).

**Step 3:** Commit after each group:
```bash
git add -A
git commit -m "fix(forms): add a11y attributes and standardize children prop in feature forms"
git add -A  
git commit -m "fix(forms): add a11y attributes and standardize children prop in route/layout forms"
```

---

## Task 4: Update CLAUDE.md with TanStack Form Pattern

**File:** `CLAUDE.md` (in worktree root)

Add a new section after the "## Client-Side Patterns (oRPC + TanStack Query)" section documenting the correct TanStack Form pattern.

**Step 1:** Read CLAUDE.md and find insertion point.

**Step 2:** Insert new section:

```markdown
## TanStack Form Pattern

### Rules
- **Schema at module level** — never define `z.object({...})` inside a component function; always declare at module scope to prevent recreation on every render.
- **`isInvalid` check** — use `field.state.meta.isTouched && field.state.meta.errors.length > 0` (not `!field.state.meta.isValid`).
- **Accessibility** — always set `id={field.name}`, `name={field.name}`, `aria-invalid={isInvalid}` on `<Input>`/`<PasswordInput>`/`<Textarea>`. Always set `htmlFor={field.name}` on `<FieldLabel>`.
- **`children` prop** — always use `children={(field) => ...}` as an explicit JSX prop, not `{(field) => ...}` as JSX children.

### Correct Pattern

```tsx
// ✅ Schema at module level
const formSchema = z.object({
  name: z.string().min(1, "Campo obrigatório."),
});

function MyForm() {
  const form = useForm({
    defaultValues: { name: "" },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => { /* ... */ },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  aria-invalid={isInvalid}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
      </FieldGroup>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            Salvar
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```
```

**Step 3:** Commit:
```bash
git add CLAUDE.md
git commit -m "docs(claude): add TanStack Form pattern guidelines"
```
