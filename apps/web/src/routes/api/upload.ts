import { handleRequest, route, type Router } from "@better-upload/server";
import { env } from "@core/environment/web";
import { getLogger } from "@core/logging";
import { createFileRoute } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { err, fromPromise, ok } from "neverthrow";
import { auth, s3Client } from "@/integrations/singletons";

const logger = getLogger().child({ module: "api:upload" });

const BUCKET = env.AWS_S3_BUCKET_NAME;
const ORG_LOGO_PREFIX = "organization-logos";
const USER_AVATAR_PREFIX = "user-avatars";
const TRANSACTION_ATTACHMENT_PREFIX = "transaction-attachments";

function publicUrlFor(objectKey: string) {
   return `/api/files/${BUCKET}/${objectKey}`;
}

function absolutePublicUrlFor(objectKey: string) {
   return new URL(publicUrlFor(objectKey), env.BETTER_AUTH_URL).href;
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
      bucketName: BUCKET,
      routes: {
         organizationLogo: route({
            fileTypes: ["image/*"],
            maxFileSize: 5 * 1024 * 1024,
            signedUrlExpiresIn: 300,
            onBeforeUpload: ({ file }) => ({
               metadata: { organizationId },
               objectInfo: {
                  key: `${ORG_LOGO_PREFIX}/org-${organizationId}-${crypto.randomUUID()}.${fileExtension(file.name)}`,
                  cacheControl: "public, max-age=31536000, immutable",
               },
            }),
            onAfterSignedUrl: ({ file, metadata }) => {
               const url = publicUrlFor(file.objectInfo.key);
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
            onBeforeUpload: ({ file }) => ({
               metadata: { userId },
               objectInfo: {
                  key: `${USER_AVATAR_PREFIX}/avatar-${userId}-${crypto.randomUUID()}.${fileExtension(file.name)}`,
                  cacheControl: "public, max-age=31536000, immutable",
               },
            }),
            onAfterSignedUrl: ({ file, metadata }) => {
               const url = publicUrlFor(file.objectInfo.key);
               logger.info(
                  { userId: metadata.userId, url },
                  "user avatar presigned",
               );
               return { metadata: { publicUrl: url } };
            },
         }),
         transactionAttachment: route({
            fileTypes: ["image/*", "application/pdf"],
            maxFileSize: 10 * 1024 * 1024,
            multipleFiles: true,
            maxFiles: 5,
            signedUrlExpiresIn: 300,
            onBeforeUpload: () => ({
               metadata: { organizationId, userId },
               generateObjectInfo: ({ file }) => ({
                  key: `${TRANSACTION_ATTACHMENT_PREFIX}/attachment-${organizationId}-${crypto.randomUUID()}.${fileExtension(file.name)}`,
               }),
            }),
            onAfterSignedUrl: ({ files, metadata }) => {
               const publicUrls = Object.fromEntries(
                  files.map((f) => [
                     f.objectInfo.key,
                     absolutePublicUrlFor(f.objectInfo.key),
                  ]),
               );
               logger.info(
                  {
                     organizationId: metadata.organizationId,
                     userId: metadata.userId,
                     count: files.length,
                  },
                  "transaction attachments presigned",
               );
               return { metadata: { publicUrls } };
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
