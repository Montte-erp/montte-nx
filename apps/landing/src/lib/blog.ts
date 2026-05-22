import { createSlug } from "@core/utils/text";
import { getCollection, type CollectionEntry } from "astro:content";

export interface BlogCategoryTab {
   name: string;
   count: number;
   active: boolean;
   href: string;
}

const siteUrl = "https://montte.co";

export async function getSortedBlogPosts() {
   const posts = await getCollection("blog");
   return sortBlogPosts(posts);
}

export function sortBlogPosts(posts: CollectionEntry<"blog">[]) {
   return posts.toSorted(
      (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
   );
}

export function getBlogCategories(posts: CollectionEntry<"blog">[]) {
   const categoryCounts = posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.data.category] = (acc[post.data.category] ?? 0) + 1;
      return acc;
   }, {});

   return Object.entries(categoryCounts).sort(([, a], [, b]) => b - a);
}

export function getBlogCategoryTabs(
   posts: CollectionEntry<"blog">[],
   activeCategory?: string,
): BlogCategoryTab[] {
   return [
      {
         name: "Todos os posts",
         count: posts.length,
         active: !activeCategory,
         href: "/blog",
      },
      ...getBlogCategories(posts).map(([name, count]) => ({
         name,
         count,
         active: name === activeCategory,
         href: `/blog/categoria/${createSlug(name)}`,
      })),
   ];
}

export function getBlogItemListLd(
   posts: CollectionEntry<"blog">[],
   name: string,
) {
   return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name,
      itemListElement: posts.map((post, index) => ({
         "@type": "ListItem",
         position: index + 1,
         url: new URL(`/blog/${post.id}`, siteUrl).toString(),
         name: post.data.title,
      })),
   };
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
