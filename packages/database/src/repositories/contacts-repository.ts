import { AppError, propagateError } from "@packages/utils/errors";
import { and, count, eq } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   type ContactType,
   type NewContact,
   contacts,
} from "../schema";
import { transactions } from "../schema";

export async function createContact(db: DatabaseInstance, data: NewContact) {
   try {
      const [contact] = await db.insert(contacts).values(data).returning();
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
) {
   try {
      const conditions = [eq(contacts.teamId, teamId)];
      if (type) conditions.push(eq(contacts.type, type));
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
   data: Partial<NewContact>,
) {
   try {
      const [updated] = await db
         .update(contacts)
         .set(data)
         .where(eq(contacts.id, id))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update contact");
   }
}

export async function deleteContact(db: DatabaseInstance, id: string) {
   try {
      await db.delete(contacts).where(eq(contacts.id, id));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete contact");
   }
}

export async function contactHasTransactions(
   db: DatabaseInstance,
   id: string,
): Promise<boolean> {
   try {
      const [result] = await db
         .select({ total: count() })
         .from(transactions)
         .where(eq(transactions.contactId, id));
      return (result?.total ?? 0) > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to check contact transactions");
   }
}
