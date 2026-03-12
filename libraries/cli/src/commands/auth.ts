import type { CAC } from "cac";
import { saveConfig, clearConfig, getConfig } from "../config";

export function registerAuthCommands(cli: CAC): void {
   cli.command("login", "Authenticate with your Montte API key")
      .option("--key <key>", "API key")
      .option("--host <host>", "API host (default: https://api.montte.com)")
      .action((options: { key?: string; host?: string }) => {
         if (!options.key) {
            console.error("Usage: montte login --key <your-api-key>");
            process.exit(1);
         }
         saveConfig({ apiKey: options.key, host: options.host });
         console.log("Logged in successfully.");
      });

   cli.command("logout", "Remove stored credentials").action(() => {
      clearConfig();
      console.log("Logged out.");
   });

   cli.command("whoami", "Show current authentication status").action(() => {
      const config = getConfig();
      if (!config) {
         console.log("Not logged in.");
         return;
      }
      console.log(`API Key: ${config.apiKey.slice(0, 8)}...`);
      if (config.host) console.log(`Host: ${config.host}`);
   });
}
