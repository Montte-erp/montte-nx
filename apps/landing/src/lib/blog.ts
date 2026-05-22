import type { CollectionEntry } from "astro:content";

export function slugifyCategory(category: string) {
   return category
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
}

export function getRelatedPosts(
   post: CollectionEntry<"blog">,
   posts: CollectionEntry<"blog">[],
) {
   return posts
      .filter((candidate) => candidate.id !== post.id)
      .map((candidate) => {
         const sharedTags = candidate.data.tags.filter((tag) =>
            post.data.tags.includes(tag),
         ).length;
         const categoryScore =
            candidate.data.category === post.data.category ? 2 : 0;

         return {
            post: candidate,
            score: sharedTags + categoryScore,
         };
      })
      .filter((candidate) => candidate.score > 0)
      .sort(
         (a, b) =>
            b.score - a.score ||
            b.post.data.publishedAt.getTime() -
               a.post.data.publishedAt.getTime(),
      )
      .slice(0, 2)
      .map((candidate) => candidate.post);
}
