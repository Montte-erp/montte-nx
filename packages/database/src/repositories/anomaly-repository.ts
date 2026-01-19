import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import { anomaly, type NewAnomaly } from "../schemas/anomalies";

export type { Anomaly, NewAnomaly } from "../schemas/anomalies";

export async function createAnomaly(
   dbClient: DatabaseInstance,
   data: NewAnomaly,
) {
   try {
      const result = await dbClient.insert(anomaly).values(data).returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create anomaly: ${(err as Error).message}`,
         {
            cause: err,
         },
      );
   }
}

export async function createAnomalies(
   dbClient: DatabaseInstance,
   data: NewAnomaly[],
) {
   if (data.length === 0) return [];
   try {
      const result = await dbClient.insert(anomaly).values(data).returning();
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create anomalies: ${(err as Error).message}`,
         {
            cause: err,
         },
      );
   }
}

export async function findAnomalyById(
   dbClient: DatabaseInstance,
   anomalyId: string,
) {
   try {
      const result = await dbClient.query.anomaly.findFirst({
         where: (anomaly, { eq }) => eq(anomaly.id, anomalyId),
         with: {
            transaction: true,
         },
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find anomaly by id: ${(err as Error).message}`,
      );
   }
}

export async function findAnomaliesByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
   options?: {
      includeAcknowledged?: boolean;
      limit?: number;
      offset?: number;
   },
) {
   const {
      includeAcknowledged = false,
      limit = 50,
      offset = 0,
   } = options ?? {};
   try {
      const now = new Date();
      const conditions = [
         eq(anomaly.organizationId, organizationId),
         or(isNull(anomaly.expiresAt), gt(anomaly.expiresAt, now)),
      ];

      if (!includeAcknowledged) {
         conditions.push(eq(anomaly.isAcknowledged, false));
      }

      const result = await dbClient.query.anomaly.findMany({
         where: and(...conditions),
         with: {
            transaction: true,
         },
         orderBy: [desc(anomaly.detectedAt)],
         limit,
         offset,
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find anomalies: ${(err as Error).message}`,
      );
   }
}

export async function acknowledgeAnomaly(
   dbClient: DatabaseInstance,
   anomalyId: string,
   acknowledgedBy: string,
) {
   try {
      const result = await dbClient
         .update(anomaly)
         .set({
            isAcknowledged: true,
            acknowledgedAt: new Date(),
            acknowledgedBy,
         })
         .where(eq(anomaly.id, anomalyId))
         .returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to acknowledge anomaly: ${(err as Error).message}`,
      );
   }
}

export async function countUnacknowledgedAnomalies(
   dbClient: DatabaseInstance,
   organizationId: string,
) {
   try {
      const now = new Date();
      const result = await dbClient.query.anomaly.findMany({
         where: and(
            eq(anomaly.organizationId, organizationId),
            eq(anomaly.isAcknowledged, false),
            or(isNull(anomaly.expiresAt), gt(anomaly.expiresAt, now)),
         ),
         columns: { id: true },
      });
      return result.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to count anomalies: ${(err as Error).message}`,
      );
   }
}

export async function deleteExpiredAnomalies(dbClient: DatabaseInstance) {
   try {
      const now = new Date();
      const result = await dbClient
         .delete(anomaly)
         .where(
            and(eq(anomaly.isAcknowledged, true), lt(anomaly.expiresAt, now)),
         )
         .returning({ id: anomaly.id });
      return result.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete expired anomalies: ${(err as Error).message}`,
      );
   }
}
