import pino from "pino";
import type { Logger, LoggerConfig } from "./types";

const isDevelopment = process.env.NODE_ENV !== "production";

export function createLogger(config: LoggerConfig): Logger {
   const { name, level = "info", enableOtel } = config;

   // Build transport targets
   const targets: pino.TransportTargetOptions[] = [];

   // Console transport: pretty in dev, JSON in prod
   if (isDevelopment) {
      targets.push({
         target: "pino-pretty",
         options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
         },
         level,
      });
   } else {
      targets.push({
         target: "pino/file",
         options: { destination: 1 }, // stdout
         level,
      });
   }

   // OTel transport: bridges Pino logs to OpenTelemetry LogRecordProcessor
   if (enableOtel) {
      targets.push({
         target: "pino-opentelemetry-transport",
         level,
      });
   }

   return pino({
      name,
      level,
      transport: {
         targets,
      },
   });
}

export function createSafeLogger(config: LoggerConfig): Logger {
   try {
      return createLogger(config);
   } catch (error) {
      console.warn("[Logging] Failed to create logger, using fallback:", error);
      return pino({ name: config.name, level: config.level || "info" });
   }
}

export { pino };
export type { Logger, LoggerConfig, LogLevel } from "./types";
