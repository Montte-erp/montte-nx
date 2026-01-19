import { createListContext } from "@/lib/list-context-factory";

const {
   ListContext: CategoryListContext,
   ListProvider: CategoryListProvider,
   useList: useCategoryList,
} = createListContext({
   displayName: "Category",
});

export { CategoryListContext, CategoryListProvider, useCategoryList };
export type { ListContextType as CategoryListContextType } from "@/lib/list-context-factory";
