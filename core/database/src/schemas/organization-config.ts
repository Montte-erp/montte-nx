import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";

export const moduloEnum = pgEnum("modulo", [
   "CONTAS",
   "CARTOES",
   "PLANEJAMENTO",
   "RELATORIOS",
   "CONTATOS",
   "ESTOQUE",
   "SERVICOS",
]);

export const tipoRotuloEnum = pgEnum("tipo_rotulo", ["TAG", "CENTRO_CUSTO"]);

export const organizacaoModulo = pgTable(
   "organizacao_modulo",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      modulo: moduloEnum("modulo").notNull(),
      habilitado: boolean("habilitado").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("organizacao_modulo_team_id_idx").on(table.teamId),
      uniqueIndex("organizacao_modulo_team_modulo_unique").on(
         table.teamId,
         table.modulo,
      ),
   ],
);

export const organizacaoRotuloConfig = pgTable(
   "organizacao_rotulo_config",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      tipoRotulo: tipoRotuloEnum("tipo_rotulo").notNull(),
      labelUi: text("label_ui").notNull(),
      labelUiPlural: text("label_ui_plural").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("organizacao_rotulo_config_team_id_idx").on(table.teamId),
      uniqueIndex("organizacao_rotulo_config_team_rotulo_unique").on(
         table.teamId,
         table.tipoRotulo,
      ),
   ],
);

export type OrganizacaoModulo = typeof organizacaoModulo.$inferSelect;
export type Modulo = (typeof moduloEnum.enumValues)[number];
export type TipoRotulo = (typeof tipoRotuloEnum.enumValues)[number];
