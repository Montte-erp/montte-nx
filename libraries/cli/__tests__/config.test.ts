import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempHome: string;

vi.mock("node:os", async () => {
   const actual = await vi.importActual<typeof import("node:os")>("node:os");
   return {
      ...actual,
      homedir: () => tempHome,
   };
});

beforeEach(() => {
   tempHome = join(
      tmpdir(),
      `montte-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
   );
   mkdirSync(tempHome, { recursive: true });
   delete process.env.MONTTE_API_KEY;
   delete process.env.MONTTE_HOST;
   vi.resetModules();
});

afterEach(() => {
   delete process.env.MONTTE_API_KEY;
   delete process.env.MONTTE_HOST;
   if (existsSync(tempHome)) rmSync(tempHome, { recursive: true });
});

async function loadConfig() {
   return await import("../src/config");
}

describe("getConfig", () => {
   it("returns null when no config exists", async () => {
      const { getConfig } = await loadConfig();
      expect(getConfig()).toBeNull();
   });

   it("reads from env vars", async () => {
      process.env.MONTTE_API_KEY = "test-key";
      process.env.MONTTE_HOST = "http://localhost:3000";
      const { getConfig } = await loadConfig();
      const config = getConfig();
      expect(config).toEqual({
         apiKey: "test-key",
         host: "http://localhost:3000",
      });
   });

   it("reads from config file", async () => {
      const configDir = join(tempHome, ".montte");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
         join(configDir, "config.json"),
         JSON.stringify({ apiKey: "file-key", host: "http://file" }),
      );
      const { getConfig } = await loadConfig();
      expect(getConfig()).toEqual({ apiKey: "file-key", host: "http://file" });
   });

   it("env vars take precedence over file", async () => {
      const configDir = join(tempHome, ".montte");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
         join(configDir, "config.json"),
         JSON.stringify({ apiKey: "file-key" }),
      );
      process.env.MONTTE_API_KEY = "env-key";
      const { getConfig } = await loadConfig();
      expect(getConfig()!.apiKey).toBe("env-key");
   });
});

describe("saveConfig", () => {
   it("creates dir and file", async () => {
      const { saveConfig } = await loadConfig();
      saveConfig({ apiKey: "new-key" });
      const configPath = join(tempHome, ".montte", "config.json");
      expect(existsSync(configPath)).toBe(true);
   });
});

describe("clearConfig", () => {
   it("removes file", async () => {
      const { saveConfig, clearConfig } = await loadConfig();
      saveConfig({ apiKey: "key" });
      clearConfig();
      expect(existsSync(join(tempHome, ".montte", "config.json"))).toBe(false);
   });

   it("does nothing when no file", async () => {
      const { clearConfig } = await loadConfig();
      expect(() => clearConfig()).not.toThrow();
   });
});

describe("requireConfig", () => {
   it("returns config when exists", async () => {
      process.env.MONTTE_API_KEY = "key";
      const { requireConfig } = await loadConfig();
      expect(requireConfig().apiKey).toBe("key");
   });

   it("exits when no config", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
         throw new Error("process.exit");
      });
      const { requireConfig } = await loadConfig();
      expect(() => requireConfig()).toThrow("process.exit");
      exitSpy.mockRestore();
   });
});
