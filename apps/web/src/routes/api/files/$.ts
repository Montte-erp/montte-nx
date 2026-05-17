import { getObjectStream } from "@better-upload/server/helpers";
import { log } from "@core/logging";
import { createFileRoute } from "@tanstack/react-router";
import { fromPromise } from "neverthrow";
import { s3Client } from "@/integrations/singletons";

async function handle({
   params,
}: {
   request: Request;
   params: { _splat?: string };
}) {
   const path = params._splat || "";
   const [bucketName, ...fileNameParts] = path.split("/");
   const fileName = fileNameParts.join("/");

   if (!bucketName || !fileName) {
      return new Response("Invalid file path", { status: 400 });
   }

   const result = await fromPromise(
      getObjectStream(s3Client, { bucket: bucketName, key: fileName }),
      (err) => {
         log.error({
            module: "api:files",
            message: "Error serving file",
            err,
            bucketName,
            fileName,
         });
         return err;
      },
   );
   if (result.isErr()) return new Response("File not found", { status: 404 });

   const { stream, contentType, contentLength } = result.value;
   return new Response(stream, {
      headers: {
         "Content-Type": contentType || "application/octet-stream",
         "Content-Length": contentLength.toString(),
         "Cache-Control": "public, max-age=31536000, immutable",
      },
   });
}

export const Route = createFileRoute("/api/files/$")({
   server: {
      handlers: {
         HEAD: handle,
         GET: handle,
      },
   },
});
