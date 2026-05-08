import {
   handleRequest,
   RejectUpload,
   route,
   type Router,
} from "@better-upload/server";
import { getLogger } from "@core/logging/root";
import { createFileRoute } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { err, fromPromise, ok } from "neverthrow";
import { auth, s3Client } from "@/integrations/singletons";

const logger = getLogger().child({ module: "api:upload" });

const ORG_LOGO_BUCKET = "organization-logos";
const USER_AVATAR_BUCKET = "user-avatars";

const ensuredBuckets = new Set<string>();

async function ensureBucket(bucket: string) {
   if (ensuredBuckets.has(bucket)) return;
   const url = s3Client.buildBucketUrl(bucket);
   const head = await s3Client.s3.fetch(url, { method: "HEAD" });
   if (head.status === 200 || head.status === 204) {
      ensuredBuckets.add(bucket);
      return;
   }
   if (head.status !== 404) {
      logger.warn({ bucket, status: head.status }, "bucket head non-404");
   }
   const put = await s3Client.s3.fetch(url, { method: "PUT" });
   if (!put.ok && put.status !== 409) {
      const body = await put.text().catch(() => "");
      logger.error({ bucket, status: put.status, body }, "makeBucket failed");
      throw new RejectUpload(`Falha ao criar bucket ${bucket}.`);
   }
   ensuredBuckets.add(bucket);
}

function publicUrlFor(bucket: string, objectKey: string) {
   return `/api/files/${bucket}/${objectKey}`;
}

function fileExtension(name: string) {
   const ext = name.split(".").pop();
   return ext && ext !== name ? ext.toLowerCase() : "png";
}

const authMiddleware = createMiddleware({ type: "request" }).server(
   async ({ request, next }) => {
      const result = await fromPromise(
         auth.api.getSession({ headers: request.headers }),
         () => new Response("Unauthorized", { status: 401 }),
      ).andThen((session) => {
         if (!session)
            return err(new Response("Unauthorized", { status: 401 }));
         const organizationId = session.session.activeOrganizationId;
         if (!organizationId)
            return err(new Response("No active organization", { status: 403 }));
         return ok({ organizationId, userId: session.user.id });
      });
      if (result.isErr()) return result.error;
      return next({ context: result.value });
   },
);

function uploadRouter(organizationId: string, userId: string): Router {
   return {
      client: s3Client,
      bucketName: ORG_LOGO_BUCKET,
      routes: {
         organizationLogo: route({
            fileTypes: ["image/*"],
            maxFileSize: 5 * 1024 * 1024,
            signedUrlExpiresIn: 300,
            onBeforeUpload: async ({ file }) => {
               await ensureBucket(ORG_LOGO_BUCKET);
               return {
                  bucketName: ORG_LOGO_BUCKET,
                  metadata: { organizationId },
                  objectInfo: {
                     key: `org-${organizationId}-${crypto.randomUUID()}.${fileExtension(file.name)}`,
                     cacheControl: "public, max-age=31536000, immutable",
                  },
               };
            },
            onAfterSignedUrl: ({ file, metadata }) => {
               const url = publicUrlFor(ORG_LOGO_BUCKET, file.objectInfo.key);
               logger.info(
                  { organizationId: metadata.organizationId, url },
                  "organization logo presigned",
               );
               return { metadata: { publicUrl: url } };
            },
         }),
         userAvatar: route({
            fileTypes: ["image/*"],
            maxFileSize: 5 * 1024 * 1024,
            signedUrlExpiresIn: 300,
            onBeforeUpload: async ({ file }) => {
               await ensureBucket(USER_AVATAR_BUCKET);
               return {
                  bucketName: USER_AVATAR_BUCKET,
                  metadata: { userId },
                  objectInfo: {
                     key: `avatar-${userId}-${crypto.randomUUID()}.${fileExtension(file.name)}`,
                     cacheControl: "public, max-age=31536000, immutable",
                  },
               };
            },
            onAfterSignedUrl: ({ file, metadata }) => {
               const url = publicUrlFor(
                  USER_AVATAR_BUCKET,
                  file.objectInfo.key,
               );
               logger.info(
                  { userId: metadata.userId, url },
                  "user avatar presigned",
               );
               return { metadata: { publicUrl: url } };
            },
         }),
      },
   };
}

export const Route = createFileRoute("/api/upload")({
   server: {
      middleware: [authMiddleware],
      handlers: {
         POST: ({ request, context }) =>
            handleRequest(
               request,
               uploadRouter(context.organizationId, context.userId),
            ),
      },
   },
});
