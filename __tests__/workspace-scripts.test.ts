import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = path.resolve(import.meta.dirname, "..");

function readWorkspaceFile(relativePath: string) {
   return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

describe("workspace scripts", () => {
   it("removes stale root package scripts for non-existent apps", () => {
      const packageJson = JSON.parse(readWorkspaceFile("package.json")) as {
         scripts?: Record<string, string>;
      };

      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts).not.toHaveProperty("dev:blog");
      expect(packageJson.scripts).not.toHaveProperty("dev:docs");
      expect(packageJson.scripts).not.toHaveProperty("dev:landing-page");
      expect(packageJson.scripts).not.toHaveProperty("dev:content-apps");
      expect(packageJson.scripts).not.toHaveProperty("dev:sdk-blog");
      expect(packageJson.scripts).not.toHaveProperty("start:dashboard");
      expect(packageJson.scripts).not.toHaveProperty("rag:reindex");
   });

   it("provides root tooling for running script tests", () => {
      const packageJson = JSON.parse(readWorkspaceFile("package.json")) as {
         scripts?: Record<string, string>;
      };
      const rootVitestConfig = readWorkspaceFile("vitest.config.ts");
      const rootTestTsconfig = JSON.parse(
         readWorkspaceFile("tsconfig.test.json"),
      ) as {
         extends?: string;
         include?: string[];
      };

      expect(packageJson.scripts?.["test:scripts"]).toBe(
         "vitest run __tests__/workspace-scripts.test.ts",
      );
      expect(rootVitestConfig).toContain("defineConfig");
      expect(rootVitestConfig).toContain("./tsconfig.test.json");
      expect(rootVitestConfig).toContain("./__tests__/**/*.test.ts");
      expect(rootTestTsconfig.extends).toBe("./tsconfig.json");
      expect(rootTestTsconfig.include).toEqual([
         "__tests__",
         "scripts",
         "*.ts",
      ]);
   });

   it("uses cac instead of commander in active root cli scripts", () => {
      const scriptFiles = [
         "scripts/clean.ts",
         "scripts/db-push.ts",
         "scripts/doctor.ts",
         "scripts/env-setup.ts",
         "scripts/seed-default-dashboard.ts",
         "scripts/seed-event-catalog.ts",
      ];

      for (const scriptFile of scriptFiles) {
         const source = readWorkspaceFile(scriptFile);
         expect(source).toContain('from "cac"');
         expect(source).not.toContain('from "commander"');
      }
   });

   it("does not reference legacy content writer, rag, or packages/database paths in active root scripts", () => {
      const scriptFiles = [
         "scripts/doctor.ts",
         "scripts/env-setup.ts",
         "scripts/seed-default-dashboard.ts",
         "scripts/seed-event-catalog.ts",
      ];

      for (const scriptFile of scriptFiles) {
         const source = readWorkspaceFile(scriptFile);
         expect(source).not.toContain("Content Writer");
         expect(source).not.toContain("packages/database");
         expect(source).not.toContain("database/rag");
      }
   });
});
