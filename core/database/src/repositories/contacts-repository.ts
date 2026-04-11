import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, asc, count, eq } from "drizzle-orm";
import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateContactInput,
   type UpdateContactInput,
   type ContactType,
   contacts,
   createContactSchema,
   updateContactSchema,
} from "@core/database/schemas/contacts";
import { transactions } from "@core/database/schemas/transactions";
import { bills } from "@core/database/schemas/bills";

export async function createContact(
   db: DatabaseInstance,
   teamId: string,
   data: CreateContactInput,
) {
   const validated = validateInput(createContactSchema, data);
   try {
      const [contact] = await db
         .insert(contacts)
         .values({ ...validated, teamId })
         .returning();
      if (!contact) throw AppError.database("Failed to create contact");
      return contact;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create contact");
   }
}

export async function listContacts(
   db: DatabaseInstance,
   teamId: string,
   type?: ContactType,
   includeArchived = false,
) {
   try {
      const conditions = [eq(contacts.teamId, teamId)];
      if (type) conditions.push(eq(contacts.type, type));
      if (!includeArchived) conditions.push(eq(contacts.isArchived, false));
      return await db
         .select()
         .from(contacts)
         .where(and(...conditions))
         .orderBy(contacts.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list contacts");
   }
}

export async function getContact(db: DatabaseInstance, id: string) {
   try {
      const [contact] = await db
         .select()
         .from(contacts)
         .where(eq(contacts.id, id));
      return contact ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get contact");
   }
}

export async function updateContact(
   db: DatabaseInstance,
   id: string,
   data: UpdateContactInput,
) {
   const validated = validateInput(updateContactSchema, data);
   try {
      const [updated] = await db
         .update(contacts)
         .set({ ...validated, updatedAt: new Date() })
         .where(eq(contacts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Contato não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update contact");
   }
}

export async function archiveContact(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(contacts)
         .set({ isArchived: true, updatedAt: new Date() })
         .where(eq(contacts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Contato não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to archive contact");
   }
}

export async function reactivateContact(db: DatabaseInstance, id: string) {
   try {
      const [updated] = await db
         .update(contacts)
         .set({ isArchived: false, updatedAt: new Date() })
         .where(eq(contacts.id, id))
         .returning();
      if (!updated) throw AppError.notFound("Contato não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to reactivate contact");
   }
}

export async function deleteContact(db: DatabaseInstance, id: string) {
   try {
      const hasLinks = await contactHasLinks(db, id);
      if (hasLinks) {
         throw AppError.conflict(
            "Contato possui lançamentos vinculados. Arquive em vez de excluir.",
         );
      }
      await db.delete(contacts).where(eq(contacts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete contact");
   }
}

export async function ensureContactOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   const contact = await getContact(db, id);
   if (!contact || contact.teamId !== teamId) {
      throw AppError.notFound("Contato não encontrado.");
   }
   return contact;
}

export async function getContactByExternalId(
   db: DatabaseInstance,
   externalId: string,
   teamId: string,
   type?: ContactType,
) {
   try {
      const conditions = [
         eq(contacts.externalId, externalId),
         eq(contacts.teamId, teamId),
      ];
      if (type) conditions.push(eq(contacts.type, type));
      const [contact] = await db
         .select()
         .from(contacts)
         .where(and(...conditions));
      return contact ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get contact by external id");
   }
}

export async function listContactsPaginated(
   db: DatabaseInstance,
   teamId: string,
   options: {
      page: number;
      limit: number;
      type?: ContactType;
      includeArchived?: boolean;
   },
) {
   try {
      const { page, limit, type, includeArchived = false } = options;
      const conditions = [eq(contacts.teamId, teamId)];
      if (type) conditions.push(eq(contacts.type, type));
      if (!includeArchived) conditions.push(eq(contacts.isArchived, false));
      const where = and(...conditions);
      const [totalResult] = await db
         .select({ value: count() })
         .from(contacts)
         .where(where);
      const total = totalResult?.value ?? 0;
      const items = await db
         .select()
         .from(contacts)
         .where(where)
         .orderBy(asc(contacts.name))
         .limit(limit)
         .offset((page - 1) * limit);
      return { items, total };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list contacts");
   }
}

export async function contactHasLinks(
   db: DatabaseInstance,
   id: string,
): Promise<boolean> {
   try {
      const [txResult] = await db
         .select({ total: count() })
         .from(transactions)
         .where(eq(transactions.contactId, id));

      if ((txResult?.total ?? 0) > 0) return true;

      const [billResult] = await db
         .select({ total: count() })
         .from(bills)
         .where(eq(bills.contactId, id));

      return (billResult?.total ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check contact links");
   }
}
