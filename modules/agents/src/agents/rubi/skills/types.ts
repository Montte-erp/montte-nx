import type { Tool } from "@tanstack/ai";
import type { DatabaseInstance } from "@core/database/client";

export interface SkillDeps {
   db: DatabaseInstance;
   teamId: string;
}

export type SkillTool = Tool<any, any, any>;

export interface Skill {
   id: string;
   name: string;
   description: string;
   promptName: string;
   buildTools: (deps: SkillDeps) => SkillTool[];
}
