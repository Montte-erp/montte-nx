import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export type EntityMobileCardProps = {
   /**
    * Icon element to display in the card header
    */
   icon: ReactNode;
   /**
    * Primary text/title for the card
    */
   title: ReactNode;
   /**
    * Secondary text/description (optional)
    */
   subtitle?: ReactNode;
   /**
    * Additional content to show in the card body (badges, stats, etc.)
    */
   content?: ReactNode;
   /**
    * Whether the card is currently expanded
    */
   isExpanded: boolean;
   /**
    * Callback to toggle expanded state
    */
   toggleExpanded: () => void;
   /**
    * Whether the card can be expanded (default: true)
    */
   canExpand?: boolean;
   /**
    * Labels for expand/collapse button
    */
   expandLabels?: {
      expand?: string;
      collapse?: string;
   };
};

const defaultExpandLabels = {
   collapse: "Menos info",
   expand: "Mais info",
};

/**
 * Standardized mobile card wrapper for entity lists.
 * Provides consistent layout with icon, title, optional subtitle,
 * optional content area, and expand/collapse functionality.
 *
 * @example
 * ```tsx
 * <EntityMobileCard
 *    icon={
 *       <div className="size-10 rounded-sm flex items-center justify-center bg-muted">
 *          <Building2 className="size-5" />
 *       </div>
 *    }
 *    title={costCenter.name}
 *    subtitle={costCenter.code}
 *    content={<StatsRow income={income} expenses={expenses} />}
 *    isExpanded={isExpanded}
 *    toggleExpanded={toggleExpanded}
 * />
 * ```
 */
export function EntityMobileCard({
   icon,
   title,
   subtitle,
   content,
   isExpanded,
   toggleExpanded,
   canExpand = true,
   expandLabels = defaultExpandLabels,
}: EntityMobileCardProps) {
   const mergedLabels = { ...defaultExpandLabels, ...expandLabels };

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               {icon}
               <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  {subtitle && <CardDescription>{subtitle}</CardDescription>}
               </div>
            </div>
         </CardHeader>
         {content && <CardContent>{content}</CardContent>}
         {!content && <CardContent />}
         {canExpand && (
            <CardFooter>
               <CollapsibleTrigger asChild>
                  <Button
                     className="w-full"
                     onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded();
                     }}
                     variant="outline"
                  >
                     {isExpanded ? mergedLabels.collapse : mergedLabels.expand}
                     <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                     />
                  </Button>
               </CollapsibleTrigger>
            </CardFooter>
         )}
      </Card>
   );
}

export type EntityMobileCardWithActionsProps = EntityMobileCardProps & {
   /**
    * Actions to display when expanded (typically EntityActions with variant="mobile")
    */
   expandedActions?: ReactNode;
};

/**
 * Mobile card variant that includes action buttons in the expanded state.
 * Actions appear below the expand button when the card is expanded.
 *
 * @example
 * ```tsx
 * <EntityMobileCardWithActions
 *    icon={<TagIcon />}
 *    title={tag.name}
 *    content={<StatsRow />}
 *    isExpanded={isExpanded}
 *    toggleExpanded={toggleExpanded}
 *    expandedActions={
 *       <EntityActions
 *          variant="mobile"
 *          detailsLink={{ to: "/$slug/tags/$tagId", params: {...} }}
 *          onEdit={() => openSheet({ children: <ManageTagForm /> })}
 *          onDelete={deleteTag}
 *       />
 *    }
 * />
 * ```
 */
export function EntityMobileCardWithActions({
   icon,
   title,
   subtitle,
   content,
   isExpanded,
   toggleExpanded,
   canExpand = true,
   expandLabels = defaultExpandLabels,
   expandedActions,
}: EntityMobileCardWithActionsProps) {
   const mergedLabels = { ...defaultExpandLabels, ...expandLabels };

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               {icon}
               <div>
                  <CardTitle className="text-base">{title}</CardTitle>
                  {subtitle && <CardDescription>{subtitle}</CardDescription>}
               </div>
            </div>
         </CardHeader>
         {content && <CardContent>{content}</CardContent>}
         {!content && <CardContent />}
         {canExpand && (
            <CardFooter className="flex-col gap-2">
               <CollapsibleTrigger asChild>
                  <Button
                     className="w-full"
                     onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded();
                     }}
                     variant="outline"
                  >
                     {isExpanded ? mergedLabels.collapse : mergedLabels.expand}
                     <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                     />
                  </Button>
               </CollapsibleTrigger>
               {isExpanded && expandedActions && (
                  <div className="w-full pt-2 border-t">{expandedActions}</div>
               )}
            </CardFooter>
         )}
      </Card>
   );
}
