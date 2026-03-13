import type { MinioClient } from "@core/files/client";
export declare function cleanupOrphanedFiles(
   client: MinioClient,
   bucketName: string,
   prefix: string,
   olderThanHours: number,
   isReferencedInDb: (key: string) => Promise<boolean>,
): Promise<number>;
export interface CleanupResult {
   deletedCount: number;
   errors: string[];
   prefix: string;
}
export declare function cleanupAllOrphanedFiles(
   client: MinioClient,
   bucketName: string,
   olderThanHours: number,
   dbCheckers: {
      checkOrganizationLogo: (key: string) => Promise<boolean>;
      checkUserAvatar: (key: string) => Promise<boolean>;
   },
): Promise<CleanupResult[]>;
//# sourceMappingURL=cleanup.d.ts.map
