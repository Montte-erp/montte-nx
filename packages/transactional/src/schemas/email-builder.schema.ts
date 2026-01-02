import { z } from "zod";

// ============================================
// Email Block Schemas
// ============================================

export const headingBlockSchema = z.object({
   type: z.literal("heading"),
   level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
   text: z.string(),
   align: z.enum(["left", "center", "right"]).optional().default("left"),
});

export const textBlockSchema = z.object({
   type: z.literal("text"),
   content: z.string(), // Supports {{variables}}
   align: z.enum(["left", "center", "right"]).optional().default("left"),
});

export const buttonBlockSchema = z.object({
   type: z.literal("button"),
   text: z.string(),
   url: z.string(),
   align: z.enum(["left", "center", "right"]).optional().default("center"),
   variant: z
      .enum(["primary", "secondary", "outline"])
      .optional()
      .default("primary"),
});

export const dividerBlockSchema = z.object({
   type: z.literal("divider"),
});

export const imageBlockSchema = z.object({
   type: z.literal("image"),
   src: z.string(),
   alt: z.string(),
   width: z.number().optional(),
   align: z.enum(["left", "center", "right"]).optional().default("center"),
});

export const spacerBlockSchema = z.object({
   type: z.literal("spacer"),
   height: z.number().min(8).max(100).default(24),
});

export const tableBlockSchema = z.object({
   type: z.literal("table"),
   dataSource: z.enum(["bills_data", "custom"]).default("bills_data"),
   columns: z
      .array(
         z.object({
            key: z.string(),
            label: z.string(),
            align: z
               .enum(["left", "center", "right"])
               .optional()
               .default("left"),
         }),
      )
      .optional(),
});

// Union of all block types
export const emailBlockSchema = z.discriminatedUnion("type", [
   headingBlockSchema,
   textBlockSchema,
   buttonBlockSchema,
   dividerBlockSchema,
   imageBlockSchema,
   spacerBlockSchema,
   tableBlockSchema,
]);

export type EmailBlock = z.infer<typeof emailBlockSchema>;
export type HeadingBlock = z.infer<typeof headingBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
export type ButtonBlock = z.infer<typeof buttonBlockSchema>;
export type DividerBlock = z.infer<typeof dividerBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type SpacerBlock = z.infer<typeof spacerBlockSchema>;
export type TableBlock = z.infer<typeof tableBlockSchema>;

// ============================================
// Email Template Schema
// ============================================

export const emailStylesSchema = z.object({
   primaryColor: z.string().optional().default("#3b82f6"),
   backgroundColor: z.string().optional().default("#f4f4f5"),
   textColor: z.string().optional().default("#18181b"),
   fontFamily: z
      .enum(["sans-serif", "serif", "monospace"])
      .optional()
      .default("sans-serif"),
});

export type EmailStyles = z.infer<typeof emailStylesSchema>;

export const emailTemplateSchema = z.object({
   blocks: z.array(emailBlockSchema),
   styles: emailStylesSchema.optional(),
});

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

// ============================================
// Available Variables
// ============================================

export const EMAIL_VARIABLES = [
   {
      key: "organization.name",
      label: "Nome da Organização",
      category: "organization",
   },
   { key: "user.name", label: "Nome do Usuário", category: "user" },
   { key: "user.email", label: "Email do Usuário", category: "user" },
   { key: "date.today", label: "Data de Hoje", category: "date" },
   { key: "date.period", label: "Período", category: "date" },
   { key: "bills.total", label: "Total de Contas", category: "bills" },
   { key: "bills.count", label: "Quantidade de Contas", category: "bills" },
   { key: "bills.overdue_count", label: "Contas Vencidas", category: "bills" },
   { key: "bills.pending_count", label: "Contas Pendentes", category: "bills" },
] as const;

export type EmailVariable = (typeof EMAIL_VARIABLES)[number];

// ============================================
// Default Templates
// ============================================

export const DEFAULT_BILLS_DIGEST_TEMPLATE: EmailTemplate = {
   blocks: [
      { type: "heading", level: 1, text: "Resumo de Contas", align: "center" },
      { type: "spacer", height: 16 },
      { type: "text", content: "Olá {{user.name}},", align: "left" },
      {
         type: "text",
         content:
            "Aqui está o resumo das suas contas para o período {{date.period}}:",
         align: "left",
      },
      { type: "spacer", height: 16 },
      { type: "table", dataSource: "bills_data" },
      { type: "spacer", height: 24 },
      { type: "text", content: "Total: {{bills.total}}", align: "right" },
      { type: "spacer", height: 24 },
      {
         type: "button",
         text: "Ver Todas as Contas",
         url: "{{app.url}}/bills",
         align: "center",
         variant: "primary",
      },
      { type: "spacer", height: 16 },
      { type: "divider" },
      { type: "spacer", height: 8 },
      {
         type: "text",
         content: "Enviado automaticamente por {{organization.name}}",
         align: "center",
      },
   ],
   styles: {
      primaryColor: "#3b82f6",
      backgroundColor: "#f4f4f5",
      textColor: "#18181b",
      fontFamily: "sans-serif",
   },
};
