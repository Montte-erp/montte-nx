interface Config {
   apiKey: string;
   host?: string;
}
export declare function getConfig(): Config | null;
export declare function saveConfig(config: Config): void;
export declare function clearConfig(): void;
export declare function requireConfig(): Config;
export {};
//# sourceMappingURL=config.d.ts.map
