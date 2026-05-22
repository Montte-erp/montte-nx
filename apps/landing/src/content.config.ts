import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro:schema";

const blog = defineCollection({
   loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
   schema: ({ image }) =>
      z.object({
         title: z.string().max(90),
         description: z.string().min(80).max(360),
         publishedAt: z.coerce.date(),
         updatedAt: z.coerce.date().optional(),
         author: z.string().default("Equipe Montte"),
         tags: z.array(z.string()).default([]),
         category: z.string().default("Notas de release"),
         coverImage: image(),
         ogImage: image().optional(),
         featured: z.boolean().default(false),
         releaseUrl: z.string().url().optional(),
         releaseVersion: z.string().optional(),
         keyTakeaways: z.array(z.string()).max(6).optional(),
         faq: z
            .array(
               z.object({
                  question: z.string(),
                  answer: z.string(),
               }),
            )
            .optional(),
         readingMinutes: z.number().int().positive().optional(),
         canonicalUrl: z.string().url().optional(),
      }),
});

export const collections = { blog };
