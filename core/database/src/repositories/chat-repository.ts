import { desc, eq, sql } from "drizzle-orm";
import { AppError, propagateError } from "@core/logging/errors";
import type { DatabaseInstance } from "@core/database/client";
import { chatMessages, chatThreads } from "@core/database/schemas/chat";
import type { ChatThread } from "@core/database/schemas/chat";

export type StoredMessage = {
   id: string;
   role: string;
   parts: unknown;
   createdAt: Date;
};

export async function listThreads(
   db: DatabaseInstance,
   resourceId: string,
   page: number,
   perPage: number,
): Promise<{ threads: ChatThread[]; total: number; hasMore: boolean }> {
   try {
      const [rows, countResult] = await Promise.all([
         db
            .select()
            .from(chatThreads)
            .where(eq(chatThreads.resourceId, resourceId))
            .orderBy(desc(chatThreads.updatedAt))
            .limit(perPage)
            .offset(page * perPage),
         db
            .select({ count: sql<string>`count(*)` })
            .from(chatThreads)
            .where(eq(chatThreads.resourceId, resourceId)),
      ]);
      const total = Number(countResult[0]?.count ?? 0);
      return {
         threads: rows,
         total,
         hasMore: page * perPage + rows.length < total,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list threads");
   }
}

export async function createThread(
   db: DatabaseInstance,
   resourceId: string,
   title?: string,
   metadata?: Record<string, unknown>,
): Promise<ChatThread> {
   try {
      const [row] = await db
         .insert(chatThreads)
         .values({ resourceId, title, metadata })
         .returning();
      if (!row) throw AppError.database("Failed to create thread");
      return row;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create thread");
   }
}

export async function getThreadById(
   db: DatabaseInstance,
   threadId: string,
): Promise<ChatThread | null> {
   try {
      const [row] = await db
         .select()
         .from(chatThreads)
         .where(eq(chatThreads.id, threadId))
         .limit(1);
      return row ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get thread");
   }
}

export async function deleteThread(
   db: DatabaseInstance,
   threadId: string,
): Promise<void> {
   try {
      await db.delete(chatThreads).where(eq(chatThreads.id, threadId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete thread");
   }
}

export async function updateThreadTitle(
   db: DatabaseInstance,
   threadId: string,
   title: string,
): Promise<void> {
   try {
      await db
         .update(chatThreads)
         .set({ title, updatedAt: new Date() })
         .where(eq(chatThreads.id, threadId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update thread title");
   }
}

export async function getThreadMessages(
   db: DatabaseInstance,
   threadId: string,
): Promise<StoredMessage[]> {
   try {
      const rows = await db
         .select()
         .from(chatMessages)
         .where(eq(chatMessages.threadId, threadId))
         .orderBy(chatMessages.createdAt);
      return rows.map((r) => ({
         id: r.id,
         role: r.role,
         parts: r.parts,
         createdAt: r.createdAt,
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get messages");
   }
}

export async function appendMessages(
   db: DatabaseInstance,
   threadId: string,
   messages: Array<{ id: string; role: string; parts: unknown }>,
): Promise<void> {
   if (messages.length === 0) return;
   try {
      await db.insert(chatMessages).values(
         messages.map((m) => ({
            id: m.id,
            threadId,
            role: m.role,
            parts: m.parts,
         })),
      );
      await db
         .update(chatThreads)
         .set({ updatedAt: new Date() })
         .where(eq(chatThreads.id, threadId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to append messages");
   }
}
