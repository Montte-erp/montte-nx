import type { DatabaseInstance } from "@core/database/client";

export interface ToolDeps {
   db: DatabaseInstance;
   teamId: string;
}
