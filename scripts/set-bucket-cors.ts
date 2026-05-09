#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const ENV_FILE = resolve(ROOT, "apps/web/.env.production");

if (existsSync(ENV_FILE)) {
   const dotenv = await import("dotenv");
   dotenv.config({ path: ENV_FILE });
}

const {
   AWS_ENDPOINT_URL,
   AWS_S3_BUCKET_NAME,
   AWS_ACCESS_KEY_ID,
   AWS_SECRET_ACCESS_KEY,
} = process.env;

if (
   !AWS_ENDPOINT_URL ||
   !AWS_S3_BUCKET_NAME ||
   !AWS_ACCESS_KEY_ID ||
   !AWS_SECRET_ACCESS_KEY
) {
   console.error(
      "Missing AWS_* env vars. Set in apps/web/.env.production or shell.",
   );
   process.exit(1);
}

const ALLOWED_ORIGINS = (
   process.env.CORS_ALLOWED_ORIGINS ?? "https://app.montte.com.br"
)
   .split(",")
   .map((o) => o.trim())
   .filter(Boolean);

const corsConfig = {
   CORSRules: [
      {
         AllowedHeaders: ["*"],
         AllowedMethods: ["GET", "HEAD", "PUT", "POST"],
         AllowedOrigins: ALLOWED_ORIGINS,
         ExposeHeaders: ["ETag"],
         MaxAgeSeconds: 3000,
      },
   ],
};

console.log(`Bucket:    ${AWS_S3_BUCKET_NAME}`);
console.log(`Endpoint:  ${AWS_ENDPOINT_URL}`);
console.log(`Origins:   ${ALLOWED_ORIGINS.join(", ")}`);
console.log("");

const proc = Bun.spawn(
   [
      "aws",
      "s3api",
      "put-bucket-cors",
      "--bucket",
      AWS_S3_BUCKET_NAME,
      "--endpoint-url",
      AWS_ENDPOINT_URL,
      "--cors-configuration",
      JSON.stringify(corsConfig),
   ],
   {
      env: {
         ...process.env,
         AWS_ACCESS_KEY_ID,
         AWS_SECRET_ACCESS_KEY,
         AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
      },
      stdout: "inherit",
      stderr: "inherit",
   },
);

const exitCode = await proc.exited;
if (exitCode !== 0) {
   console.error(
      "\nFailed. Check 'aws' CLI installed: brew install awscli (or pacman -S aws-cli-v2)",
   );
   process.exit(exitCode);
}

console.log("\n✅ CORS applied. Verify:");
console.log(
   `  aws s3api get-bucket-cors --bucket ${AWS_S3_BUCKET_NAME} --endpoint-url ${AWS_ENDPOINT_URL}`,
);
