import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
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
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   ArrowDownLeft,
   ArrowUpRight,
   Calendar,
   ChevronDown,
   Edit,
   Eye,
   Tag,
   Trash2,
} from "lucide-react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { Tag as TagType } from "@/pages/tags/ui/tags-page";
import { ManageTagForm } from "../features/manage-tag-form";
import { useDeleteTag } from "../features/use-delete-tag";

function TagActionsCell({ tag }: { tag: TagType }) {
   const { activeOrganization } = useActiveOrganization();

   return (
      <div className="flex justify-end">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        slug: activeOrganization.slug,
                        tagId: tag.id,
                     }}
                     to="/$slug/tags/$tagId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createTagColumns(_slug: string): ColumnDef<TagType>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const tag = row.original;
            return (
               <Announcement>
                  <AnnouncementTag
                     style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                     }}
                  >
                     <Tag className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="max-w-[150px] truncate">
                     {tag.name}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "createdAt",
         cell: ({ row }) => {
            const tag = row.original;
            return (
               <Announcement>
                  <AnnouncementTag>
                     <Calendar className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-muted-foreground">
                     {formatDate(new Date(tag.createdAt), "DD MMM YYYY")}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: true,
         header: "Criado em",
      },
      {
         cell: ({ row }) => <TagActionsCell tag={row.original} />,
         header: "",
         id: "actions",
      },
   ];
}

interface TagExpandedContentProps {
   row: Row<TagType>;
   income: number;
   expenses: number;
}

export function TagExpandedContent({
   row,
   income,
   expenses,
}: TagExpandedContentProps) {
   const tag = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { deleteTag } = useDeleteTag({ tag });

   const statsRow = (
      <div className="flex flex-wrap items-center gap-2">
         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <ArrowDownLeft className="size-3.5 text-emerald-500" />
               Receita
            </AnnouncementTag>
            <AnnouncementTitle className="text-emerald-500">
               +{formatDecimalCurrency(income)}
            </AnnouncementTitle>
         </Announcement>

         <div className="h-4 w-px bg-border" />

         <Announcement>
            <AnnouncementTag className="flex items-center gap-1.5">
               <ArrowUpRight className="size-3.5 text-destructive" />
               Despesas
            </AnnouncementTag>
            <AnnouncementTitle className="text-destructive">
               -{formatDecimalCurrency(expenses)}
            </AnnouncementTitle>
         </Announcement>
      </div>
   );

   const actionsRow = (
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
         <Button asChild size="sm" variant="outline">
            <Link
               params={{
                  slug: activeOrganization.slug,
                  tagId: tag.id,
               }}
               to="/$slug/tags/$tagId"
            >
               <Eye className="size-4" />
               Ver detalhes
            </Link>
         </Button>
         <Button
            onClick={(e) => {
               e.stopPropagation();
               openSheet({
                  children: <ManageTagForm tag={tag} />,
               });
            }}
            size="sm"
            variant="outline"
         >
            <Edit className="size-4" />
            Editar tag
         </Button>
         <Button
            onClick={(e) => {
               e.stopPropagation();
               deleteTag();
            }}
            size="sm"
            variant="destructive"
         >
            <Trash2 className="size-4" />
            Excluir tag
         </Button>
      </div>
   );

   return (
      <div className="p-4 space-y-4">
         {statsRow}
         {actionsRow}
      </div>
   );
}

interface TagMobileCardProps {
   row: Row<TagType>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   income: number;
   expenses: number;
}

export function TagMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   income,
   expenses,
}: TagMobileCardProps) {
   const tag = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { deleteTag } = useDeleteTag({ tag });

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div
                  className="size-10 rounded-sm flex items-center justify-center"
                  style={{ backgroundColor: tag.color }}
               >
                  <Tag className="size-5 text-white" />
               </div>
               <div>
                  <CardTitle className="text-base">{tag.name}</CardTitle>
                  <CardDescription>
                     {formatDate(new Date(tag.createdAt), "DD MMM YYYY")}
                  </CardDescription>
               </div>
            </div>
         </CardHeader>
         <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <ArrowDownLeft className="size-3.5 text-emerald-500" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-emerald-500">
                     +{formatDecimalCurrency(income)}
                  </AnnouncementTitle>
               </Announcement>
               <Announcement>
                  <AnnouncementTag className="flex items-center gap-1.5">
                     <ArrowUpRight className="size-3.5 text-destructive" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-destructive">
                     -{formatDecimalCurrency(expenses)}
                  </AnnouncementTitle>
               </Announcement>
            </div>
         </CardContent>
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
                  {isExpanded ? "Menos info" : "Mais info"}
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
               </Button>
            </CollapsibleTrigger>
            {isExpanded && (
               <div className="w-full space-y-2 pt-2 border-t">
                  <Button
                     asChild
                     className="w-full justify-start"
                     size="sm"
                     variant="outline"
                  >
                     <Link
                        params={{
                           slug: activeOrganization.slug,
                           tagId: tag.id,
                        }}
                        to="/$slug/tags/$tagId"
                     >
                        <Eye className="size-4" />
                        Ver detalhes
                     </Link>
                  </Button>
                  <Button
                     className="w-full justify-start"
                     onClick={(e) => {
                        e.stopPropagation();
                        openSheet({
                           children: <ManageTagForm tag={tag} />,
                        });
                     }}
                     size="sm"
                     variant="outline"
                  >
                     <Edit className="size-4" />
                     Editar tag
                  </Button>
                  <Button
                     className="w-full justify-start"
                     onClick={(e) => {
                        e.stopPropagation();
                        deleteTag();
                     }}
                     size="sm"
                     variant="destructive"
                  >
                     <Trash2 className="size-4" />
                     Excluir tag
                  </Button>
               </div>
            )}
         </CardFooter>
      </Card>
   );
}
