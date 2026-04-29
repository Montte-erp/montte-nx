import pino from "pino";
import type { Logger, LoggerConfig } from "@core/logging/types";

const isDevelopment = process.env.NODE_ENV !== "production";

export function createLogger(config: LoggerConfig): Logger {
   const { name, level = "info" } = config;

   if (isDevelopment) {
      return pino({
         name,
         level,
         transport: {
            target: "pino-pretty",
            options: {
               colorize: true,
               translateTime: "HH:MM:ss",
               ignore: "pid,hostname",
            },
         },
      });
   }

   return pino({ name, level }, pino.destination({ sync: true }));
}

export function createSafeLogger(config: LoggerConfig): Logger {
   try {
      return createLogger(config);
   } catch {
      return pino(
         { name: config.name, level: config.level || "info" },
         pino.destination({ sync: true }),
      );
   }
}

export type { Logger, LoggerConfig, LogLevel } from "@core/logging/types";
