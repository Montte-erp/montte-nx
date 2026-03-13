import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateInsightInput,
   type UpdateInsightInput,
} from "../schemas/insights";
export declare function createInsight(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   createdBy: string,
   data: CreateInsightInput,
): Promise<{
   cachedResults: Record<string, unknown> | null;
   config: Record<string, unknown>;
   createdAt: Date;
   createdBy: string;
   defaultSize: string;
   description: string | null;
   id: string;
   lastComputedAt: Date | null;
   name: string;
   organizationId: string;
   teamId: string;
   type: string;
   updatedAt: Date;
}>;
export declare function listInsights(
   db: DatabaseInstance,
   organizationId: string,
   type?: string,
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      createdBy: string;
      name: string;
      description: string | null;
      type: string;
      config: Record<string, unknown>;
      defaultSize: string;
      cachedResults: Record<string, unknown> | null;
      lastComputedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function listInsightsByTeam(
   db: DatabaseInstance,
   teamId: string,
   type?: string,
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      createdBy: string;
      name: string;
      description: string | null;
      type: string;
      config: Record<string, unknown>;
      defaultSize: string;
      cachedResults: Record<string, unknown> | null;
      lastComputedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function getInsightById(
   db: DatabaseInstance,
   insightId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   type: string;
   config: Record<string, unknown>;
   defaultSize: string;
   cachedResults: Record<string, unknown> | null;
   lastComputedAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function getInsightsByIds(
   db: DatabaseInstance,
   insightIds: string[],
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      createdBy: string;
      name: string;
      description: string | null;
      type: string;
      config: Record<string, unknown>;
      defaultSize: string;
      cachedResults: Record<string, unknown> | null;
      lastComputedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function updateInsight(
   db: DatabaseInstance,
   insightId: string,
   data: UpdateInsightInput,
): Promise<
   | {
        id: string;
        organizationId: string;
        teamId: string;
        createdBy: string;
        name: string;
        description: string | null;
        type: string;
        config: Record<string, unknown>;
        defaultSize: string;
        cachedResults: Record<string, unknown> | null;
        lastComputedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
     }
   | undefined
>;
export declare function ensureInsightOwnership(
   db: DatabaseInstance,
   insightId: string,
   organizationId: string,
   teamId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   createdBy: string;
   name: string;
   description: string | null;
   type: string;
   config: Record<string, unknown>;
   defaultSize: string;
   cachedResults: Record<string, unknown> | null;
   lastComputedAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteInsight(
   db: DatabaseInstance,
   insightId: string,
): Promise<void>;
//# sourceMappingURL=insight-repository.d.ts.map
