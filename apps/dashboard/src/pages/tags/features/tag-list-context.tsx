import { createListContext } from "@/lib/list-context-factory";

const {
   ListContext: TagListContext,
   ListProvider: TagListProvider,
   useList: useTagList,
} = createListContext({
   displayName: "Tag",
});

export { TagListContext, TagListProvider, useTagList };
export type { ListContextType as TagListContextType } from "@/lib/list-context-factory";
