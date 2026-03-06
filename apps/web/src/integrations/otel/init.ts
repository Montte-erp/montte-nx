import { initOtel } from "@packages/logging/otel";

const posthogKey = process.env.POSTHOG_KEY;

if (posthogKey && typeof window === "undefined") {
	initOtel({
		serviceName: "contentta-web",
		posthogKey,
	});
}
