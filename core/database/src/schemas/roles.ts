import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   jsonb,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { member, organization } from "./auth";

export const customRoles = pgTable(
   "custom_roles",
   {
      id: uuid("id").defaultRandom().primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      permissions: jsonb("permissions")
         .$type<string[]>()
         .notNull()
         .default(sql`'[]'::jsonb`),
      isDefault: boolean("is_default").default(false).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [index("custom_roles_org_idx").on(table.organizationId)],
);

export const memberRoles = pgTable(
   "member_roles",
   {
      id: uuid("id").defaultRandom().primaryKey(),
      memberId: uuid("member_id")
         .notNull()
         .references(() => member.id, { onDelete: "cascade" }),
      roleId: uuid("role_id")
         .notNull()
         .references(() => customRoles.id, { onDelete: "cascade" }),
      assignedAt: timestamp("assigned_at").defaultNow().notNull(),
   },
   (table) => [
      index("member_roles_member_idx").on(table.memberId),
      index("member_roles_role_idx").on(table.roleId),
   ],
);
