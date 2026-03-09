# Unified Icon Button Pattern Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `icon-solid` and `icon-outline` variants plus a `tooltip` prop to the base `Button` component, then replace every manual `<Tooltip> + <Button>` pattern and all `TooltipIconButton` usages with the new unified API.

**Architecture:** Extend the existing CVA-powered `Button` in `packages/ui` with two new semantic variants and an optional `tooltip` / `tooltipSide` prop. When `tooltip` is provided, the button renders itself wrapped in `<Tooltip><TooltipTrigger asChild>…<TooltipContent>`. All callers migrate to this API; `TooltipIconButton` is deleted.

**Tech Stack:** React 19, Radix UI Tooltip, CVA, TypeScript

---

### Task 1: Extend `button.tsx` — variants + tooltip prop

**Files:**

- Modify: `packages/ui/src/components/button.tsx`

**Step 1: Add Tooltip imports at the top of the file**

Add after the existing imports:

```typescript
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
```

**Step 2: Add `icon-solid` and `icon-outline` to the CVA variants block**

Replace:

```typescript
         variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive:
               "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline:
               "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
            secondary:
               "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
            link: "text-primary underline-offset-4 hover:underline",
         },
```

With:

```typescript
         variant: {
            default: "bg-primary text-primary-foreground hover:bg-primary/90",
            destructive:
               "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline:
               "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
            secondary:
               "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
            link: "text-primary underline-offset-4 hover:underline",
            "icon-solid": "bg-primary text-primary-foreground hover:bg-primary/90",
            "icon-outline":
               "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
         },
```

**Step 3: Add `tooltip` and `tooltipSide` props + conditional wrapping**

Replace the entire `Button` function:

```typescript
function Button({
   className,
   variant = "default",
   size = "default",
   asChild = false,
   tooltip,
   tooltipSide,
   ...props
}: React.ComponentProps<"button"> &
   VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
      tooltip?: string;
      tooltipSide?: "top" | "bottom" | "left" | "right";
   }) {
   const Comp = asChild ? Slot.Root : "button";

   const button = (
      <Comp
         className={cn(buttonVariants({ variant, size, className }))}
         data-size={size}
         data-slot="button"
         data-variant={variant}
         {...props}
      />
   );

   if (tooltip) {
      return (
         <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
         </Tooltip>
      );
   }

   return button;
}
```

**Step 4: Verify the file compiles**

```bash
cd /home/yorizel/Documents/montte-nx && npx tsc -p packages/ui/tsconfig.json --noEmit 2>&1 | head -30
```

Expected: no errors related to button.tsx.

**Step 5: Commit**

```bash
git add packages/ui/src/components/button.tsx
git commit -m "feat(button): add icon-solid/icon-outline variants and tooltip prop"
```

---

### Task 2: Migrate `page-header.tsx`

**Files:**

- Modify: `apps/web/src/components/page-header.tsx`

**Step 1: Remove Tooltip imports**

Find the import block that includes `Tooltip`, `TooltipContent`, `TooltipTrigger` (from `@packages/ui/components/tooltip`) and remove those three named imports. If `TooltipProvider` is also imported only for these usages, remove it too.

**Step 2: Replace the three Tooltip+Button blocks**

Replace save button (lines ~98–110):

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={commit}
         size="icon-sm"
         type="button"
         variant="outline"
      >
         <Check />
      </Button>
   </TooltipTrigger>
   <TooltipContent>Salvar</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={commit}
   size="icon-sm"
   tooltip="Salvar"
   type="button"
   variant="icon-outline"
>
   <Check />
</Button>
```

Replace cancel button (lines ~111–124):

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={discard}
         onMouseDown={(e) => e.preventDefault()}
         size="icon-sm"
         type="button"
         variant="outline"
      >
         <X />
      </Button>
   </TooltipTrigger>
   <TooltipContent>Cancelar</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={discard}
   onMouseDown={(e) => e.preventDefault()}
   size="icon-sm"
   tooltip="Cancelar"
   type="button"
   variant="icon-outline"
>
   <X />
</Button>
```

Replace edit button (lines ~140–152):

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={startEditing}
         size="icon-sm"
         type="button"
         variant="outline"
      >
         <Pencil />
      </Button>
   </TooltipTrigger>
   <TooltipContent>Editar</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={startEditing}
   size="icon-sm"
   tooltip="Editar"
   type="button"
   variant="icon-outline"
>
   <Pencil />
</Button>
```

**Step 3: Commit**

```bash
git add apps/web/src/components/page-header.tsx
git commit -m "refactor(page-header): use Button tooltip prop"
```

---

### Task 3: Migrate `context-panel-header-actions.tsx`

**Files:**

- Modify: `apps/web/src/features/context-panel/context-panel-header-actions.tsx`

**Step 1: Replace the entire file content**

```tsx
import { Button } from "@packages/ui/components/button";
import { PanelRight, Sparkles } from "lucide-react";
import { openContextPanel, setActiveTab } from "./use-context-panel";

export function ContextPanelHeaderActions() {
   const handleOpenAI = () => {
      setActiveTab("chat");
      openContextPanel();
   };

   const handleOpenPanel = () => {
      setActiveTab("info");
      openContextPanel();
   };

   return (
      <div className="flex items-center gap-1">
         <Button
            className="size-8 rounded"
            onClick={handleOpenAI}
            size="icon"
            tooltip="Abrir Chat IA"
            type="button"
            variant="ghost"
         >
            <Sparkles className="size-4" />
         </Button>

         <Button
            className="size-8 rounded"
            onClick={handleOpenPanel}
            size="icon"
            tooltip="Abrir painel"
            type="button"
            variant="ghost"
         >
            <PanelRight className="size-4" />
         </Button>
      </div>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel-header-actions.tsx
git commit -m "refactor(context-panel): use Button tooltip prop"
```

---

### Task 4: Migrate `context-panel.tsx` (tab buttons)

**Files:**

- Modify: `apps/web/src/features/context-panel/context-panel.tsx`

**Step 1: Remove Tooltip/TooltipProvider imports from tooltip**

Check the imports at the top of the file. Remove `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` from `@packages/ui/components/tooltip` if they are only used for the tab buttons.

**Step 2: Replace the tab button map**

Replace (lines ~122–144):

```tsx
// BEFORE
<TooltipProvider>
   {allTabs.map((tab) => (
      <Tooltip key={tab.id}>
         <TooltipTrigger asChild>
            <Button
               className={cn(
                  "size-7 rounded",
                  activeTabId === tab.id &&
                     "bg-accent text-accent-foreground",
               )}
               onClick={() => setActiveTab(tab.id)}
               size="icon"
               type="button"
               variant="ghost"
            >
               <tab.icon className="size-4" />
            </Button>
         </TooltipTrigger>
         <TooltipContent side="bottom">
            {tab.label}
         </TooltipContent>
      </Tooltip>
   ))}
</TooltipProvider>

// AFTER
<>
   {allTabs.map((tab) => (
      <Button
         key={tab.id}
         className={cn(
            "size-7 rounded",
            activeTabId === tab.id &&
               "bg-accent text-accent-foreground",
         )}
         onClick={() => setActiveTab(tab.id)}
         size="icon"
         tooltip={tab.label}
         tooltipSide="bottom"
         type="button"
         variant="ghost"
      >
         <tab.icon className="size-4" />
      </Button>
   ))}
</>
```

**Step 3: Commit**

```bash
git add apps/web/src/features/context-panel/context-panel.tsx
git commit -m "refactor(context-panel): use Button tooltip prop for tab buttons"
```

---

### Task 5: Migrate `organization-roles.tsx`

**Files:**

- Modify: `apps/web/src/features/roles/ui/organization-roles.tsx`

**Step 1: Remove Tooltip imports**

Remove `Tooltip`, `TooltipContent`, `TooltipTrigger` from the tooltip import.

**Step 2: Replace the icon button**

Replace (lines ~173–185):

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={() => handleEditRole(role)}
         size="icon"
         variant="ghost"
      >
         <Pencil className="size-4" />
         <span className="sr-only">Editar função</span>
      </Button>
   </TooltipTrigger>
   <TooltipContent>Editar função</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={() => handleEditRole(role)}
   size="icon"
   tooltip="Editar função"
   variant="ghost"
>
   <Pencil className="size-4" />
</Button>
```

**Step 3: Commit**

```bash
git add apps/web/src/features/roles/ui/organization-roles.tsx
git commit -m "refactor(roles): use Button tooltip prop"
```

---

### Task 6: Migrate `webhooks-table.tsx`

**Files:**

- Modify: `apps/web/src/features/webhooks/ui/webhooks-table.tsx`

**Note:** Line 159 wraps a `<span>` (NOT a Button) — do NOT change that Tooltip. Only migrate line 210 (the edit button).

**Step 1: Replace only the edit button (lines ~209–221)**

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={() => onEdit(row.original)}
         size="icon"
         variant="ghost"
      >
         <Edit className="size-4" />
         <span className="sr-only">Editar</span>
      </Button>
   </TooltipTrigger>
   <TooltipContent>Editar</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={() => onEdit(row.original)}
   size="icon"
   tooltip="Editar"
   variant="ghost"
>
   <Edit className="size-4" />
</Button>
```

**Step 2: Clean up imports**

Check if `Tooltip`, `TooltipTrigger`, `TooltipContent` are still used (line 159 wraps a `<span>` in a Tooltip — keep those imports if so). Only remove the imports that are no longer used.

**Step 3: Commit**

```bash
git add apps/web/src/features/webhooks/ui/webhooks-table.tsx
git commit -m "refactor(webhooks): use Button tooltip prop for edit button"
```

---

### Task 7: Migrate `settings/security.tsx`

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/security.tsx`

**Step 1: Replace the session details button (lines ~257–279)**

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={() =>
            openSheet({
               children: (
                  <SessionDetailsForm
                     currentSessionId={currentSessionId || null}
                     session={session}
                  />
               ),
            })
         }
         size="icon"
         variant="ghost"
      >
         <ChevronRight className="size-4" />
      </Button>
   </TooltipTrigger>
   <TooltipContent>Ver detalhes</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={() =>
      openSheet({
         children: (
            <SessionDetailsForm
               currentSessionId={currentSessionId || null}
               session={session}
            />
         ),
      })
   }
   size="icon"
   tooltip="Ver detalhes"
   variant="ghost"
>
   <ChevronRight className="size-4" />
</Button>
```

**Step 2: Remove unused Tooltip imports**

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/'$slug'/'$teamSlug'/_dashboard/settings/security.tsx
git commit -m "refactor(security): use Button tooltip prop"
```

---

### Task 8: Migrate `settings/project/general.tsx`

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general.tsx`

**Step 1: Replace copy API key button (lines ~321–340)**

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={handleCopyApiKey}
         size="icon"
         variant="ghost"
      >
         {apiKeyCopied ? (
            <Check className="size-4" />
         ) : (
            <Copy className="size-4" />
         )}
      </Button>
   </TooltipTrigger>
   <TooltipContent>
      {apiKeyCopied ? "Copiado!" : "Copiar chave de API"}
   </TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={handleCopyApiKey}
   size="icon"
   tooltip={apiKeyCopied ? "Copiado!" : "Copiar chave de API"}
   variant="ghost"
>
   {apiKeyCopied ? (
      <Check className="size-4" />
   ) : (
      <Copy className="size-4" />
   )}
</Button>
```

**Step 2: Replace regenerate key button (lines ~342–353)**

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         onClick={handleRegenerateApiKey}
         size="icon"
         variant="ghost"
      >
         <RefreshCw className="size-4" />
      </Button>
   </TooltipTrigger>
   <TooltipContent>Regenerar chave</TooltipContent>
</Tooltip>

// AFTER
<Button
   onClick={handleRegenerateApiKey}
   size="icon"
   tooltip="Regenerar chave"
   variant="ghost"
>
   <RefreshCw className="size-4" />
</Button>
```

**Step 3: Remove unused Tooltip imports**

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/'$slug'/'$teamSlug'/_dashboard/settings/project/general.tsx
git commit -m "refactor(project-settings): use Button tooltip prop"
```

---

### Task 9: Migrate `settings/organization/members.tsx`

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members.tsx`

**Step 1: Replace role toggle button at line ~472**

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         disabled={isDisabled}
         onClick={() =>
            onUpdateRole(
               member,
               member.role === "admin" ? "member" : "admin",
            )
         }
         size="icon"
         variant="ghost"
      >
         <ShieldCheck className="size-4" />
         <span className="sr-only">{roleLabel}</span>
      </Button>
   </TooltipTrigger>
   <TooltipContent>{roleLabel}</TooltipContent>
</Tooltip>

// AFTER
<Button
   disabled={isDisabled}
   onClick={() =>
      onUpdateRole(
         member,
         member.role === "admin" ? "member" : "admin",
      )
   }
   size="icon"
   tooltip={roleLabel}
   variant="ghost"
>
   <ShieldCheck className="size-4" />
</Button>
```

**Step 2: Replace role toggle button at line ~827 (table column version)**

```tsx
// BEFORE
<Tooltip>
   <TooltipTrigger asChild>
      <Button
         disabled={isDisabled}
         onClick={() =>
            handleUpdateRole(
               member,
               member.role === "admin" ? "member" : "admin",
            )
         }
         size="icon"
         variant="ghost"
      >
         <ShieldCheck className="size-4" />
         <span className="sr-only">{roleLabel}</span>
      </Button>
   </TooltipTrigger>
   <TooltipContent>{roleLabel}</TooltipContent>
</Tooltip>

// AFTER
<Button
   disabled={isDisabled}
   onClick={() =>
      handleUpdateRole(
         member,
         member.role === "admin" ? "member" : "admin",
      )
   }
   size="icon"
   tooltip={roleLabel}
   variant="ghost"
>
   <ShieldCheck className="size-4" />
</Button>
```

**Step 3: Remove unused Tooltip imports**

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/'$slug'/'$teamSlug'/_dashboard/settings/organization/members.tsx
git commit -m "refactor(members): use Button tooltip prop"
```

---

### Task 10: Migrate `packages/ui` assistant-ui files

**Files:**

- Modify: `packages/ui/src/components/assistant-ui/attachment.tsx`
- Modify: `packages/ui/src/components/assistant-ui/markdown-text.tsx`

#### `attachment.tsx`

**Step 1: Replace the remove attachment button (lines ~187–193)**

```tsx
// BEFORE
<TooltipIconButton
   className="aui-attachment-tile-remove absolute top-1.5 right-1.5 size-3.5 rounded-full bg-white text-muted-foreground opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black hover:[&_svg]:text-destructive"
   side="top"
   tooltip="Remover arquivo"
>
   <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
</TooltipIconButton>

// AFTER
<Button
   className="aui-attachment-tile-remove absolute top-1.5 right-1.5 size-3.5 rounded-full bg-white text-muted-foreground opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black hover:[&_svg]:text-destructive"
   size="icon"
   tooltip="Remover arquivo"
   tooltipSide="top"
   variant="ghost"
>
   <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
</Button>
```

**Step 2: Replace the add attachment button (lines ~221–230)**

```tsx
// BEFORE
<TooltipIconButton
   aria-label="Adicionar anexo"
   className="aui-composer-add-attachment size-8.5 rounded-full p-1 font-semibold text-xs hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
   side="bottom"
   size="icon"
   tooltip="Adicionar anexo"
   variant="ghost"
>
   <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
</TooltipIconButton>

// AFTER
<Button
   aria-label="Adicionar anexo"
   className="aui-composer-add-attachment size-8.5 rounded-full p-1 font-semibold text-xs hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
   size="icon"
   tooltip="Adicionar anexo"
   tooltipSide="bottom"
   variant="ghost"
>
   <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
</Button>
```

**Step 3: Update imports in attachment.tsx**

Remove `TooltipIconButton` import. Add `Button` import if not already present:

```typescript
import { Button } from "@packages/ui/components/button";
```

#### `markdown-text.tsx`

**Step 4: Replace the copy code button (lines ~41–44)**

```tsx
// BEFORE
<TooltipIconButton onClick={onCopy} tooltip="Copiar">
   {!isCopied && <CopyIcon />}
   {isCopied && <CheckIcon />}
</TooltipIconButton>

// AFTER
<Button
   className="aui-button-icon size-6 p-1"
   onClick={onCopy}
   size="icon"
   tooltip="Copiar"
   variant="ghost"
>
   {!isCopied && <CopyIcon />}
   {isCopied && <CheckIcon />}
</Button>
```

**Step 5: Update imports in markdown-text.tsx**

Remove `TooltipIconButton` import. Add `Button` import if not already present.

**Step 6: Commit**

```bash
git add packages/ui/src/components/assistant-ui/attachment.tsx packages/ui/src/components/assistant-ui/markdown-text.tsx
git commit -m "refactor(assistant-ui): replace TooltipIconButton with Button tooltip prop"
```

---

### Task 11: Migrate `teco-chat/thread.tsx`

**Files:**

- Modify: `apps/web/src/features/teco-chat/ui/thread.tsx`

**Step 1: Replace scroll-to-bottom button (lines ~149–155)**

```tsx
// BEFORE
<TooltipIconButton
   className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
   tooltip="Rolar para o final"
   variant="outline"
>
   <ArrowDownIcon />
</TooltipIconButton>

// AFTER
<Button
   className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
   size="icon"
   tooltip="Rolar para o final"
   variant="icon-outline"
>
   <ArrowDownIcon />
</Button>
```

**Step 2: Replace send button (lines ~369–379)**

```tsx
// BEFORE
<TooltipIconButton
   aria-label="Enviar mensagem"
   className="aui-composer-send size-8 rounded-full"
   side="bottom"
   size="icon"
   tooltip="Enviar mensagem"
   type="submit"
   variant="default"
>
   <ArrowUpIcon className="aui-composer-send-icon size-4" />
</TooltipIconButton>

// AFTER
<Button
   aria-label="Enviar mensagem"
   className="aui-composer-send size-8 rounded-full"
   size="icon"
   tooltip="Enviar mensagem"
   tooltipSide="bottom"
   type="submit"
   variant="icon-solid"
>
   <ArrowUpIcon className="aui-composer-send-icon size-4" />
</Button>
```

**Step 3: Replace copy message button (lines ~526–533)**

```tsx
// BEFORE
<TooltipIconButton tooltip="Copiar">
   <AuiIf condition={(s) => s.message.isCopied}>
      <CheckIcon />
   </AuiIf>
   <AuiIf condition={(s) => !s.message.isCopied}>
      <CopyIcon />
   </AuiIf>
</TooltipIconButton>

// AFTER
<Button
   className="aui-button-icon size-6 p-1"
   size="icon"
   tooltip="Copiar"
   variant="ghost"
>
   <AuiIf condition={(s) => s.message.isCopied}>
      <CheckIcon />
   </AuiIf>
   <AuiIf condition={(s) => !s.message.isCopied}>
      <CopyIcon />
   </AuiIf>
</Button>
```

**Step 4: Replace reload button (lines ~536–538)**

```tsx
// BEFORE
<TooltipIconButton tooltip="Gerar novamente">
   <RefreshCwIcon />
</TooltipIconButton>

// AFTER
<Button
   className="aui-button-icon size-6 p-1"
   size="icon"
   tooltip="Gerar novamente"
   variant="ghost"
>
   <RefreshCwIcon />
</Button>
```

**Step 5: Replace more options button (lines ~542–547)**

```tsx
// BEFORE
<TooltipIconButton
   className="data-[state=open]:bg-accent"
   tooltip="Mais"
>
   <MoreHorizontalIcon />
</TooltipIconButton>

// AFTER
<Button
   className="aui-button-icon size-6 p-1 data-[state=open]:bg-accent"
   size="icon"
   tooltip="Mais"
   variant="ghost"
>
   <MoreHorizontalIcon />
</Button>
```

**Step 6: Replace user edit button (lines ~596–601)**

```tsx
// BEFORE
<TooltipIconButton
   className="aui-user-action-edit p-4"
   tooltip="Editar"
>
   <PencilIcon />
</TooltipIconButton>

// AFTER
<Button
   className="aui-user-action-edit size-6 p-4"
   size="icon"
   tooltip="Editar"
   variant="ghost"
>
   <PencilIcon />
</Button>
```

**Step 7: Replace branch picker previous button (lines ~644–646)**

```tsx
// BEFORE
<TooltipIconButton tooltip="Anterior">
   <ChevronLeftIcon />
</TooltipIconButton>

// AFTER
<Button
   className="aui-button-icon size-6 p-1"
   size="icon"
   tooltip="Anterior"
   variant="ghost"
>
   <ChevronLeftIcon />
</Button>
```

**Step 8: Replace branch picker next button (lines ~652–654)**

```tsx
// BEFORE
<TooltipIconButton tooltip="Próximo">
   <ChevronRightIcon />
</TooltipIconButton>

// AFTER
<Button
   className="aui-button-icon size-6 p-1"
   size="icon"
   tooltip="Próximo"
   variant="ghost"
>
   <ChevronRightIcon />
</Button>
```

**Step 9: Update imports in thread.tsx**

Remove the `TooltipIconButton` import line. Ensure `Button` from `@packages/ui/components/button` is imported.

**Step 10: Commit**

```bash
git add apps/web/src/features/teco-chat/ui/thread.tsx
git commit -m "refactor(teco-chat): replace TooltipIconButton with Button tooltip prop"
```

---

### Task 12: Delete `tooltip-icon-button.tsx`

**Files:**

- Delete: `packages/ui/src/components/assistant-ui/tooltip-icon-button.tsx`

**Step 1: Delete the file**

```bash
rm packages/ui/src/components/assistant-ui/tooltip-icon-button.tsx
```

**Step 2: Check if it's exported from any package.json exports**

```bash
grep -r "tooltip-icon-button" packages/ui/package.json
```

If found, remove that export entry from `packages/ui/package.json`.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(ui): delete TooltipIconButton — replaced by Button tooltip prop"
```

---

### Task 13: Final typecheck

**Step 1: Run full typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | tail -40
```

Expected: no errors. Fix any remaining type errors before marking complete.

**Step 2: Run biome check**

```bash
cd /home/yorizel/Documents/montte-nx && bun run check 2>&1 | tail -40
```

Expected: no lint/format errors.

---

### Files NOT to migrate (special composition patterns)

These use `<Tooltip>` to wrap non-Button elements or have complex Radix composition — leave them as-is:

| File                                                            | Reason                                                                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/features/feedback/ui/feedback-fab.tsx`            | Double `asChild` composition: `TooltipTrigger asChild` > `PopoverTrigger asChild` > `Button` — tooltip prop would break PopoverTrigger merge |
| `apps/web/src/layout/dashboard/ui/sub-sidebar-new-menu.tsx`     | Wraps `<div>` containing `<DropdownMenuItem>`, not a Button                                                                                  |
| `apps/web/src/layout/dashboard/ui/sub-sidebar-context-menu.tsx` | Wraps `<div>` containing `<DropdownMenuItem>`, not a Button                                                                                  |
| `apps/web/src/layout/dashboard/ui/theme-switcher.tsx`           | Wraps native `<button>` element, not the Button component                                                                                    |
| `apps/web/src/features/webhooks/ui/webhooks-table.tsx` line 159 | Wraps `<span>` for hover info, not a Button                                                                                                  |
| `apps/web/src/routes/.../danger-zone.tsx` line 91               | Wraps `<span tabIndex={0}>` around disabled Button for tooltip on disabled element                                                           |
