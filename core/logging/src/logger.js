import pino from "pino";
const isDevelopment = process.env.NODE_ENV !== "production";
export function createLogger(config) {
   const { name, level = "info" } = config;
   const targets = [
      isDevelopment
         ? {
              target: "pino-pretty",
              options: {
                 colorize: true,
                 translateTime: "HH:MM:ss",
                 ignore: "pid,hostname",
              },
              level,
           }
         : { target: "pino/file", options: { destination: 1 }, level },
      { target: "pino-opentelemetry-transport", level },
   ];
   return pino({ name, level, transport: { targets } });
}
export function createSafeLogger(config) {
   try {
      return createLogger(config);
   } catch {
      return pino({ name: config.name, level: config.level || "info" });
   }
}
