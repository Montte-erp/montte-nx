import { env } from "@packages/environment/server";
import { getLogger } from "@packages/logging/root";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
   createMcpHandler,
   protectedResourceHandler,
   withMcpAuth,
} from "mcp-handler";
import { registerTools } from "./tools";

const logger = getLogger().child({ module: "mcp" });

const AUTH_SERVER_URL = env.BETTER_AUTH_URL;
const JWKS_URL = `${AUTH_SERVER_URL}/api/auth/jwks`;
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

// Create base MCP handler
const baseMcpHandler = createMcpHandler(
   (server) => {
      // Type assertion needed due to SDK version mismatch (root: 1.26, mcp-handler: 1.25)
      // Runtime compatible, types are structurally identical
      registerTools(server as unknown as Parameters<typeof registerTools>[0]);
   },
   { serverInfo: { name: "montte-mcp", version: "1.0.0" } },
   {
      basePath: "/mcp",
      redisUrl: env.REDIS_URL,
      verboseLogs: env.NODE_ENV !== "production",
   },
);

// Wrap with JWT verification
export const mcpRequestHandler = withMcpAuth(
   baseMcpHandler,
   async (_req, bearerToken) => {
      if (!bearerToken) return undefined;

      try {
         const { payload } = await jwtVerify(bearerToken, jwks, {
            issuer: AUTH_SERVER_URL,
         });

         const claims = payload as Record<string, unknown>;
         const organizationId =
            typeof claims.activeOrganizationId === "string"
               ? claims.activeOrganizationId
               : typeof claims.referenceId === "string"
                 ? claims.referenceId
                 : undefined;
         const userId =
            typeof payload.sub === "string" ? payload.sub : undefined;

         if (!organizationId || !userId) {
            logger.error("JWT missing required claims: organizationId or userId");
            return undefined;
         }

         return {
            token: bearerToken,
            clientId:
               typeof claims.clientId === "string"
                  ? claims.clientId
                  : "unknown",
            scopes:
               typeof payload.scope === "string"
                  ? payload.scope.split(" ")
                  : [],
            extra: { organizationId, userId },
         };
      } catch (err) {
         logger.error({ err }, "JWT verification failed");
         return undefined;
      }
   },
   {
      required: true,
      resourceUrl: env.SDK_SERVER_URL,
   },
);

// Protected resource metadata handler (RFC 9728)
export const protectedResourceMetadataHandler = protectedResourceHandler({
   authServerUrls: [AUTH_SERVER_URL],
   resourceUrl: env.SDK_SERVER_URL,
});
