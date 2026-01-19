import type { ReactNode } from "react";

export type EntityExpandedContentProps = {
   /**
    * Entity-specific content to display (stats, details, etc.)
    */
   children: ReactNode;
   /**
    * Action buttons (typically EntityActions component)
    */
   actions: ReactNode;
};

/**
 * Standardized expanded row content wrapper for entity tables.
 * Displays entity-specific content followed by action buttons separated by a border.
 *
 * @example
 * ```tsx
 * <EntityExpandedContent
 *    actions={
 *       <EntityActions
 *          detailsLink={{ to: "/$slug/categories/$categoryId", params: {...} }}
 *          onEdit={() => openSheet({ children: <ManageCategoryForm /> })}
 *          onDelete={deleteCategory}
 *          variant="full"
 *       />
 *    }
 * >
 *    <div className="flex items-center gap-6">
 *       <div>Total de Receitas: +{formatCurrency(income)}</div>
 *       <Separator orientation="vertical" />
 *       <div>Total de Despesas: -{formatCurrency(expenses)}</div>
 *    </div>
 * </EntityExpandedContent>
 * ```
 */
export function EntityExpandedContent({
   children,
   actions,
}: EntityExpandedContentProps) {
   return (
      <div className="p-4 space-y-4">
         {children}
         <div className="pt-2 border-t">{actions}</div>
      </div>
   );
}

export type ResponsiveEntityExpandedContentProps = {
   /**
    * Entity-specific content to display on desktop (horizontal layout)
    */
   desktopContent: ReactNode;
   /**
    * Entity-specific content to display on mobile (vertical layout)
    */
   mobileContent: ReactNode;
   /**
    * Whether the current viewport is mobile
    */
   isMobile: boolean;
   /**
    * Action buttons for desktop (typically EntityActions with variant="full")
    */
   desktopActions: ReactNode;
   /**
    * Action buttons for mobile (typically EntityActions with variant="mobile")
    */
   mobileActions: ReactNode;
};

/**
 * Responsive expanded row content wrapper that renders different layouts
 * for desktop and mobile viewports.
 *
 * Desktop: horizontal layout with content on left, actions on right
 * Mobile: vertical layout with content on top, actions below
 *
 * @example
 * ```tsx
 * <ResponsiveEntityExpandedContent
 *    isMobile={isMobile}
 *    desktopContent={<StatsRow />}
 *    mobileContent={<StatsColumn />}
 *    desktopActions={<EntityActions variant="full" ... />}
 *    mobileActions={<EntityActions variant="mobile" ... />}
 * />
 * ```
 */
export function ResponsiveEntityExpandedContent({
   desktopContent,
   mobileContent,
   isMobile,
   desktopActions,
   mobileActions,
}: ResponsiveEntityExpandedContentProps) {
   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            {mobileContent}
            <div className="pt-2 border-t">{mobileActions}</div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         {desktopContent}
         {desktopActions}
      </div>
   );
}
