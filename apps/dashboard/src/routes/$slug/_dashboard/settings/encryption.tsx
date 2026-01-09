import { createFileRoute } from "@tanstack/react-router";
import { EncryptionSection } from "@/pages/settings/ui/encryption-section";

export const Route = createFileRoute("/$slug/_dashboard/settings/encryption")({
   component: EncryptionSection,
   staticData: {
      breadcrumb: "Criptografia",
   },
});
