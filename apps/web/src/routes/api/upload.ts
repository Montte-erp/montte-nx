import { env } from "@core/environment/web";
import { getLogger } from "@core/logging/root";
import {
   handleRequest,
   RejectUpload,
   route,
   type Router,
} from "@better-upload/server";
import { custom } from "@better-upload/server/clients";
import { parseEndpoint } from "@core/files/client";
import { createFileRoute } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { err, fromPromise, ok } from "neverthrow";
import { auth, minioClient } from "@/integrations/singletons";

const logger = getLogger().child({ module: "api:upload" });

const ORG_LOGO_BUCKET = "organization-logos";

const minioEndpoint = parseEndpoint(env.MINIO_ENDPOINT);

const s3Client = custom({
   host: minioEndpoint.host,
   accessKeyId: env.MINIO_ACCESS_KEY,
   secretAccessKey: env.MINIO_SECRET_KEY,
   region: "us-east-1",
   secure: minioEndpoint.useSSL,
   forcePathStyle: true,
});

function publicUrlFor(objectKey: string) {
   return `/api/files/${ORG_LOGO_BUCKET}/${objectKey}`;
}

function fileExtension(name: string) {
   const ext = name.split(".").pop();
   return ext && ext !== name ? ext.toLowerCase() : "png";
}

function ensureBucket() {
   return fromPromise(
      minioClient.bucketExists(ORG_LOGO_BUCKET),
      () => new Error("Falha ao verificar bucket."),
   ).andThen((exists) =>
      exists
         ? ok(undefined)
         : fromPromise(
              minioClient.makeBucket(ORG_LOGO_BUCKET),
              () => new Error("Falha ao criar bucket."),
           ),
   );
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
         return ok(organizationId);
      });
      if (result.isErr()) return result.error;
      return next({ context: { organizationId: result.value } });
   },
);

function uploadRouter(organizationId: string): Router {
   return {
      client: s3Client,
      bucketName: ORG_LOGO_BUCKET,
      routes: {
         organizationLogo: route({
            fileTypes: ["image/*"],
            maxFileSize: 5 * 1024 * 1024,
            signedUrlExpiresIn: 300,
            onBeforeUpload: async ({ file }) => {
               const result = await ensureBucket();
               if (result.isErr()) throw new RejectUpload(result.error.message);
               return {
                  metadata: { organizationId },
                  objectInfo: {
                     key: `org-${organizationId}-${crypto.randomUUID()}.${fileExtension(file.name)}`,
                     cacheControl: "public, max-age=31536000, immutable",
                  },
               };
            },
            onAfterSignedUrl: ({ file, metadata }) => {
               const url = publicUrlFor(file.objectInfo.key);
               logger.info(
                  { organizationId: metadata.organizationId, url },
                  "organization logo presigned",
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
            handleRequest(request, uploadRouter(context.organizationId)),
      },
   },
});
