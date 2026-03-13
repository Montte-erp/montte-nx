import { config } from "dotenv";
import { resolve } from "node:path";

const envDir = resolve(import.meta.dirname, "../../database");

const nodeEnv = process.env.NODE_ENV ?? "development";
const envFile = nodeEnv === "production" ? ".env.production" : ".env.local";

config({ path: resolve(envDir, envFile), override: false });
config({ path: resolve(envDir, ".env"), override: false });
