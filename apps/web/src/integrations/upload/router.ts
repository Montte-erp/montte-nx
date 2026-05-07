import { env } from "@core/environment/web";
import { getLogger } from "@core/logging/root";
import {
   handleRequest,
   RejectUpload,
   route,
   type Router,
} from "@better-upload/server";
import { custom } from "@better-upload/server/clients";
import { auth, minioClient } from "@/integrations/singletons";

const logger = getLogger().child({ module: "upload-router" });

const ORG_LOGO_BUCKET = "organization-logos";

const minioUrl = new URL(
   env.MINIO_ENDPOINT.startsWith("http")
      ? env.MINIO_ENDPOINT
      : `http://${env.MINIO_ENDPOINT}`,
);

const s3Client = custom({
   host: minioUrl.host,
   accessKeyId: env.MINIO_ACCESS_KEY ?? "minioadmin",
   secretAccessKey: env.MINIO_SECRET_KEY ?? "minioadmin",
   region: "us-east-1",
   secure: minioUrl.protocol === "https:",
   forcePathStyle: true,
});

function publicUrlFor(objectKey: string) {
   return `/api/files/${ORG_LOGO_BUCKET}/${objectKey}`;
}

function fileExtension(name: string) {
   const ext = name.split(".").pop();
   return ext && ext !== name ? ext.toLowerCase() : "png";
}

export const uploadRouter: Router = {
   client: s3Client,
   bucketName: ORG_LOGO_BUCKET,
   routes: {
      organizationLogo: route({
         fileTypes: ["image/*"],
         maxFileSize: 5 * 1024 * 1024,
         signedUrlExpiresIn: 300,
         onBeforeUpload: async ({ req, file }) => {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) {
               throw new RejectUpload("Não autenticado.");
            }
            const organizationId = session.session.activeOrganizationId;
            if (!organizationId) {
               throw new RejectUpload("Sem organização ativa.");
            }
            const bucketExists =
               await minioClient.bucketExists(ORG_LOGO_BUCKET);
            if (!bucketExists) {
               await minioClient.makeBucket(ORG_LOGO_BUCKET);
            }
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

export function handleUploadRequest(req: Request): Promise<Response> {
   return handleRequest(req, uploadRouter);
}
