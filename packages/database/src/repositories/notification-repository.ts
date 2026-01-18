import { AppError, propagateError } from "@packages/utils/errors";
import { and, eq, gte } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { notification } from "../schemas/notifications";

export type Notification = typeof notification.$inferSelect;
export type NewNotification = typeof notification.$inferInsert;

export async function createNotification(
   dbClient: DatabaseInstance,
   data: NewNotification,
) {
   try {
      const result = await dbClient
         .insert(notification)
         .values(data)
         .returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create notification: ${(err as Error).message}`,
      );
   }
}

export async function findNotificationsByUserId(
   dbClient: DatabaseInstance,
   userId: string,
) {
   try {
      const result = await dbClient.query.notification.findMany({
         orderBy: (notification, { desc }) => desc(notification.createdAt),
         where: (notification, { eq }) => eq(notification.userId, userId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find notifications: ${(err as Error).message}`,
      );
   }
}

export async function findUnreadNotificationsByUserId(
   dbClient: DatabaseInstance,
   userId: string,
) {
   try {
      const result = await dbClient.query.notification.findMany({
         orderBy: (notification, { desc }) => desc(notification.createdAt),
         where: (notification, { eq, and }) =>
            and(
               eq(notification.userId, userId),
               eq(notification.isRead, false),
            ),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find unread notifications: ${(err as Error).message}`,
      );
   }
}

export async function markNotificationAsRead(
   dbClient: DatabaseInstance,
   notificationId: string,
) {
   try {
      const result = await dbClient
         .update(notification)
         .set({ isRead: true })
         .where(eq(notification.id, notificationId))
         .returning();

      if (!result.length) {
         throw AppError.database("Notification not found");
      }
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to mark notification as read: ${(err as Error).message}`,
      );
   }
}

export async function deleteNotification(
   dbClient: DatabaseInstance,
   notificationId: string,
) {
   try {
      const result = await dbClient
         .delete(notification)
         .where(eq(notification.id, notificationId))
         .returning();

      if (!result.length) {
         throw AppError.database("Notification not found");
      }
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete notification: ${(err as Error).message}`,
      );
   }
}

export async function findRecentNotificationByType(
   dbClient: DatabaseInstance,
   userId: string,
   type: string,
   withinMs: number,
): Promise<Notification | undefined> {
   try {
      const cutoff = new Date(Date.now() - withinMs);
      const result = await dbClient
         .select()
         .from(notification)
         .where(
            and(
               eq(notification.userId, userId),
               eq(notification.type, type),
               gte(notification.createdAt, cutoff),
            ),
         )
         .limit(1);
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find recent notification: ${(err as Error).message}`,
      );
   }
}
