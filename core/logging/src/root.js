import { createSafeLogger } from "@core/logging";
let rootLogger = null;
export function initLogger(config) {
   rootLogger = createSafeLogger(config);
   return rootLogger;
}
export function getLogger() {
   if (!rootLogger) {
      rootLogger = createSafeLogger({ name: "montte" });
   }
   return rootLogger;
}
