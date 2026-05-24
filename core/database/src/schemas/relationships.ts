import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
   index,
   pgSchema,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const relationships = pgSchema("relationships");

export const partyRoleEnum = relationships.enum("party_role", [
   "customer",
   "supplier",
]);

export const partyKindEnum = relationships.enum("party_kind", [
   "person",
   "company",
]);

export const parties = relationships.table(
   "parties",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      role: partyRoleEnum("role").notNull(),
      kind: partyKindEnum("kind").notNull(),
      name: text("name").notNull(),
      documentNumber: text("document_number"),
      email: text("email"),
      phone: text("phone"),
      archivedAt: timestamp("archived_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("parties_team_id_idx").on(table.teamId),
      index("parties_role_idx").on(table.role),
      index("parties_archived_at_idx").on(table.archivedAt),
      uniqueIndex("parties_team_id_role_document_number_uq")
         .on(table.teamId, table.role, table.documentNumber)
         .where(sql`${table.documentNumber} IS NOT NULL`),
   ],
);

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;

export const partyRoleValues: readonly ["customer", "supplier"] = [
   "customer",
   "supplier",
];
export const partyKindValues: readonly ["person", "company"] = [
   "person",
   "company",
];

const CPF_REGEX = /^\d{11}$/;
const CNPJ_REGEX = /^[A-Z0-9]{12}\d{2}$/;
const PHONE_DIGITS = /^\d{10,11}$/;
const ALPHANUMERIC_WITHOUT_MASK = /[^A-Z0-9]/g;
const ONLY_DIGITS = /\D/g;

const CPF_WEIGHT_FIRST_DIGIT = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const CPF_WEIGHT_SECOND_DIGIT = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_FIRST_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_SECOND_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export const normalizeDocument = (value: string | null | undefined) => {
   if (value == null) {
      return null;
   }

   const normalized = value
      .toUpperCase()
      .replace(ALPHANUMERIC_WITHOUT_MASK, "");

   if (normalized.length === 0) {
      return null;
   }

   return normalized;
};

const normalizeDocumentInput = (value: unknown): unknown => {
   if (value === null || value === undefined) {
      return null;
   }

   if (typeof value !== "string") {
      return value;
   }

   return normalizeDocument(value);
};

function normalizeNullableText(value: unknown): unknown {
   if (value == null) {
      return null;
   }

   if (typeof value !== "string") {
      return value;
   }

   const trimmed = value.trim();

   if (trimmed.length === 0) {
      return null;
   }

   return trimmed;
}

export const normalizePhone = (value: string | null | undefined) => {
   if (value == null) {
      return null;
   }

   const digits = value.replace(ONLY_DIGITS, "");

   if (digits.length === 0) {
      return null;
   }

   return digits;
};

const normalizePhoneInput = (value: unknown): unknown => {
   if (value === null || value === undefined) {
      return null;
   }

   if (typeof value !== "string") {
      return value;
   }

   return normalizePhone(value);
};

function cpfDigit(values: string, weights: readonly number[]): number {
   const total = values
      .split("")
      .reduce(
         (acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0),
         0,
      );

   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

function cnpjCharValue(char: string): number {
   const code = char.charCodeAt(0);
   return code - 48;
}

function cnpjDigit(values: string, weights: readonly number[]): number {
   const total = values
      .split("")
      .reduce(
         (acc, char, index) =>
            acc + cnpjCharValue(char) * (weights[index] ?? 0),
         0,
      );

   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value: string): boolean {
   const normalized = normalizeDocument(value);

   if (normalized === null) {
      return false;
   }

   if (normalized.length !== 11) {
      return false;
   }

   if (!CPF_REGEX.test(normalized)) {
      return false;
   }

   const firstCharacter = normalized[0];

   if (firstCharacter === undefined) {
      return false;
   }

   const allSame = normalized
      .split("")
      .every((digit) => digit === firstCharacter);
   if (allSame) {
      return false;
   }

   const body = normalized.slice(0, 9);
   const firstCheckDigit = cpfDigit(body, CPF_WEIGHT_FIRST_DIGIT);
   const secondCheckDigit = cpfDigit(
      `${body}${firstCheckDigit}`,
      CPF_WEIGHT_SECOND_DIGIT,
   );

   return `${firstCheckDigit}${secondCheckDigit}` === normalized.slice(9);
}

export function isValidCnpj(value: string): boolean {
   const normalized = normalizeDocument(value);

   if (normalized === null) {
      return false;
   }

   if (!CNPJ_REGEX.test(normalized)) {
      return false;
   }

   const firstCharacter = normalized[0];
   if (firstCharacter === undefined) {
      return false;
   }

   const allSame = normalized
      .split("")
      .every((digit) => digit === firstCharacter);
   if (allSame) {
      return false;
   }

   const body = normalized.slice(0, 12);
   const firstCheckDigit = cnpjDigit(body, CNPJ_FIRST_DIGIT_WEIGHTS);
   const secondCheckDigit = cnpjDigit(
      `${body}${firstCheckDigit}`,
      CNPJ_SECOND_DIGIT_WEIGHTS,
   );

   return `${firstCheckDigit}${secondCheckDigit}` === normalized.slice(12);
}

const nameSchema = z
   .string()
   .trim()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(160, "Nome deve ter no máximo 160 caracteres.");

const documentBaseSchema = z.preprocess(
   normalizeDocumentInput,
   z.string().nullable().optional(),
);

const emailSchema = z.preprocess(
   normalizeNullableText,
   z.string().email("E-mail inválido.").nullable().optional(),
);

const phoneSchema = z.preprocess(
   normalizePhoneInput,
   z
      .string()
      .nullable()
      .optional()
      .superRefine((value, ctx) => {
         if (value === null || value === undefined) {
            return;
         }

         if (!PHONE_DIGITS.test(value)) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               message: "Telefone deve ter 10 ou 11 dígitos.",
            });
         }
      }),
);

const personDocumentSchema = documentBaseSchema.superRefine((value, ctx) => {
   if (value === null || value === undefined) {
      return;
   }

   if (!isValidCpf(value)) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: "CPF inválido.",
      });
   }
});

const companyDocumentSchema = documentBaseSchema.superRefine((value, ctx) => {
   if (value === null || value === undefined) {
      return;
   }

   if (!isValidCnpj(value)) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         message: "CNPJ inválido.",
      });
   }
});

const basePartySchema = createInsertSchema(parties).pick({
   name: true,
   role: true,
   kind: true,
   documentNumber: true,
   email: true,
   phone: true,
});

export const createPartyPersonSchema = basePartySchema.extend({
   name: nameSchema,
   role: z.enum(partyRoleValues),
   kind: z.literal("person"),
   documentNumber: personDocumentSchema,
   email: emailSchema,
   phone: phoneSchema,
});

export const createPartyCompanySchema = basePartySchema.extend({
   name: nameSchema,
   role: z.enum(partyRoleValues),
   kind: z.literal("company"),
   documentNumber: companyDocumentSchema,
   email: emailSchema,
   phone: phoneSchema,
});

export const createPartySchema = z.discriminatedUnion("kind", [
   createPartyPersonSchema,
   createPartyCompanySchema,
]);

export const updatePartySchema = basePartySchema
   .extend({
      name: nameSchema.optional(),
      role: z.enum(partyRoleValues).optional(),
      kind: z.enum(partyKindValues).optional(),
      documentNumber: documentBaseSchema,
      email: emailSchema,
      phone: phoneSchema,
   })
   .partial()
   .superRefine((data, ctx) => {
      if (data.kind !== undefined) {
         if (data.documentNumber === undefined) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["documentNumber"],
               message:
                  "Documento é obrigatório ao alterar o tipo de relacionamento.",
            });
            return;
         }

         if (data.documentNumber === null) {
            return;
         }

         if (data.kind === "person") {
            if (!isValidCpf(data.documentNumber)) {
               ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ["documentNumber"],
                  message: "CPF inválido.",
               });
            }

            return;
         }

         if (!isValidCnpj(data.documentNumber)) {
            ctx.addIssue({
               code: z.ZodIssueCode.custom,
               path: ["documentNumber"],
               message: "CNPJ inválido.",
            });
         }

         return;
      }

      if (data.documentNumber !== undefined && data.documentNumber !== null) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["kind"],
            message:
               "Informe o tipo de relacionamento para validar o documento.",
         });
      }
   });

export type CreatePartyInput = z.infer<typeof createPartySchema>;
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
