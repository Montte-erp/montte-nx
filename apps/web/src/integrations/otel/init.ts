import { env } from "@packages/environment/server";
import { startHealthHeartbeat } from "@packages/logging/health";
import { initOtel } from "@packages/logging/otel";
import { posthog } from "@/integrations/orpc/server-instances";

initOtel({
   serviceName: "montte-web",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-web", posthog });
