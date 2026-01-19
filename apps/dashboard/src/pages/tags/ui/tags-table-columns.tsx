import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { formatDate } from "@packages/utils/date";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowUpRight, Calendar, Tag } from "lucide-react";

import { EntityActions, ViewDetailsButton } from "@/components/entity-actions";
import { EntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCardWithActions } from "@/components/entity-mobile-card";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { Tag as TagType } from "@/pages/tags/ui/tags-page";
import { ManageTagForm } from "../features/manage-tag-form";
import { useDeleteTag } from "../features/use-delete-tag";

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
         cell: ({ row }) => {
            const tag = row.original;
            const { activeOrganization } = useActiveOrganization();
            return (
               <ViewDetailsButton
                  detailsLink={{
                     params: {
                        slug: activeOrganization.slug,
                        tagId: tag.id,
                     },
                     to: "/$slug/tags/$tagId",
                  }}
               />
            );
         },
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

   const detailsLink = {
      params: {
         slug: activeOrganization.slug,
         tagId: tag.id,
      },
      to: "/$slug/tags/$tagId" as const,
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageTagForm tag={tag} />,
      });
   };

   const statsContent = (
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

   return (
      <EntityExpandedContent
         actions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{ edit: "Editar tag", delete: "Excluir tag" }}
               onDelete={deleteTag}
               onEdit={handleEdit}
               variant="full"
            />
         }
      >
         {statsContent}
      </EntityExpandedContent>
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

   const detailsLink = {
      params: {
         slug: activeOrganization.slug,
         tagId: tag.id,
      },
      to: "/$slug/tags/$tagId" as const,
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageTagForm tag={tag} />,
      });
   };

   const statsContent = (
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
   );

   return (
      <EntityMobileCardWithActions
         content={statsContent}
         expandedActions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{ edit: "Editar tag", delete: "Excluir tag" }}
               onDelete={deleteTag}
               onEdit={handleEdit}
               variant="mobile"
            />
         }
         icon={
            <div
               className="size-10 rounded-sm flex items-center justify-center"
               style={{ backgroundColor: tag.color }}
            >
               <Tag className="size-5 text-white" />
            </div>
         }
         isExpanded={isExpanded}
         subtitle={formatDate(new Date(tag.createdAt), "DD MMM YYYY")}
         title={tag.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
