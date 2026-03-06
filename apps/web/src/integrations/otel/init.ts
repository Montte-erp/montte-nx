import { startHealthHeartbeat } from "@packages/logging/health";
import { initOtel } from "@packages/logging/otel";

const posthogKey = process.env.POSTHOG_KEY;

if (posthogKey && typeof window === "undefined") {
	initOtel({
		serviceName: "montte-web",
		posthogKey,
	});
	startHealthHeartbeat({ serviceName: "montte-web" });
}
