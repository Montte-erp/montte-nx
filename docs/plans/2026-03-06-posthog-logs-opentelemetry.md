# PostHog Super Telemetry — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full-stack observability: structured logs from all apps (web, server, worker) sent to PostHog via OpenTelemetry, **linked to users and session replays** via `posthogDistinctId` and `sessionId` attributes. Plus error tracking with exception autocapture and fixing existing telemetry gaps.

**Architecture:**
- OTel SDK initialized at each app entry point → exports logs to `https://us.i.posthog.com/i/v1/logs`
- Pino stays as the logging interface, bridged to OTel via `pino-opentelemetry-transport`
- **Identification flow:** Frontend sends `sessionId` (from `posthog.getSessionId()`) via `X-PostHog-Session-Id` header → oRPC middleware reads it + `userId` from auth → attaches both as Pino child logger bindings → flows through to OTel log records as attributes
- `posthog-node` gets `enableExceptionAutocapture: true` for error tracking
- oRPC handlers get `@orpc/experimental-pino` plugin + `@orpc/otel` instrumentation

**Tech Stack:** `@opentelemetry/sdk-node`, `@opentelemetry/exporter-logs-otlp-http`, `@opentelemetry/api-logs`, `@opentelemetry/resources`, `@opentelemetry/sdk-logs`, `@orpc/otel`, `@orpc/experimental-pino`, `pino-opentelemetry-transport`

**PostHog identification attributes (on every OTel log record):**

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `posthogDistinctId` | `userId` from session | Links log to PostHog user profile |
| `sessionId` | From `X-PostHog-Session-Id` header | Links log to session replay |
| `organizationId` | From active session | Groups logs by organization |
| `teamId` | From active session | Groups logs by team |
| `service.name` | `contentta-web` / `contentta-server` / `contentta-worker` | OTel resource attribute |

---

### Task 1: Install OpenTelemetry & oRPC Packages

**Files:**
- Modify: `package.json` (root)

**Step 1: Install all packages**

```bash
bun add @opentelemetry/sdk-node @opentelemetry/exporter-logs-otlp-http @opentelemetry/api-logs @opentelemetry/resources @opentelemetry/sdk-logs pino-opentelemetry-transport @orpc/otel@latest @orpc/experimental-pino@latest
```

**Step 2: Verify installation**

```bash
bun install
```
Expected: lockfile updated, no resolution errors.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add OpenTelemetry and oRPC logging packages"
```

---

### Task 2: Add `POSTHOG_KEY` to Worker Environment

**Files:**
- Modify: `packages/environment/src/worker.ts`

The server env already has `POSTHOG_KEY`. The worker doesn't — add it so the worker can authenticate with PostHog's OTLP endpoint.

**Step 1: Add `POSTHOG_KEY` to worker schema**

In `packages/environment/src/worker.ts`, add to the Zod schema:

```typescript
POSTHOG_KEY: z.string().optional(),
```

Optional so the worker still boots without it.

**Step 2: Run typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add packages/environment/src/worker.ts
git commit -m "feat(environment): add optional POSTHOG_KEY to worker env"
```

---

### Task 3: Create OTel SDK Initializer in `packages/logging`

**Files:**
- Create: `packages/logging/src/otel.ts`
- Modify: `packages/logging/package.json` (add export)

**Step 1: Create the OTel SDK setup module**

Create `packages/logging/src/otel.ts`:

```typescript
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";

const POSTHOG_OTEL_LOGS_URL = "https://us.i.posthog.com/i/v1/logs";

export interface OtelConfig {
	serviceName: string;
	/** PostHog project token (phc_...) */
	posthogKey: string;
}

let sdk: NodeSDK | null = null;

export function initOtel(config: OtelConfig): NodeSDK {
	if (sdk) return sdk;

	sdk = new NodeSDK({
		resource: resourceFromAttributes({
			"service.name": config.serviceName,
		}),
		instrumentations: [new ORPCInstrumentation()],
		logRecordProcessors: [
			new BatchLogRecordProcessor(
				new OTLPLogExporter({
					url: POSTHOG_OTEL_LOGS_URL,
					headers: {
						Authorization: `Bearer ${config.posthogKey}`,
					},
				}),
			),
		],
	});

	sdk.start();
	return sdk;
}

export async function shutdownOtel(): Promise<void> {
	if (sdk) {
		await sdk.shutdown();
		sdk = null;
	}
}
```

**Step 2: Add package.json export**

In `packages/logging/package.json`, add to `exports`:

```json
"./otel": {
  "types": "./src/otel.ts",
  "default": "./src/otel.ts"
}
```

**Step 3: Add OTel dependencies to packages/logging**

```bash
cd packages/logging && bun add @opentelemetry/sdk-node @opentelemetry/exporter-logs-otlp-http @opentelemetry/resources @opentelemetry/sdk-logs @orpc/otel
```

**Step 4: Run typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add packages/logging/src/otel.ts packages/logging/package.json
git commit -m "feat(logging): add OTel SDK initializer with oRPC instrumentation"
```

---

### Task 4: Add Pino → OTel Transport Bridge

**Files:**
- Modify: `packages/logging/src/logger.ts`
- Modify: `packages/logging/src/types.ts`

**Step 1: Extend LoggerConfig type**

In `packages/logging/src/types.ts`, add to `LoggerConfig`:

```typescript
/** When true, adds pino-opentelemetry-transport to send logs via OTel pipeline */
enableOtel?: boolean;
```

**Step 2: Add OTel transport target in logger factory**

In `packages/logging/src/logger.ts`, inside `createLogger` where transport targets are built, add a conditional OTel transport:

```typescript
// After existing transport targets (pino-pretty, logtail, etc.)
if (config.enableOtel) {
	targets.push({
		target: "pino-opentelemetry-transport",
		level: config.level ?? "info",
	});
}
```

`pino-opentelemetry-transport` automatically picks up the OTel SDK's active `LoggerProvider` — no explicit configuration needed as long as `initOtel()` was called before creating the logger.

**Important:** Pino child logger bindings (like `posthogDistinctId`, `sessionId`) are forwarded as OTel log record attributes by this transport. This is what makes the identification flow work.

**Step 3: Run typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add packages/logging/src/logger.ts packages/logging/src/types.ts
git commit -m "feat(logging): add Pino-to-OTel transport bridge"
```

---

### Task 5: Send Session ID from Frontend

**Files:**
- Modify: `apps/web/src/integrations/orpc/client.ts` (or wherever the oRPC client link is configured)

The frontend needs to send `posthog.getSessionId()` with every oRPC request so the backend can attach it to logs.

**Step 1: Find the oRPC client link configuration**

Look for where `RPCLink` or `createORPCClient` is configured — it should have a `headers` option.

**Step 2: Add session ID header**

```typescript
import posthog from "posthog-js";

// In the RPCLink or fetch wrapper configuration:
headers: () => {
	const sessionId = posthog.getSessionId?.();
	return {
		...(sessionId ? { "X-PostHog-Session-Id": sessionId } : {}),
	};
},
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/client.ts
git commit -m "feat(web): send PostHog session ID header with oRPC requests"
```

---

### Task 6: Add Identification Middleware to oRPC (the key task)

**Files:**
- Modify: `apps/web/src/integrations/orpc/server.ts`

This is the core of "super telemetry" — every log emitted during an oRPC request gets `posthogDistinctId` and `sessionId` as attributes, linking it to the user and session replay in PostHog.

**Step 1: Import getLogger from @orpc/experimental-pino**

```typescript
import { getLogger, type LoggerContext } from "@orpc/experimental-pino";
```

**Step 2: Add identification to `withTelemetry` middleware**

Inside the `withTelemetry` middleware (which already has access to `userId`, `organizationId`, `session`, `headers`), create a child logger enriched with PostHog identification attributes:

```typescript
const withTelemetry = withOrganization.use(
	async ({ context, path, next }, input) => {
		const startDate = new Date();
		const { posthog } = context;
		const userId = context.session?.user?.id;
		const userEmail = context.session?.user?.email;
		const userName = context.session?.user?.name;
		const hasConsent = context.session?.user?.telemetryConsent;
		const organizationId = context.organizationId;
		const teamId = context.teamId;

		// === NEW: Read session ID from frontend header ===
		const sessionId = context.headers.get("x-posthog-session-id");

		// === NEW: Enrich the per-request logger with PostHog identification ===
		const requestLogger = getLogger(context);
		if (requestLogger && userId) {
			// These bindings become OTel log record attributes via pino-opentelemetry-transport
			const enrichedLogger = requestLogger.child({
				posthogDistinctId: userId,
				...(sessionId ? { sessionId } : {}),
				organizationId,
				teamId,
				path: path.join("."),
			});
			// Log request start (will appear in PostHog linked to user + session)
			enrichedLogger.info({ input: sanitizeData(input) }, "oRPC request started");
		}

		// ... existing identify/telemetry logic ...

		// Identify user if consented
		if (userId && hasConsent && posthog) {
			identifyUser(posthog, userId, {
				email: userEmail,
				name: userName,
			});

			if (organizationId) {
				setGroup(posthog, organizationId, {});
			}
		}

		let isSuccess = true;
		let error: Error | null = null;

		try {
			const result = await next();
			return result;
		} catch (err) {
			isSuccess = false;
			error = err instanceof Error ? err : new Error(String(err));
			throw err;
		} finally {
			if (userId && hasConsent && posthog) {
				try {
					const durationMs = Date.now() - startDate.getTime();
					const rootPath = path[0];

					if (!isSuccess && error) {
						const errorId = crypto.randomUUID();
						captureError(posthog, {
							code: "INTERNAL_SERVER_ERROR",
							errorId,
							input: sanitizeData(input),
							message: error.message,
							organizationId: organizationId || undefined,
							path: path.join("."),
							userId,
						});

						// === NEW: Log error with identification ===
						if (requestLogger) {
							requestLogger.child({
								posthogDistinctId: userId,
								...(sessionId ? { sessionId } : {}),
								organizationId,
								teamId,
							}).error({ errorId, path: path.join("."), durationMs }, error.message);
						}
					}

					posthog.capture({
						distinctId: userId,
						event: "orpc_request",
						properties: {
							durationMs,
							endAt: new Date().toISOString(),
							input: sanitizeData(input),
							path: path.join("."),
							rootPath,
							startAt: startDate.toISOString(),
							success: isSuccess,
							...(organizationId
								? { $groups: { organization: organizationId } }
								: {}),
							...(isSuccess
								? {}
								: {
										errorMessage: error?.message,
										errorName: error?.name,
								  }),
						},
					});
				} catch {
					// Silently fail telemetry
				}
			}
		}
	},
);
```

**Step 3: Update context types**

Add `LoggerContext` to `ORPCContextWithAuth`:

```typescript
import type { LoggerContext } from "@orpc/experimental-pino";

export interface ORPCContextWithAuth extends LoggerContext {
	headers: Headers;
	request: Request;
	auth: AuthInstance;
	db: DatabaseInstance;
	session: Awaited<ReturnType<AuthInstance["api"]["getSession"]>> | null;
	posthog?: PostHog;
	stripeClient?: StripeClient;
}
```

**Step 4: Run typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/integrations/orpc/server.ts
git commit -m "feat(orpc): add PostHog identification to logs (posthogDistinctId + sessionId)"
```

---

### Task 7: Add `@orpc/experimental-pino` Plugin to oRPC Handlers

**Files:**
- Modify: `apps/web/src/routes/api/rpc/$.ts`
- Modify: `apps/web/src/routes/api/$.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Add LoggingHandlerPlugin to web oRPC handler**

In `apps/web/src/routes/api/rpc/$.ts`:

```typescript
import { LoggingHandlerPlugin } from "@orpc/experimental-pino";
import pino from "pino";

// Create logger with OTel transport enabled
const logger = pino({
	name: "contentta-web-rpc",
	transport: {
		targets: [
			{ target: "pino-opentelemetry-transport", level: "info" },
		],
	},
});

const handler = new RPCHandler(router, {
	plugins: [
		new BatchHandlerPlugin(),
		new LoggingHandlerPlugin({
			logger,
			generateId: () => crypto.randomUUID(),
			logRequestResponse: true,
			logRequestAbort: true,
		}),
	],
});
```

**Step 2: Add to server oRPC handler**

Same pattern in `apps/server/src/index.ts`.

**Step 3: Add to the API route handler (`api/$.ts`)**

Same pattern.

**Step 4: Run typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/routes/api/rpc/$.ts apps/web/src/routes/api/$.ts apps/server/src/index.ts
git commit -m "feat(orpc): add LoggingHandlerPlugin for structured request logging"
```

---

### Task 8: Wire OTel into All App Entry Points

**Files:**
- Modify: `apps/server/src/index.ts`
- Create: `apps/web/src/integrations/otel/init.ts`
- Modify: `apps/web/src/routes/api/$.ts`
- Modify: `apps/web/src/routes/api/rpc/$.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `packages/logging/src/worker.ts`
- Modify: `packages/logging/src/server.ts`

**Step 1: apps/server — initialize OTel + graceful shutdown**

At the very top of `apps/server/src/index.ts`:

```typescript
import { initOtel, shutdownOtel } from "@packages/logging/otel";
import { env } from "@packages/environment/server";

if (env.POSTHOG_KEY) {
	initOtel({
		serviceName: "contentta-server",
		posthogKey: env.POSTHOG_KEY,
	});
}
```

Add graceful shutdown:

```typescript
import { shutdownPosthog } from "@packages/posthog/server";

const shutdown = async (signal: string) => {
	console.log(`[Server] Received ${signal}, shutting down...`);
	await shutdownPosthog(posthog);
	await shutdownOtel();
	process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

**Step 2: apps/web — OTel init module**

Create `apps/web/src/integrations/otel/init.ts`:

```typescript
import { initOtel } from "@packages/logging/otel";

const posthogKey = process.env.POSTHOG_KEY;

if (posthogKey && typeof window === "undefined") {
	initOtel({
		serviceName: "contentta-web",
		posthogKey,
	});
}
```

Import at top of `apps/web/src/routes/api/$.ts` and `apps/web/src/routes/api/rpc/$.ts`:

```typescript
import "@/integrations/otel/init";
```

**Step 3: apps/worker — initialize OTel + shutdown**

At the top of `apps/worker/src/index.ts`:

```typescript
import { initOtel, shutdownOtel } from "@packages/logging/otel";

const posthogKey = process.env.POSTHOG_KEY;
if (posthogKey) {
	initOtel({
		serviceName: "contentta-worker",
		posthogKey,
	});
}
```

In shutdown handler:

```typescript
await shutdownOtel();
```

**Step 4: Update logger singletons to enable OTel transport**

In `packages/logging/src/server.ts` and `packages/logging/src/worker.ts`, add `enableOtel` flag:

```typescript
// server.ts
export function getServerLogger(env: ServerLoggerEnv): Logger {
	if (!serverLogger) {
		serverLogger = createSafeLogger({
			name: "montte-server",
			level: env.LOG_LEVEL,
			logtailToken: env.LOGTAIL_SOURCE_TOKEN,
			logtailEndpoint: env.LOGTAIL_ENDPOINT,
			enableOtel: !!env.POSTHOG_KEY,
		});
	}
	return serverLogger;
}
```

Add `POSTHOG_KEY?: string` to `ServerLoggerEnv` and `WorkerLoggerEnv` types.

**Step 5: Run typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/server/src/index.ts apps/web/src/integrations/otel/init.ts apps/web/src/routes/api/$.ts apps/web/src/routes/api/rpc/$.ts apps/worker/src/index.ts packages/logging/src/server.ts packages/logging/src/worker.ts packages/logging/src/types.ts
git commit -m "feat: wire OTel SDK into all app entry points with graceful shutdown"
```

---

### Task 9: Enable PostHog Exception Autocapture

**Files:**
- Modify: `packages/posthog/src/server.ts`

**Step 1: Enable exception autocapture in `getElysiaPosthogConfig`**

```typescript
export function getElysiaPosthogConfig(
	env: Pick<ServerEnv, "POSTHOG_HOST" | "POSTHOG_KEY">,
) {
	const internalPosthog = new PostHog(env.POSTHOG_KEY, {
		flushAt: 20,
		flushInterval: 10000,
		host: env.POSTHOG_HOST,
		enableExceptionAutocapture: true, // NEW: auto-capture unhandled exceptions
	});
	return internalPosthog;
}
```

**Step 2: Fix legacy `trpc_error` event name**

Change line 66:

```typescript
// Before
event: "trpc_error",
// After
event: "orpc_error",
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add packages/posthog/src/server.ts
git commit -m "feat(posthog): enable exception autocapture + fix trpc_error → orpc_error"
```

---

### Task 10: Test End-to-End

**Step 1: Verify env**

Ensure `POSTHOG_KEY` is set (same `phc_...` token used for analytics).

**Step 2: Start the dev server**

```bash
bun dev
```

**Step 3: Trigger requests and check PostHog**

1. Navigate the app, trigger oRPC calls
2. Open PostHog → **Logs** section
3. Verify log entries have:
   - `service.name` = `contentta-web`
   - `posthogDistinctId` = your user ID
   - `sessionId` = matches your session replay
   - `organizationId` and `teamId` present
4. Click a log entry → verify you can navigate to the **session replay**
5. Open PostHog → **Error Tracking** → verify exceptions are captured

**Step 4: Verify no regressions**

```bash
bun run typecheck
bun run test
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: PostHog super telemetry — logs, identification, error tracking"
```

---

## Summary

| Layer | What happens |
|-------|-------------|
| **Frontend** | Sends `X-PostHog-Session-Id` header with every oRPC request |
| **oRPC middleware** | Reads header + userId from auth → creates child Pino logger with `posthogDistinctId` + `sessionId` bindings |
| **Pino** (existing) | App code logs with `logger.info(...)` — now enriched with user context |
| **pino-opentelemetry-transport** (new) | Bridges Pino log records (including bindings) → OTel LogRecordProcessor |
| **OTel SDK** (new) | Batches log records, exports via OTLP HTTP to PostHog |
| **PostHog OTLP endpoint** | Receives logs at `https://us.i.posthog.com/i/v1/logs` with `Bearer phc_...` auth |
| **PostHog UI** | Logs linked to users → click to session replay. Errors auto-captured. |
| **@orpc/experimental-pino** (new) | Per-request structured logging with request IDs in oRPC handlers |
| **@orpc/otel** (new) | Span instrumentation for oRPC context propagation |
| **posthog-node** (updated) | `enableExceptionAutocapture: true` for error tracking |

**What you get in PostHog:**
- **Logs** → searchable, filterable by level, linked to users and sessions
- **Session Replay** → click from a log to see exactly what the user was doing
- **Error Tracking** → auto-captured exceptions with stack traces
- **Analytics** → `orpc_request` and `orpc_error` events (existing, now with fixed event names)

---

## Existing Gaps Fixed in This Plan

| Gap | Fix | Task |
|-----|-----|------|
| `apps/server` no graceful PostHog shutdown | Added SIGTERM/SIGINT handlers | Task 8 |
| `captureError` uses `trpc_error` event name | Changed to `orpc_error` | Task 9 |
| `apps/worker` no PostHog/telemetry | OTel SDK + Pino transport added | Task 8 |
| No user identification on logs | `posthogDistinctId` + `sessionId` attributes | Task 6 |
| No session replay linking | Frontend sends session ID header | Task 5 |
| No exception autocapture | `enableExceptionAutocapture: true` | Task 9 |

Sources:
- [PostHog Logs Documentation](https://posthog.com/docs/logs)
- [PostHog Node.js Logs Installation](https://posthog.com/docs/logs/installation/nodejs)
- [PostHog Link Session Replay](https://posthog.com/docs/logs/link-session-replay)
- [PostHog Logging Best Practices](https://posthog.com/docs/logs/best-practices)
- [oRPC OpenTelemetry Integration](https://orpc.dev/docs/integrations/opentelemetry)
- [oRPC Pino Integration](https://orpc.dev/docs/integrations/pino)
