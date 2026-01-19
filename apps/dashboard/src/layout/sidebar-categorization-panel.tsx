import { SidebarContent, useSidebar } from "@packages/ui/components/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Building2, FolderOpen, Layers, Tag } from "lucide-react";
import { useCategorizationData } from "./hooks/use-submenu-data";
import { useSubmenu } from "./sidebar-submenu-context";
import {
   CollapsibleSection,
   EmptyState,
   ItemRow,
   LoadingSkeleton,
   PanelHeader,
   SearchHeader,
} from "./sidebar-panel-shared";

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
            title="Categorização"
            icon={Layers}
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
         />

         <SearchHeader
            search={panelState.search}
            onSearchChange={setSearch}
            sortBy={panelState.sortBy}
            sortDirection={panelState.sortDirection}
            onSortChange={setSort}
            placeholder="Buscar..."
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
                     title="Categorias"
                     count={totalCategories}
                     isExpanded={panelState.expandedSections.includes("categories")}
                     onToggle={() => toggleSection("categories")}
                     action={
                        <Link
                           to="/$slug/categories"
                           params={{ slug }}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                           Ver todos
                        </Link>
                     }
                  >
                     {categories.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhuma categoria encontrada
                        </p>
                     ) : (
                        categories.map((category) => (
                           <ItemRow
                              key={`category-${category.id}`}
                              id={category.id}
                              name={category.name}
                              url={`/${slug}/categories/${category.id}`}
                              icon={FolderOpen}
                              iconColor={category.color}
                              timestamp={category.updatedAt}
                              isActive={isActive("category", category.id)}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 navigate({
                                    to: "/$slug/categories/$categoryId",
                                    params: { slug, categoryId: category.id },
                                 });
                              }}
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Cost Centers Section */}
                  <CollapsibleSection
                     title="Centros de Custo"
                     count={totalCostCenters}
                     isExpanded={panelState.expandedSections.includes("costCenters")}
                     onToggle={() => toggleSection("costCenters")}
                     action={
                        <Link
                           to="/$slug/cost-centers"
                           params={{ slug }}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                           Ver todos
                        </Link>
                     }
                  >
                     {costCenters.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhum centro de custo encontrado
                        </p>
                     ) : (
                        costCenters.map((costCenter) => (
                           <ItemRow
                              key={`costCenter-${costCenter.id}`}
                              id={costCenter.id}
                              name={costCenter.name}
                              url={`/${slug}/cost-centers/${costCenter.id}`}
                              icon={Building2}
                              timestamp={costCenter.updatedAt}
                              isActive={isActive("costCenter", costCenter.id)}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 navigate({
                                    to: "/$slug/cost-centers/$costCenterId",
                                    params: { slug, costCenterId: costCenter.id },
                                 });
                              }}
                              badge={
                                 costCenter.code ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                       {costCenter.code}
                                    </span>
                                 ) : undefined
                              }
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Tags Section */}
                  <CollapsibleSection
                     title="Tags"
                     count={totalTags}
                     isExpanded={panelState.expandedSections.includes("tags")}
                     onToggle={() => toggleSection("tags")}
                     action={
                        <Link
                           to="/$slug/tags"
                           params={{ slug }}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                           Ver todos
                        </Link>
                     }
                  >
                     {tags.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhuma tag encontrada
                        </p>
                     ) : (
                        tags.map((tag) => (
                           <ItemRow
                              key={`tag-${tag.id}`}
                              id={tag.id}
                              name={tag.name}
                              url={`/${slug}/tags/${tag.id}`}
                              icon={Tag}
                              iconColor={tag.color}
                              timestamp={tag.updatedAt}
                              isActive={isActive("tag", tag.id)}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 navigate({
                                    to: "/$slug/tags/$tagId",
                                    params: { slug, tagId: tag.id },
                                 });
                              }}
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
