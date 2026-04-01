import { AppError, propagateError } from "@core/logging/errors";
import { and, eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type Modulo,
   type TipoRotulo,
   organizacaoModulo,
   organizacaoRotuloConfig,
} from "@core/database/schemas/organization-config";

const ALL_MODULOS: Modulo[] = [
   "CONTAS",
   "CARTOES",
   "PLANEJAMENTO",
   "RELATORIOS",
   "CONTATOS",
   "ESTOQUE",
   "SERVICOS",
];

export async function seedOrganizacaoConfig(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      await db.insert(organizacaoModulo).values(
         ALL_MODULOS.map((modulo) => ({
            teamId,
            modulo,
            habilitado: true,
         })),
      );

      const tipoRotulo: TipoRotulo = "CENTRO_CUSTO";

      await db.insert(organizacaoRotuloConfig).values([
         {
            teamId,
            tipoRotulo,
            labelUi: "Centro de Custo",
            labelUiPlural: "Centros de Custo",
         },
      ]);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to seed organizacao config");
   }
}

export async function getOrganizacaoModulos(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      return await db.query.organizacaoModulo.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get organizacao modulos");
   }
}

export async function updateOrganizacaoModulo(
   db: DatabaseInstance,
   teamId: string,
   modulo: Modulo,
   habilitado: boolean,
) {
   try {
      await db
         .update(organizacaoModulo)
         .set({ habilitado })
         .where(
            and(
               eq(organizacaoModulo.teamId, teamId),
               eq(organizacaoModulo.modulo, modulo),
            ),
         );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update organizacao modulo");
   }
}

export async function getOrganizacaoRotuloConfig(
   db: DatabaseInstance,
   teamId: string,
) {
   try {
      return await db.query.organizacaoRotuloConfig.findMany({
         where: (fields, { eq }) => eq(fields.teamId, teamId),
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get organizacao rotulo config");
   }
}
