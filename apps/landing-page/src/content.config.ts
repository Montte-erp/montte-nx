import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
   loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
   schema: z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().default("Equipe Montte"),
      authorRole: z.string().optional(),
      authorAvatar: z.string().optional(),
      categoria: z
         .enum([
            "tutoriais",
            "dicas",
            "atualizacoes",
            "casos-de-uso",
            "financas-pessoais",
         ])
         .optional(),
      tags: z.array(z.string()).optional(),
      image: z
         .object({
            src: z.string(),
            alt: z.string(),
         })
         .optional(),
      draft: z.boolean().default(false),
   }),
});

export const collections = { blog };
