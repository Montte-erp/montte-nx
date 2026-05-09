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
   AWS_S3_BUCKET_NAME,
   AWS_ACCESS_KEY_ID,
   AWS_SECRET_ACCESS_KEY,
   AWS_DEFAULT_REGION = "us-east-1",
} = process.env;

const CORS_ENDPOINT_URL =
   process.env.CORS_ENDPOINT_URL ?? "https://storage.railway.app";

if (!AWS_S3_BUCKET_NAME || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
   console.error(
      "Missing AWS_* env vars. Set in apps/web/.env.production or shell.",
   );
   process.exit(1);
}

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } =
   await import("@aws-sdk/client-s3");

const client = new S3Client({
   endpoint: CORS_ENDPOINT_URL,
   region: AWS_DEFAULT_REGION,
   credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
   },
   forcePathStyle: true,
});

console.log(`Bucket:    ${AWS_S3_BUCKET_NAME}`);
console.log(`Endpoint:  ${CORS_ENDPOINT_URL}`);
console.log("");

await client.send(
   new PutBucketCorsCommand({
      Bucket: AWS_S3_BUCKET_NAME,
      CORSConfiguration: {
         CORSRules: [
            {
               AllowedHeaders: ["*"],
               AllowedMethods: ["*"],
               AllowedOrigins: ["*"],
               MaxAgeSeconds: 3000,
            },
         ],
      },
   }),
);

console.log("✅ CORS applied.\n");

const verify = await client.send(
   new GetBucketCorsCommand({ Bucket: AWS_S3_BUCKET_NAME }),
);
console.log("Current CORS config:");
console.log(JSON.stringify(verify.CORSRules, null, 2));
