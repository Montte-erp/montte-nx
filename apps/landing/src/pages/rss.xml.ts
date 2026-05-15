import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export const prerender = true;

export async function GET(context: APIContext) {
   const posts = (await getCollection("blog")).sort(
      (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
   );

   return rss({
      title: "Blog do Montte",
      description:
         "Novidades, releases e bastidores do Montte — plataforma operacional brasileira com IA nativa.",
      site: context.site ?? "https://montte.co",
      stylesheet: false,
      customData: `<language>pt-br</language>`,
      items: posts.map((post) => ({
         title: post.data.title,
         description: post.data.description,
         pubDate: post.data.publishedAt,
         link: `/blog/${post.id}/`,
         categories: post.data.tags,
         author: post.data.author,
      })),
   });
}
