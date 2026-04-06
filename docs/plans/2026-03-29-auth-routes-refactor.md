# Auth Routes Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor auth routes to follow the private components pattern, extract shared keys/constants to feature folders, add a password strength card to sign-up, and clean up the invite member form colocation.

**Architecture:** Private components (prefixed `-`) are colocated with their single consumer route. Shared constants/keys live in the relevant feature folder (`features/organization/constants.ts`). Auth UI primitives shared across multiple auth routes live in a `routes/auth/-auth/` shared private folder.

**Tech Stack:** React, TanStack Router, foxact (useLocalStorage), Tailwind CSS, `@packages/ui`

---

### Task 1: Extract `PENDING_INVITATION_KEY` to `features/organization/`

The key `"montte:pending-invitation-id"` is currently defined in the callback route file and imported back into `auth/callback.tsx`. Shared localStorage keys belong in the feature folder of their domain.

**Files:**

- Create: `apps/web/src/features/organization/constants.ts`
- Modify: `apps/web/src/routes/callback/organization/invitation/$invitationId.tsx`
- Modify: `apps/web/src/routes/auth/callback.tsx`

**Step 1: Create `features/organization/constants.ts`**

```typescript
export const PENDING_INVITATION_KEY = "montte:pending-invitation-id";
```

**Step 2: Update the invitation callback route**

In `apps/web/src/routes/callback/organization/invitation/$invitationId.tsx`:

- Remove: `export const PENDING_INVITATION_KEY = "montte:pending-invitation-id";`
- Add import: `import { PENDING_INVITATION_KEY } from "@/features/organization/constants";`

**Step 3: Update `auth/callback.tsx`**

- Change: `import { PENDING_INVITATION_KEY } from "@/routes/callback/organization/invitation/$invitationId";`
- To: `import { PENDING_INVITATION_KEY } from "@/features/organization/constants";`

**Step 4: Commit**

```bash
git add apps/web/src/features/organization/constants.ts \
        apps/web/src/routes/callback/organization/invitation/'$invitationId'.tsx \
        apps/web/src/routes/auth/callback.tsx
git commit -m "refactor(organization): extract PENDING_INVITATION_KEY to features/organization/constants"
```

---

### Task 2: Extract shared auth UI primitives to `routes/auth/-auth/`

`TermsAndPrivacyText` is duplicated in both `sign-in/index.tsx` and `sign-up.tsx`. `GoogleIcon` is defined inline in `sign-in/index.tsx`. Both are shared between auth routes — they belong in a private `-auth/` folder at the auth level.

**Files:**

- Create: `apps/web/src/routes/auth/-auth/terms-and-privacy-text.tsx`
- Create: `apps/web/src/routes/auth/-auth/google-icon.tsx`
- Modify: `apps/web/src/routes/auth/sign-in/index.tsx`
- Modify: `apps/web/src/routes/auth/sign-up.tsx`

**Step 1: Create `terms-and-privacy-text.tsx`**

```typescript
import { FieldDescription } from "@packages/ui/components/field";

export function TermsAndPrivacyText() {
   const text =
      "Ao continuar, voce concorda com nossos {split} e {split}.".split(
         "{split}",
      );

   return (
      <FieldDescription className="text-center">
         <span>{text[0]}</span>
         <a
            className="underline text-muted-foreground hover:text-primary"
            href="https://montte.co/terms-of-service"
            rel="noopener noreferrer"
            target="_blank"
         >
            Termos de Servico
         </a>
         <span>{text[1]}</span>
         <a
            className="underline text-muted-foreground hover:text-primary"
            href="https://montte.co/privacy-policy"
            rel="noopener noreferrer"
            target="_blank"
         >
            Politica de Privacidade
         </a>
         <span>{text[2]}</span>
      </FieldDescription>
   );
}
```

**Step 2: Create `google-icon.tsx`**

```typescript
export function GoogleIcon() {
   return (
      <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
         <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
         />
         <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
         />
         <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
         />
         <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
         />
      </svg>
   );
}
```

**Step 3: Update `sign-in/index.tsx`**

- Remove the inline `GoogleIcon` and `TermsAndPrivacyText` function definitions
- Add imports:
   ```typescript
   import { GoogleIcon } from "../-auth/google-icon";
   import { TermsAndPrivacyText } from "../-auth/terms-and-privacy-text";
   ```
- Replace `<FieldDescription className="text-center"><TermsAndPrivacyText /></FieldDescription>` with `<TermsAndPrivacyText />` (it includes `FieldDescription` now)

**Step 4: Update `sign-up.tsx`**

- Remove inline `TermsAndPrivacyText` function definition
- Add import:
   ```typescript
   import { TermsAndPrivacyText } from "./-auth/terms-and-privacy-text";
   ```
- Replace `<FieldDescription className="text-center"><TermsAndPrivacyText /></FieldDescription>` with `<TermsAndPrivacyText />`

**Step 5: Commit**

```bash
git add apps/web/src/routes/auth/-auth/ \
        apps/web/src/routes/auth/sign-in/index.tsx \
        apps/web/src/routes/auth/sign-up.tsx
git commit -m "refactor(auth): extract shared TermsAndPrivacyText and GoogleIcon to -auth/ private folder"
```

---

### Task 3: Add password strength card to sign-up

The password step needs a visual strength indicator that shows feedback as the user types. Derive strength from the live field value. Use four levels: fraca, razoável, boa, forte.

**Files:**

- Create: `apps/web/src/routes/auth/-auth/password-strength-card.tsx`
- Modify: `apps/web/src/routes/auth/sign-up.tsx`

**Step 1: Create `password-strength-card.tsx`**

```typescript
type StrengthLevel = "fraca" | "razoavel" | "boa" | "forte";

function getStrength(password: string): { level: StrengthLevel; score: number } {
   let score = 0;
   if (password.length >= 8) score++;
   if (password.length >= 12) score++;
   if (/[A-Z]/.test(password)) score++;
   if (/[0-9]/.test(password)) score++;
   if (/[^A-Za-z0-9]/.test(password)) score++;

   if (score <= 1) return { level: "fraca", score };
   if (score === 2) return { level: "razoavel", score };
   if (score === 3) return { level: "boa", score };
   return { level: "forte", score };
}

const STRENGTH_CONFIG: Record<
   StrengthLevel,
   { label: string; color: string; bars: number }
> = {
   fraca:    { label: "Senha fraca",    color: "bg-destructive", bars: 1 },
   razoavel: { label: "Senha razoável", color: "bg-orange-500",  bars: 2 },
   boa:      { label: "Senha boa",      color: "bg-yellow-500",  bars: 3 },
   forte:    { label: "Senha forte",    color: "bg-green-500",   bars: 4 },
};

export function PasswordStrengthCard({ password }: { password: string }) {
   if (!password) return null;

   const { level } = getStrength(password);
   const config = STRENGTH_CONFIG[level];

   return (
      <div className="rounded-md border bg-muted/40 p-3 flex flex-col gap-2">
         <div className="flex gap-1">
            {Array.from({ length: 4 }, (_, i) => (
               <div
                  key={`strength-bar-${i + 1}`}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                     i < config.bars ? config.color : "bg-muted"
                  }`}
               />
            ))}
         </div>
         <p className="text-xs text-muted-foreground">{config.label}</p>
      </div>
   );
}
```

**Step 2: Update `sign-up.tsx` to show strength card**

In the `PasswordStep` function body (still inside `SignUpPage`), after the password `FieldGroup`, subscribe to the password field value and render the card:

```typescript
import { PasswordStrengthCard } from "./-auth/password-strength-card";
```

Inside `PasswordStep()`, after the password field group and before the confirm password field group:

```tsx
<form.Subscribe selector={(state) => state.values.password}>
   {(password) => <PasswordStrengthCard password={password} />}
</form.Subscribe>
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/auth/-auth/password-strength-card.tsx \
        apps/web/src/routes/auth/sign-up.tsx
git commit -m "feat(auth): add password strength card to sign-up password step"
```

---

### Task 4: Extract invite member form to private `-members/` folder

The invite member form and related dialogs are inline in `settings/organization/members.tsx`. This file is the only consumer. Per the private components pattern, these should live in `-members/` colocated with the route.

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/-members/invite-member-form.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members.tsx`

**Step 1: Read the full members.tsx file** to understand what to extract (invite dialog + form logic).

**Step 2: Create `-members/invite-member-form.tsx`**

Extract the invite form component (the `DialogStackContent` with email input, role select, and invite button) into this file. It needs:

- `useQueryClient` for invalidation
- `orpc` client
- `authClient` for `inviteOrganizationMember`
- `useOrganizationId` or equivalent context (check how `organizationId` is passed in the original)

The exported component signature should be:

```typescript
export function InviteMemberForm() { ... }
```

**Step 3: Update `members.tsx`**

- Remove the inline invite dialog implementation
- Import: `import { InviteMemberForm } from "./-members/invite-member-form";`
- Render `<InviteMemberForm />` in place of the extracted code

**Step 4: Commit**

```bash
git add "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/organization/-members/" \
        "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/settings/organization/members.tsx"
git commit -m "refactor(settings): colocate invite member form in -members/ private folder"
```

---

### Task 5: Fix sign-up to use `useTransition` pattern

`sign-up.tsx` calls `form.handleSubmit()` without wrapping in `useTransition`. Per CLAUDE.md, the correct pattern for auth forms is `useTransition` + `startTransition(async () => { await form.handleSubmit() })`.

**Files:**

- Modify: `apps/web/src/routes/auth/sign-up.tsx`

**Step 1: Add `useTransition`**

```typescript
import { type FormEvent, useCallback, useTransition } from "react";
```

In `SignUpPage`:

```typescript
const [isPending, startTransition] = useTransition();
```

**Step 2: Update `handleSubmit`**

```typescript
const handleSubmit = useCallback(
   (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startTransition(async () => {
         await form.handleSubmit();
      });
   },
   [form, startTransition],
);
```

**Step 3: Wire `isPending` into the submit button**

The submit button is wrapped in `form.Subscribe`. Add `isPending` to its `disabled` condition:

```tsx
<Button
   className="h-11"
   disabled={!formState.canSubmit || formState.isSubmitting || isPending}
   type="submit"
   variant="default"
>
   {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
   Enviar
</Button>
```

Add `import { Loader2 } from "lucide-react";` if not already present.

**Step 4: Commit**

```bash
git add apps/web/src/routes/auth/sign-up.tsx
git commit -m "refactor(auth): use useTransition in sign-up form submission"
```

---

### Task 6: Open PR

```bash
git push -u origin hooks-refactor
gh pr create \
  --title "refactor(auth): private components pattern, password strength, features org" \
  --body "$(cat <<'EOF'
## Summary

- Extract `PENDING_INVITATION_KEY` from callback route to `features/organization/constants.ts` — shared keys belong in feature folders
- Extract shared auth UI primitives (`TermsAndPrivacyText`, `GoogleIcon`) to `routes/auth/-auth/` private folder
- Add password strength card to sign-up password step with 4 levels (fraca → forte)
- Colocate invite member form in `-members/` private folder next to the members settings route
- Fix sign-up form to use `useTransition` pattern per codebase conventions

## Test plan

- [ ] Sign-up: complete both steps, verify password strength card updates live
- [ ] Sign-up: submit form, verify loading spinner appears and toast fires
- [ ] Sign-in: verify Terms/Privacy links render correctly (shared component)
- [ ] Invitation flow: accept invite URL while logged out → sign in → auto-accept → redirect to org
- [ ] Invitation flow: accept invite URL while logged in → accept immediately
- [ ] Settings → Members: invite a member via dialog, verify form still works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
