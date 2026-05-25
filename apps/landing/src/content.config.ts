import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

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
         releaseUrl: z.url().optional(),
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
         canonicalUrl: z.url().optional(),
      }),
});

const docs = defineCollection({
   loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/docs" }),
   schema: z.object({
      title: z.string().max(90),
      description: z.string().min(80).max(240),
      category: z.string().default("Guia"),
      order: z.number().int().nonnegative().default(999),
      updatedAt: z.coerce.date(),
      aiSummary: z.string().min(40).max(240),
      commonQuestions: z.array(z.string()).max(8).default([]),
   }),
});

export const collections = { blog, docs };
