import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { custom } from "@better-upload/server/clients";
import chalk from "chalk";

const colors = {
   blue: chalk.blue,
   cyan: chalk.cyan,
   green: chalk.green,
   red: chalk.red,
   yellow: chalk.yellow,
};

const envExamplePath = path.join("apps", "web", ".env.example");
const envLocalPath = path.join("apps", "web", ".env.local");

function step(msg: string) {
   console.log(colors.blue(`▶ ${msg}`));
}

function ok(msg: string) {
   console.log(colors.green(`✓ ${msg}`));
}

function run(cmd: string) {
   execSync(cmd, { stdio: "inherit" });
}

// ── 1. Ensure .env.local exists ──────────────────────────────────────────────
if (!fs.existsSync(envLocalPath)) {
   if (!fs.existsSync(envExamplePath)) {
      console.error(colors.red("❌ apps/web/.env.example not found."));
      process.exit(1);
   }
   fs.copyFileSync(envExamplePath, envLocalPath);
   ok("Created apps/web/.env.local from .env.example");
   console.log(
      colors.yellow(
         "  ⚠ Placeholder values are in use. Replace them with real keys for full functionality.",
      ),
   );
}

// ── 2. Install dependencies if needed ────────────────────────────────────────
if (!fs.existsSync("node_modules")) {
   step("node_modules not found — installing dependencies...");
   run("bun install");
   ok("Dependencies installed.");
}

// ── 3. Start containers ───────────────────────────────────────────────────────
step("Starting containers...");
try {
   run("bun run --cwd apps/web container-start");
} catch {
   console.log(colors.yellow("⚠ Could not start containers — continuing."));
}

// ── 4. Push DB schema ─────────────────────────────────────────────────────────
step("Pushing database schema...");
try {
   run("bun run db:push");
} catch {
   console.log(
      colors.yellow("⚠ db:push failed — DB may already be up to date."),
   );
}

// ── 5. Ensure S3 bucket + CORS ───────────────────────────────────────────────
step("Ensuring S3 bucket...");
try {
   await ensureBucket();
   ok("S3 bucket ready.");
} catch (error) {
   console.log(
      colors.yellow(
         `⚠ Could not ensure S3 bucket — ${error instanceof Error ? error.message : String(error)}`,
      ),
   );
}

ok("Dev init complete.");

async function ensureBucket() {
   const envText = fs.readFileSync(envLocalPath, "utf8");
   const get = (key: string) =>
      envText
         .split("\n")
         .find((line) => line.startsWith(`${key}=`))
         ?.slice(key.length + 1)
         .trim();
   const endpoint = get("AWS_ENDPOINT_URL");
   const bucket = get("AWS_S3_BUCKET_NAME");
   const accessKeyId = get("AWS_ACCESS_KEY_ID");
   const secretAccessKey = get("AWS_SECRET_ACCESS_KEY");
   if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS_* env vars in .env.local");
   }
   const url = new URL(
      endpoint.startsWith("http") ? endpoint : `http://${endpoint}`,
   );
   const client = custom({
      host: `${url.hostname}:${url.port || (url.protocol === "https:" ? "443" : "9000")}`,
      accessKeyId,
      secretAccessKey,
      region: get("AWS_DEFAULT_REGION") ?? "us-east-1",
      secure: url.protocol === "https:",
      forcePathStyle: true,
   });
   const bucketUrl = client.buildBucketUrl(bucket);
   const head = await client.s3.fetch(bucketUrl, { method: "HEAD" });
   if (head.status === 200) return;
   const create = await client.s3.fetch(bucketUrl, { method: "PUT" });
   if (!create.ok && create.status !== 409) {
      throw new Error(`bucket create failed: ${create.status}`);
   }
   const corsBody = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;
   const cors = await client.s3.fetch(`${bucketUrl}?cors`, {
      method: "PUT",
      headers: { "content-type": "application/xml" },
      body: corsBody,
   });
   if (!cors.ok) throw new Error(`CORS set failed: ${cors.status}`);
}
