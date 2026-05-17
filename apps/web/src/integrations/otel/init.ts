import { env } from "@core/environment/web";
import { initOtel } from "@core/logging";

initOtel({
   serviceName: "montte-web",
   posthogKey: env.POSTHOG_KEY,
   posthogHost: env.POSTHOG_HOST,
});
