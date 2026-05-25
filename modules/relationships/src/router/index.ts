import dayjs from "dayjs";
import {
   and,
   count,
   asc,
   eq,
   ilike,
   isNotNull,
   isNull,
   ne,
   or,
   sql,
} from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import {
   createPartySchema,
   partyRoleValues,
   parties,
   updatePartySchema,
} from "@core/database/schemas/relationships";
import { cnpjDataSchema } from "@core/authentication/server";
import { protectedProcedure } from "@core/orpc/server";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

type PartyRole = (typeof partyRoleValues)[number];

type DbClient = ORPCContextWithOrganization["db"];

const relationshipRoleSchema = z.enum(partyRoleValues);

const relationshipsRouterErrors = defineErrorCatalog("relationships.router", {
   BAD_REQUEST: {
      status: 400,
      message: "Requisição inválida em relacionamentos.",
      tags: ["relationships"],
   },
   CONFLICT: {
      status: 409,
      message: "Conflito ao gerenciar relacionamento.",
      tags: ["relationships"],
   },
   FORBIDDEN: {
      status: 403,
      message: "Ação não permitida em relacionamentos.",
      tags: ["relationships"],
   },
   INTERNAL: {
      status: 500,
      message: "Falha interna em relacionamentos.",
      tags: ["relationships"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Relacionamento não encontrado.",
      tags: ["relationships"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "relationships.router": typeof relationshipsRouterErrors;
   }
}

type RelationshipsRouterCatalogError =
   | ReturnType<typeof relationshipsRouterErrors.BAD_REQUEST>
   | ReturnType<typeof relationshipsRouterErrors.CONFLICT>
   | ReturnType<typeof relationshipsRouterErrors.FORBIDDEN>
   | ReturnType<typeof relationshipsRouterErrors.INTERNAL>
   | ReturnType<typeof relationshipsRouterErrors.NOT_FOUND>;

class RelationshipsRouterError extends TaggedError("RelationshipsRouterError")<{
   error: RelationshipsRouterCatalogError;
   message: string;
}>() {}

const ensureRow = <T>(row: T | undefined, message: string) =>
   row
      ? Result.ok(row)
      : Result.err(
           new RelationshipsRouterError({
              error: relationshipsRouterErrors.NOT_FOUND(),
              message,
           }),
        );

const listInput = z.object({
   role: relationshipRoleSchema,
   q: z.string().trim().max(160).optional(),
   archived: z.boolean().default(false),
   limit: z.number().int().min(1).max(1000).default(50),
   offset: z.number().int().min(0).default(0),
});

const idInput = z.object({
   id: z.string().uuid(),
});

const createInput = createPartySchema;
const updateInput = idInput.merge(updatePartySchema);

const cnpjLookupInput = z.object({
   cnpj: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value.length === 14, {
         message: "CNPJ deve conter 14 dígitos.",
      }),
});

function roleFriendly(role: PartyRole) {
   if (role === "customer") return "cliente";
   return "fornecedor";
}

function formatDuplicateMessage(role: PartyRole) {
   return `Já existe um ${roleFriendly(role)} com esse documento para este time.`;
}

async function getOwnedRelationship(db: DbClient, teamId: string, id: string) {
   return Result.tryPromise({
      try: () =>
         db.query.parties.findFirst({
            where: (f, { and, eq }) => and(eq(f.id, id), eq(f.teamId, teamId)),
         }),
      catch: () =>
         new RelationshipsRouterError({
            error: relationshipsRouterErrors.INTERNAL(),
            message: "Falha ao localizar relacionamento.",
         }),
   });
}

async function findDuplicateByDocument(
   db: DbClient,
   teamId: string,
   role: PartyRole,
   documentNumber: string,
   excludeId?: string,
) {
   return Result.tryPromise({
      try: () =>
         db.query.parties.findFirst({
            where: (f, { and, eq }) => {
               if (excludeId) {
                  return and(
                     eq(f.teamId, teamId),
                     eq(f.role, role),
                     eq(f.documentNumber, documentNumber),
                     ne(f.id, excludeId),
                  );
               }

               return and(
                  eq(f.teamId, teamId),
                  eq(f.role, role),
                  eq(f.documentNumber, documentNumber),
               );
            },
            columns: { id: true },
         }),
      catch: () =>
         new RelationshipsRouterError({
            error: relationshipsRouterErrors.INTERNAL(),
            message: "Falha ao verificar documento duplicado.",
         }),
   });
}

async function hasFinancialLink(
   db: DbClient,
   teamId: string,
   relationshipId: string,
) {
   return Result.tryPromise({
      try: () =>
         db.query.transactions.findFirst({
            where: (f, { and, eq }) =>
               and(eq(f.teamId, teamId), eq(f.relationshipId, relationshipId)),
            columns: { id: true },
         }),
      catch: () =>
         new RelationshipsRouterError({
            error: relationshipsRouterErrors.INTERNAL(),
            message: "Falha ao verificar vínculo financeiro.",
         }),
   });
}

const fetchBrasilApi = (cnpj: string) =>
   Result.tryPromise({
      try: () =>
         fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Montte-ERP/1.0" },
         }),
      catch: () =>
         new RelationshipsRouterError({
            error: relationshipsRouterErrors.INTERNAL(),
            message: "Não foi possível consultar o CNPJ. Tente novamente.",
         }),
   });

const readBrasilApiResponse = (response: Response) =>
   Result.tryPromise({
      try: () => response.json(),
      catch: () =>
         new RelationshipsRouterError({
            error: relationshipsRouterErrors.INTERNAL(),
            message: "Não foi possível consultar o CNPJ. Tente novamente.",
         }),
   });

export const list = protectedProcedure
   .input(listInput)
   .handler(async ({ context, input }) => {
      const search = input.q?.trim();
      const result = await Result.tryPromise({
         try: async () => {
            const whereBase = and(
               eq(parties.teamId, context.teamId),
               eq(parties.role, input.role),
               input.archived
                  ? isNotNull(parties.archivedAt)
                  : isNull(parties.archivedAt),
            );

            const where = search
               ? and(
                    whereBase,
                    or(
                       ilike(parties.name, `%${search}%`),
                       sql`${parties.documentNumber} ilike ${`%${search}%`}`,
                    ),
                 )
               : whereBase;

            const [data, countRows] = await Promise.all([
               context.db
                  .select()
                  .from(parties)
                  .where(where)
                  .orderBy(asc(parties.name))
                  .limit(input.limit)
                  .offset(input.offset),
               context.db.select({ total: count() }).from(parties).where(where),
            ]);

            return {
               data,
               total: countRows[0]?.total ?? 0,
               limit: input.limit,
               offset: input.offset,
            };
         },
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Falha ao listar relacionamentos.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const create = protectedProcedure
   .input(createInput)
   .handler(async ({ context, input }) => {
      if (input.documentNumber) {
         const duplicate = await findDuplicateByDocument(
            context.db,
            context.teamId,
            input.role,
            input.documentNumber,
         );
         if (Result.isError(duplicate)) throw duplicate.error;
         if (duplicate.value) {
            throw new RelationshipsRouterError({
               error: relationshipsRouterErrors.CONFLICT(),
               message: formatDuplicateMessage(input.role),
            });
         }
      }

      const created = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(parties)
                  .values({ ...input, teamId: context.teamId })
                  .returning();
               return row;
            }),
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Falha ao criar relacionamento.",
            }),
      });
      if (Result.isError(created)) throw created.error;
      const result = ensureRow(
         created.value,
         "Falha ao criar relacionamento: insert vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(updateInput)
   .handler(async ({ context, input }) => {
      const { id, ...payload } = input;
      const relationshipResult = await getOwnedRelationship(
         context.db,
         context.teamId,
         id,
      );
      if (Result.isError(relationshipResult)) throw relationshipResult.error;
      const relationship = relationshipResult.value;
      if (!relationship) {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.NOT_FOUND(),
            message: "Relacionamento não encontrado.",
         });
      }

      if (relationship.archivedAt) {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.FORBIDDEN(),
            message: "Relacionamento arquivado não pode ser atualizado.",
         });
      }

      const nextRole = payload.role ?? relationship.role;
      const nextDocument =
         payload.documentNumber === undefined
            ? relationship.documentNumber
            : payload.documentNumber;

      if (nextDocument) {
         const duplicate = await findDuplicateByDocument(
            context.db,
            context.teamId,
            nextRole,
            nextDocument,
            id,
         );
         if (Result.isError(duplicate)) throw duplicate.error;
         if (duplicate.value) {
            throw new RelationshipsRouterError({
               error: relationshipsRouterErrors.CONFLICT(),
               message: formatDuplicateMessage(nextRole),
            });
         }
      }

      const updated = await Result.tryPromise({
         try: async () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(parties)
                  .set({
                     ...payload,
                     role: nextRole,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(eq(parties.id, relationship.id))
                  .returning();
               return row;
            }),
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Falha ao atualizar relacionamento.",
            }),
      });
      if (Result.isError(updated)) throw updated.error;
      const result = ensureRow(
         updated.value,
         "Falha ao atualizar relacionamento: update vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

const deleteRelationship = protectedProcedure
   .input(idInput)
   .handler(async ({ context, input }) => {
      const relationshipResult = await getOwnedRelationship(
         context.db,
         context.teamId,
         input.id,
      );
      if (Result.isError(relationshipResult)) throw relationshipResult.error;
      const relationship = relationshipResult.value;
      if (!relationship) {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.NOT_FOUND(),
            message: "Relacionamento não encontrado.",
         });
      }

      const financialResult = await hasFinancialLink(
         context.db,
         context.teamId,
         relationship.id,
      );
      if (Result.isError(financialResult)) throw financialResult.error;
      if (financialResult.value) {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.CONFLICT(),
            message:
               "Relacionamento com vínculo financeiro não pode ser excluído. Use o arquivamento para ocultá-lo.",
         });
      }

      const deleted = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .delete(parties)
                  .where(eq(parties.id, relationship.id))
                  .returning({ id: parties.id });
               return row;
            }),
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Falha ao excluir relacionamento.",
            }),
      });
      if (Result.isError(deleted)) throw deleted.error;
      const result = ensureRow(deleted.value, "Relacionamento não encontrado.");
      if (Result.isError(result)) throw result.error;
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idInput)
   .handler(async ({ context, input }) => {
      const relationshipResult = await getOwnedRelationship(
         context.db,
         context.teamId,
         input.id,
      );
      if (Result.isError(relationshipResult)) throw relationshipResult.error;
      const relationship = relationshipResult.value;
      if (!relationship) {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.NOT_FOUND(),
            message: "Relacionamento não encontrado.",
         });
      }

      const archived = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(parties)
                  .set({ archivedAt: dayjs().toDate() })
                  .where(eq(parties.id, relationship.id))
                  .returning();
               return row;
            }),
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Falha ao arquivar relacionamento.",
            }),
      });
      if (Result.isError(archived)) throw archived.error;
      const result = ensureRow(
         archived.value,
         "Falha ao arquivar relacionamento: update vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const restore = protectedProcedure
   .input(idInput)
   .handler(async ({ context, input }) => {
      const relationshipResult = await getOwnedRelationship(
         context.db,
         context.teamId,
         input.id,
      );
      if (Result.isError(relationshipResult)) throw relationshipResult.error;
      const relationship = relationshipResult.value;
      if (!relationship) {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.NOT_FOUND(),
            message: "Relacionamento não encontrado.",
         });
      }

      const restored = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(parties)
                  .set({ archivedAt: null })
                  .where(eq(parties.id, relationship.id))
                  .returning();
               return row;
            }),
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Falha ao restaurar relacionamento.",
            }),
      });
      if (Result.isError(restored)) throw restored.error;
      const result = ensureRow(
         restored.value,
         "Falha ao restaurar relacionamento: update vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const cnpjLookup = protectedProcedure
   .input(cnpjLookupInput)
   .handler(async ({ input }) => {
      const responseResult = await fetchBrasilApi(input.cnpj);
      if (Result.isError(responseResult)) throw responseResult.error;
      if (!responseResult.value.ok) {
         if (responseResult.value.status === 404) {
            throw new RelationshipsRouterError({
               error: relationshipsRouterErrors.NOT_FOUND(),
               message: "CNPJ não encontrado ou inválido.",
            });
         }

         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.INTERNAL(),
            message: "Não foi possível consultar o CNPJ. Tente novamente.",
         });
      }

      const payloadResult = await readBrasilApiResponse(responseResult.value);
      if (Result.isError(payloadResult)) throw payloadResult.error;

      const parsedResult = await Result.try({
         try: () => cnpjDataSchema.parse(payloadResult.value),
         catch: () =>
            new RelationshipsRouterError({
               error: relationshipsRouterErrors.INTERNAL(),
               message: "Não foi possível consultar o CNPJ. Tente novamente.",
            }),
      });
      if (parsedResult.isErr()) throw parsedResult.error;

      if (parsedResult.value.descricao_situacao_cadastral !== "ATIVA") {
         throw new RelationshipsRouterError({
            error: relationshipsRouterErrors.BAD_REQUEST(),
            message: "Este CNPJ não está ativo na Receita Federal.",
         });
      }

      return parsedResult.value;
   });

export { deleteRelationship as delete };
