import { fromPromise } from "neverthrow";
import { deleteObject, listObjectsV2 } from "@better-upload/server/helpers";
import { getLogger } from "@core/logging/root";
import type { S3Client } from "@core/files/client";

const logger = getLogger().child({ module: "files:cleanup" });

export async function cleanupOrphanedFiles(
   client: S3Client,
   bucketName: string,
   prefix: string,
   olderThanHours: number,
   isReferencedInDb: (key: string) => Promise<boolean>,
): Promise<number> {
   const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
   let deletedCount = 0;
   let continuationToken: string | undefined;

   do {
      const page = await listObjectsV2(client, {
         bucket: bucketName,
         prefix,
         continuationToken,
      });

      for (const obj of page.contents) {
         if (!obj.key || !obj.lastModified) continue;
         if (obj.lastModified > cutoffTime) continue;

         const isReferenced = await isReferencedInDb(obj.key);
         if (isReferenced) continue;

         const result = await fromPromise(
            deleteObject(client, { bucket: bucketName, key: obj.key }),
            (err) => {
               logger.error(
                  { err, fileName: obj.key },
                  "Failed to delete orphaned file",
               );
               return err;
            },
         );
         if (result.isOk()) deletedCount++;
      }

      continuationToken = page.isTruncated
         ? page.nextContinuationToken
         : undefined;
   } while (continuationToken);

   return deletedCount;
}

export interface CleanupResult {
   deletedCount: number;
   errors: string[];
   prefix: string;
}

export async function cleanupAllOrphanedFiles(
   client: S3Client,
   bucketName: string,
   olderThanHours: number,
   dbCheckers: {
      checkOrganizationLogo: (key: string) => Promise<boolean>;
      checkUserAvatar: (key: string) => Promise<boolean>;
   },
): Promise<CleanupResult[]> {
   const results: CleanupResult[] = [];

   const prefixes = [
      { prefix: "organizations/", checker: dbCheckers.checkOrganizationLogo },
      { prefix: "users/", checker: dbCheckers.checkUserAvatar },
   ];

   for (const { prefix, checker } of prefixes) {
      const errors: string[] = [];
      const result = await fromPromise(
         cleanupOrphanedFiles(
            client,
            bucketName,
            prefix,
            olderThanHours,
            checker,
         ),
         (err) => (err instanceof Error ? err.message : String(err)),
      );

      if (result.isErr()) {
         errors.push(result.error);
         results.push({ deletedCount: 0, errors, prefix });
         continue;
      }

      results.push({ deletedCount: result.value, errors, prefix });
   }

   return results;
}
