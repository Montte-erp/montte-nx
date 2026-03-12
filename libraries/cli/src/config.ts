import {
   existsSync,
   mkdirSync,
   readFileSync,
   writeFileSync,
   unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".montte");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface Config {
   apiKey: string;
   host?: string;
}

export function getConfig(): Config | null {
   if (process.env.MONTTE_API_KEY) {
      return {
         apiKey: process.env.MONTTE_API_KEY,
         host: process.env.MONTTE_HOST,
      };
   }
   if (!existsSync(CONFIG_FILE)) return null;
   const raw = readFileSync(CONFIG_FILE, "utf-8");
   return JSON.parse(raw) as Config;
}

export function saveConfig(config: Config): void {
   mkdirSync(CONFIG_DIR, { recursive: true });
   writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function clearConfig(): void {
   if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
}

export function requireConfig(): Config {
   const config = getConfig();
   if (!config) {
      console.error("Not logged in. Run: montte login --key <your-api-key>");
      process.exit(1);
   }
   return config;
}
