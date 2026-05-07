import { createFileRoute } from "@tanstack/react-router";
import { handleUploadRequest } from "@/integrations/upload/router";

export const Route = createFileRoute("/api/upload")({
   server: {
      handlers: {
         POST: ({ request }) => handleUploadRequest(request),
      },
   },
});
