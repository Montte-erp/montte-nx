import type { DatabaseInstance } from "@core/database/client";
export declare function findMemberByUserId(
   dbClient: DatabaseInstance,
   userId: string,
): Promise<
   | {
        createdAt: Date;
        id: string;
        organizationId: string;
        role: string;
        userId: string;
     }
   | undefined
>;
export declare function findMemberByUserIdAndOrganizationId(
   dbClient: DatabaseInstance,
   userId: string,
   organizationId: string,
): Promise<
   | {
        createdAt: Date;
        id: string;
        organizationId: string;
        role: string;
        userId: string;
     }
   | undefined
>;
export declare function findOrganizationById(
   dbClient: DatabaseInstance,
   organizationId: string,
): Promise<{
   context: string | null;
   createdAt: Date;
   description: string | null;
   id: string;
   logo: string | null;
   metadata: string | null;
   name: string;
   onboardingCompleted: boolean | null;
   slug: string;
}>;
export declare function isOrganizationOwner(
   dbClient: DatabaseInstance,
   userId: string,
   organizationId: string,
): Promise<boolean>;
export declare function getOrganizationMembers(
   dbClient: DatabaseInstance,
   organizationId: string,
): Promise<
   {
      createdAt: Date;
      id: string;
      organizationId: string;
      role: string;
      user: {
         banExpires: Date | null;
         banReason: string | null;
         banned: boolean | null;
         createdAt: Date;
         email: string;
         emailVerified: boolean;
         id: string;
         image: string | null;
         name: string;
         role: string | null;
         stripeCustomerId: string | null;
         telemetryConsent: boolean;
         twoFactorEnabled: boolean | null;
         updatedAt: Date;
      } | null;
      userId: string;
   }[]
>;
export declare function createDefaultOrganization(
   dbClient: DatabaseInstance,
   userId: string,
   userName: string,
): Promise<{
   context: string | null;
   createdAt: Date;
   description: string | null;
   id: string;
   logo: string | null;
   metadata: string | null;
   name: string;
   onboardingCompleted: boolean | null;
   slug: string;
}>;
export declare function updateOrganization(
   dbClient: DatabaseInstance,
   organizationId: string,
   data: {
      logo?: string;
   },
): Promise<
   | {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        createdAt: Date;
        metadata: string | null;
        context: string | null;
        description: string | null;
        onboardingCompleted: boolean | null;
     }
   | undefined
>;
export declare function getOrganizationMembership(
   dbClient: DatabaseInstance,
   userId: string,
   organizationSlug: string,
): Promise<
   | {
        membership: null;
        organization: null;
     }
   | {
        membership:
           | {
                createdAt: Date;
                id: string;
                organizationId: string;
                role: string;
                userId: string;
             }
           | undefined;
        organization: {
           context: string | null;
           createdAt: Date;
           description: string | null;
           id: string;
           logo: string | null;
           metadata: string | null;
           name: string;
           onboardingCompleted: boolean | null;
           slug: string;
        };
     }
>;
export declare function ensureDefaultProject(
   dbClient: DatabaseInstance,
   organizationId: string,
   userId: string,
): Promise<{
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
}>;
//# sourceMappingURL=auth-repository.d.ts.map
