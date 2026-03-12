import { env } from "@core/environment/server";
import { startHealthHeartbeat } from "@core/logging/health";
import { initOtel } from "@core/logging/otel";
import { posthog } from "@core/posthog/server";

initOtel({
   serviceName: "montte-web",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-web", posthog });
