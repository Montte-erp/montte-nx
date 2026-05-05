import type { AgentToolClient } from "@modules/agents/orpc-tool-router";

export interface ToolDeps {
   orpcClient: AgentToolClient;
}
