export declare const env: Readonly<{
   DATABASE_URL: string;
   REDIS_URL: string;
   RESEND_API_KEY?: string | undefined;
   APP_URL: string;
   LOG_LEVEL: "debug" | "error" | "fatal" | "info" | "trace" | "warn";
   POSTHOG_HOST: string;
   POSTHOG_KEY: string;
}>;
export type WorkerEnv = typeof env;
//# sourceMappingURL=worker.d.ts.map
