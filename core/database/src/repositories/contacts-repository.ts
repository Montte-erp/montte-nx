import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { and, count, eq } from "drizzle-orm";
import { db } from "@core/database/client";
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

export async function createContact(teamId: string, data: CreateContactInput) {
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

export async function getContact(id: string) {
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

export async function updateContact(id: string, data: UpdateContactInput) {
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

export async function archiveContact(id: string) {
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

export async function reactivateContact(id: string) {
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

export async function deleteContact(id: string) {
   try {
      const hasLinks = await contactHasLinks(id);
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

export async function ensureContactOwnership(id: string, teamId: string) {
   const contact = await getContact(id);
   if (!contact || contact.teamId !== teamId) {
      throw AppError.notFound("Contato não encontrado.");
   }
   return contact;
}

export async function contactHasLinks(id: string): Promise<boolean> {
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
