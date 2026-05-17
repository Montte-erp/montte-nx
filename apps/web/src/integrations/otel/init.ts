import { env } from "@core/environment/web";
import { startHealthHeartbeat } from "@core/logging";
import { initOtel } from "@core/logging";
import { posthog } from "@/integrations/singletons";

initOtel({
   serviceName: "montte-web",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-web", posthog });
