import type { CollectionEntry } from "astro:content";

export function sortDocs(docs: CollectionEntry<"docs">[]) {
   return docs.toSorted((a, b) => {
      const categoryCompare = a.data.category.localeCompare(b.data.category);
      if (categoryCompare !== 0) return categoryCompare;

      const orderCompare = a.data.order - b.data.order;
      if (orderCompare !== 0) return orderCompare;

      return a.data.title.localeCompare(b.data.title);
   });
}

export function getDocPath(doc: CollectionEntry<"docs">) {
   if (doc.id === "index") return "/docs";
   return `/docs/${doc.id}`;
}

export function groupDocsByCategory(docs: CollectionEntry<"docs">[]) {
   const groups = new Map<string, CollectionEntry<"docs">[]>();

   for (const doc of docs) {
      const existing = groups.get(doc.data.category) ?? [];
      existing.push(doc);
      groups.set(doc.data.category, existing);
   }

   return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items,
   }));
}
