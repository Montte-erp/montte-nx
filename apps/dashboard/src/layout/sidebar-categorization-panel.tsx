import { SidebarContent, useSidebar } from "@packages/ui/components/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Building2, FolderOpen, Layers, Tag } from "lucide-react";
import { useCategorizationData } from "./hooks/use-submenu-data";
import {
   CollapsibleSection,
   EmptyState,
   ItemRow,
   LoadingSkeleton,
   PanelHeader,
   SearchHeader,
} from "./sidebar-panel-shared";
import { useSubmenu } from "./sidebar-submenu-context";

export function SidebarCategorizationPanel() {
   const { panelState, setSearch, setSort, toggleSection, closeSubmenu } =
      useSubmenu();
   const { setOpenMobile } = useSidebar();
   const { pathname } = useLocation();
   const navigate = useNavigate();

   const slug = pathname.split("/")[1] || "";

   const {
      categories,
      costCenters,
      tags,
      isLoading,
      totalCategories,
      totalCostCenters,
      totalTags,
   } = useCategorizationData({
      search: panelState.search,
      sortBy: panelState.sortBy,
      sortDirection: panelState.sortDirection,
      enabled: true,
   });

   const isActive = (type: "category" | "costCenter" | "tag", id: string) => {
      if (type === "category") {
         return pathname === `/${slug}/categories/${id}`;
      }
      if (type === "costCenter") {
         return pathname === `/${slug}/cost-centers/${id}`;
      }
      return pathname === `/${slug}/tags/${id}`;
   };

   const handleItemClick = () => {
      setOpenMobile(false);
      closeSubmenu();
   };

   const handleCreateCategory = () => {
      navigate({ to: "/$slug/categories", params: { slug } });
      handleItemClick();
   };

   const handleCreateCostCenter = () => {
      navigate({ to: "/$slug/cost-centers", params: { slug } });
      handleItemClick();
   };

   const handleCreateTag = () => {
      navigate({ to: "/$slug/tags", params: { slug } });
      handleItemClick();
   };

   const hasNoResults =
      !isLoading &&
      categories.length === 0 &&
      costCenters.length === 0 &&
      tags.length === 0;

   return (
      <div className="flex flex-col h-full">
         {/* Panel Header with title and create dropdown */}
         <PanelHeader
            createOptions={[
               {
                  icon: FolderOpen,
                  label: "Nova Categoria",
                  onClick: handleCreateCategory,
               },
               {
                  icon: Building2,
                  label: "Novo Centro de Custo",
                  onClick: handleCreateCostCenter,
               },
               {
                  icon: Tag,
                  label: "Nova Tag",
                  onClick: handleCreateTag,
               },
            ]}
            icon={Layers}
            title="Categorização"
         />

         <SearchHeader
            onSearchChange={setSearch}
            onSortChange={setSort}
            placeholder="Buscar..."
            search={panelState.search}
            sortBy={panelState.sortBy}
            sortDirection={panelState.sortDirection}
         />

         <SidebarContent>
            {isLoading ? (
               <LoadingSkeleton />
            ) : hasNoResults ? (
               <EmptyState search={panelState.search} />
            ) : (
               <div className="py-2">
                  {/* Categories Section */}
                  <CollapsibleSection
                     action={
                        <Link
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           params={{ slug }}
                           to="/$slug/categories"
                        >
                           Ver todos
                        </Link>
                     }
                     count={totalCategories}
                     isExpanded={panelState.expandedSections.includes(
                        "categories",
                     )}
                     onToggle={() => toggleSection("categories")}
                     title="Categorias"
                  >
                     {categories.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhuma categoria encontrada
                        </p>
                     ) : (
                        categories.map((category) => (
                           <ItemRow
                              icon={FolderOpen}
                              iconColor={category.color}
                              id={category.id}
                              isActive={isActive("category", category.id)}
                              key={`category-${category.id}`}
                              name={category.name}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 navigate({
                                    to: "/$slug/categories/$categoryId",
                                    params: { slug, categoryId: category.id },
                                 });
                              }}
                              timestamp={category.updatedAt}
                              url={`/${slug}/categories/${category.id}`}
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Cost Centers Section */}
                  <CollapsibleSection
                     action={
                        <Link
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           params={{ slug }}
                           to="/$slug/cost-centers"
                        >
                           Ver todos
                        </Link>
                     }
                     count={totalCostCenters}
                     isExpanded={panelState.expandedSections.includes(
                        "costCenters",
                     )}
                     onToggle={() => toggleSection("costCenters")}
                     title="Centros de Custo"
                  >
                     {costCenters.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhum centro de custo encontrado
                        </p>
                     ) : (
                        costCenters.map((costCenter) => (
                           <ItemRow
                              badge={
                                 costCenter.code ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                       {costCenter.code}
                                    </span>
                                 ) : undefined
                              }
                              icon={Building2}
                              id={costCenter.id}
                              isActive={isActive("costCenter", costCenter.id)}
                              key={`costCenter-${costCenter.id}`}
                              name={costCenter.name}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 navigate({
                                    to: "/$slug/cost-centers/$costCenterId",
                                    params: {
                                       slug,
                                       costCenterId: costCenter.id,
                                    },
                                 });
                              }}
                              timestamp={costCenter.updatedAt}
                              url={`/${slug}/cost-centers/${costCenter.id}`}
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Tags Section */}
                  <CollapsibleSection
                     action={
                        <Link
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           params={{ slug }}
                           to="/$slug/tags"
                        >
                           Ver todos
                        </Link>
                     }
                     count={totalTags}
                     isExpanded={panelState.expandedSections.includes("tags")}
                     onToggle={() => toggleSection("tags")}
                     title="Tags"
                  >
                     {tags.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhuma tag encontrada
                        </p>
                     ) : (
                        tags.map((tag) => (
                           <ItemRow
                              icon={Tag}
                              iconColor={tag.color}
                              id={tag.id}
                              isActive={isActive("tag", tag.id)}
                              key={`tag-${tag.id}`}
                              name={tag.name}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 navigate({
                                    to: "/$slug/tags/$tagId",
                                    params: { slug, tagId: tag.id },
                                 });
                              }}
                              timestamp={tag.updatedAt}
                              url={`/${slug}/tags/${tag.id}`}
                           />
                        ))
                     )}
                  </CollapsibleSection>
               </div>
            )}
         </SidebarContent>
      </div>
   );
}
