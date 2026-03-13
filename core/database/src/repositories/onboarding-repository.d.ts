import type { DatabaseInstance } from "@core/database/client";
export declare function insertTeamMember(
   db: DatabaseInstance,
   teamId: string,
   userId: string,
): Promise<void>;
export declare function markTeamOnboardingComplete(
   db: DatabaseInstance,
   teamId: string,
   data: {
      slug: string;
      accountType: string;
      onboardingProducts: string[];
   },
): Promise<void>;
export declare function markOrganizationOnboardingComplete(
   db: DatabaseInstance,
   organizationId: string,
): Promise<void>;
export declare function getOrganizationById(
   db: DatabaseInstance,
   organizationId: string,
): Promise<
   | {
        context: string | null;
        createdAt: Date;
        description: string | null;
        id: string;
        logo: string | null;
        metadata: string | null;
        name: string;
        onboardingCompleted: boolean | null;
        slug: string;
     }
   | undefined
>;
export declare function getOrganizationSlug(
   db: DatabaseInstance,
   organizationId: string,
): Promise<
   | {
        slug: string;
     }
   | undefined
>;
export declare function getTeamById(
   db: DatabaseInstance,
   teamId: string,
): Promise<
   | {
        accountType: string | null;
        allowedDomains: string[] | null;
        createdAt: Date;
        description: string | null;
        id: string;
        name: string;
        onboardingCompleted: boolean | null;
        onboardingProducts: unknown;
        onboardingTasks: unknown;
        organizationId: string;
        slug: string;
        updatedAt: Date | null;
     }
   | undefined
>;
export declare function getTeamNameAndSlug(
   db: DatabaseInstance,
   teamId: string,
): Promise<
   | {
        name: string;
        slug: string;
     }
   | undefined
>;
export declare function getOnboardingCounts(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
): Promise<{
   insightCount: number;
   categoryCount: number;
   transactionCount: number;
   bankAccountCount: number;
}>;
export declare function getOrgAndTeamOnboardingFlags(
   db: DatabaseInstance,
   orgId: string,
   activeTeamId: string | null | undefined,
): Promise<{
   org:
      | {
           id: string;
           onboardingCompleted: boolean | null;
           slug: string;
        }
      | undefined;
   targetTeam:
      | {
           id: string;
           onboardingCompleted: boolean | null;
           slug: string;
        }
      | undefined;
}>;
export declare function markTaskDone(
   db: DatabaseInstance,
   teamId: string,
   taskId: string,
): Promise<void>;
export declare function updateInsightCache(
   db: DatabaseInstance,
   insightId: string,
   cachedResults: Record<string, unknown>,
): Promise<void>;
//# sourceMappingURL=onboarding-repository.d.ts.map
