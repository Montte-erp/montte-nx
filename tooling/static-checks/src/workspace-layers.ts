import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

type WorkspaceLayer = "apps" | "core" | "modules" | "packages" | "tooling";

type JsonObject = { readonly [key: string]: unknown };

type WorkspacePackage = {
   readonly dependencies: readonly string[];
   readonly devDependencies: readonly string[];
   readonly directory: string;
   readonly layer: WorkspaceLayer;
   readonly name: string;
};

type WorkspaceLayerDiagnostic = {
   readonly message: string;
   readonly path: string;
};

const workspaceRoots: readonly WorkspaceLayer[] = [
   "apps",
   "core",
   "modules",
   "packages",
   "tooling",
];

const allowedDependencyLayers: Record<
   WorkspaceLayer,
   readonly WorkspaceLayer[]
> = {
   apps: ["apps", "core", "modules", "packages", "tooling"],
   core: ["core"],
   modules: ["core", "modules"],
   packages: ["packages", "tooling"],
   tooling: ["tooling"],
};

const internalPackagePrefixes: readonly string[] = [
   "@core/",
   "@modules/",
   "@packages/",
   "@tooling/",
];

const sourceExtensions: Record<string, true> = {
   ".cjs": true,
   ".js": true,
   ".jsx": true,
   ".mjs": true,
   ".ts": true,
   ".tsx": true,
};

const skippedSourceSegments: Record<string, true> = {
   ".cache": true,
   ".nx": true,
   ".turbo": true,
   coverage: true,
   dist: true,
   node_modules: true,
};

const skippedSourceSuffixes: readonly string[] = [
   ".d.ts",
   ".tsbuildinfo",
   "routeTree.gen.ts",
];

const importPattern =
   /\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g;

const isJsonObject = (value: unknown): value is JsonObject =>
   value !== null && typeof value === "object" && !Array.isArray(value);

const normalizePath = (path: string): string => path.replaceAll("\\", "/");

const readJsonObject = (path: string): JsonObject | undefined => {
   const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
   return isJsonObject(parsed) ? parsed : undefined;
};

const workspaceDependencyNames = (value: unknown): readonly string[] => {
   if (!isJsonObject(value)) {
      return [];
   }
   return Object.keys(value).filter((name) =>
      internalPackagePrefixes.some((prefix) => name.startsWith(prefix)),
   );
};

const layerForDirectory = (directory: string): WorkspaceLayer | undefined => {
   const segment = normalizePath(directory).split("/")[0];
   switch (segment) {
      case "apps":
      case "core":
      case "modules":
      case "packages":
      case "tooling":
         return segment;
      default:
         return undefined;
   }
};

const packageDirectories = (rootDirectory: string): readonly string[] =>
   workspaceRoots.flatMap((root) => {
      const rootPath = `${rootDirectory}/${root}`;
      if (!existsSync(rootPath) || !statSync(rootPath).isDirectory()) {
         return [];
      }
      return readdirSync(rootPath).flatMap((entry) => {
         const packageDirectory = `${rootPath}/${entry}`;
         const packageJsonPath = `${packageDirectory}/package.json`;
         return existsSync(packageJsonPath) &&
            statSync(packageDirectory).isDirectory()
            ? [normalizePath(relative(rootDirectory, packageDirectory))]
            : [];
      });
   });

const collectWorkspacePackages = (
   rootDirectory = process.cwd(),
): readonly WorkspacePackage[] =>
   packageDirectories(rootDirectory).flatMap((directory) => {
      const layer = layerForDirectory(directory);
      if (layer === undefined) {
         return [];
      }

      const packageJson = readJsonObject(
         `${rootDirectory}/${directory}/package.json`,
      );
      if (packageJson === undefined || typeof packageJson.name !== "string") {
         return [];
      }

      return [
         {
            dependencies: workspaceDependencyNames(packageJson.dependencies),
            devDependencies: workspaceDependencyNames(
               packageJson.devDependencies,
            ),
            directory,
            layer,
            name: packageJson.name,
         },
      ];
   });

const dependencyDiagnostics = (
   workspacePackage: WorkspacePackage,
   packagesByName: ReadonlyMap<string, WorkspacePackage>,
): readonly WorkspaceLayerDiagnostic[] =>
   workspacePackage.dependencies.flatMap((dependencyName) => {
      const dependency = packagesByName.get(dependencyName);
      if (dependency === undefined) {
         return [];
      }

      if (
         allowedDependencyLayers[workspacePackage.layer].includes(
            dependency.layer,
         )
      ) {
         return [];
      }

      return [
         {
            path: `${workspacePackage.directory}/package.json`,
            message: `${workspacePackage.name} is a ${workspacePackage.layer} package and cannot depend on ${dependency.name} (${dependency.layer}).`,
         },
      ];
   });

const shouldSkipSourcePath = (path: string): boolean => {
   const normalized = normalizePath(path);
   const segments = normalized.split("/");
   return (
      segments.some((segment) => skippedSourceSegments[segment] === true) ||
      skippedSourceSuffixes.some((suffix) => normalized.endsWith(suffix))
   );
};

const sourceFilePaths = (directory: string): readonly string[] => {
   if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      return [];
   }

   return readdirSync(directory).flatMap((entry) => {
      const path = `${directory}/${entry}`;
      const normalized = normalizePath(path);
      if (shouldSkipSourcePath(normalized)) {
         return [];
      }

      const stats = statSync(normalized);
      if (stats.isDirectory()) {
         return sourceFilePaths(normalized);
      }
      if (!stats.isFile()) {
         return [];
      }

      const dot = entry.lastIndexOf(".");
      const extension = dot === -1 ? "" : entry.slice(dot);
      return sourceExtensions[extension] === true ? [normalized] : [];
   });
};

const importSpecifiers = (source: string): readonly string[] => {
   const specifiers = new Set<string>();
   for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (specifier !== undefined) {
         specifiers.add(specifier);
      }
   }
   return [...specifiers];
};

const packageForRelativePath = (
   packages: readonly WorkspacePackage[],
   path: string,
): WorkspacePackage | undefined =>
   packages.find(
      (workspacePackage) =>
         path === workspacePackage.directory ||
         path.startsWith(`${workspacePackage.directory}/`),
   );

const packageForImportSpecifier = (
   packages: readonly WorkspacePackage[],
   specifier: string,
): WorkspacePackage | undefined =>
   packages
      .filter(
         (workspacePackage) =>
            specifier === workspacePackage.name ||
            specifier.startsWith(`${workspacePackage.name}/`),
      )
      .sort((left, right) => right.name.length - left.name.length)[0];

const isTestPath = (path: string): boolean =>
   path.includes("/__tests__/") ||
   path.includes(".test.") ||
   path.includes(".spec.") ||
   path.startsWith("apps/web-e2e/");

const packageImportDiagnostics = (
   workspacePackage: WorkspacePackage,
   importedPackage: WorkspacePackage,
   sourcePath: string,
): readonly WorkspaceLayerDiagnostic[] => {
   if (importedPackage.name === workspacePackage.name) {
      return [];
   }

   const allowedDependencyNames = isTestPath(sourcePath)
      ? [...workspacePackage.dependencies, ...workspacePackage.devDependencies]
      : workspacePackage.dependencies;
   const diagnostics: WorkspaceLayerDiagnostic[] = [];

   if (!allowedDependencyNames.includes(importedPackage.name)) {
      diagnostics.push({
         path: sourcePath,
         message: `${workspacePackage.name} imports ${importedPackage.name} without declaring it in package.json.`,
      });
   }

   if (
      !isTestPath(sourcePath) &&
      !allowedDependencyLayers[workspacePackage.layer].includes(
         importedPackage.layer,
      )
   ) {
      diagnostics.push({
         path: sourcePath,
         message: `${workspacePackage.name} is a ${workspacePackage.layer} package and cannot import ${importedPackage.name} (${importedPackage.layer}).`,
      });
   }

   return diagnostics;
};

const relativeImportDiagnostics = (
   rootDirectory: string,
   workspacePackage: WorkspacePackage,
   packages: readonly WorkspacePackage[],
   sourcePath: string,
   specifier: string,
): readonly WorkspaceLayerDiagnostic[] => {
   if (!specifier.startsWith(".") || isTestPath(sourcePath)) {
      return [];
   }

   const resolvedImport = normalizePath(
      relative(
         rootDirectory,
         resolve(rootDirectory, dirname(sourcePath), specifier),
      ),
   );
   const importedPackage = packageForRelativePath(packages, resolvedImport);
   if (
      importedPackage === undefined ||
      importedPackage.name === workspacePackage.name
   ) {
      return [];
   }

   return [
      {
         path: sourcePath,
         message: `${workspacePackage.name} reaches into ${importedPackage.name} through a relative import; import the package entry point instead.`,
      },
   ];
};

const importDiagnostics = (
   rootDirectory: string,
   workspacePackage: WorkspacePackage,
   packages: readonly WorkspacePackage[],
): readonly WorkspaceLayerDiagnostic[] =>
   sourceFilePaths(`${rootDirectory}/${workspacePackage.directory}`).flatMap(
      (absoluteSourcePath) => {
         const sourcePath = normalizePath(
            relative(rootDirectory, absoluteSourcePath),
         );
         const source = readFileSync(absoluteSourcePath, "utf8");
         return importSpecifiers(source).flatMap((specifier) => {
            const importedPackage = packageForImportSpecifier(
               packages,
               specifier,
            );
            return importedPackage === undefined
               ? relativeImportDiagnostics(
                    rootDirectory,
                    workspacePackage,
                    packages,
                    sourcePath,
                    specifier,
                 )
               : packageImportDiagnostics(
                    workspacePackage,
                    importedPackage,
                    sourcePath,
                 );
         });
      },
   );

const dedupeDiagnostics = (
   diagnostics: readonly WorkspaceLayerDiagnostic[],
): readonly WorkspaceLayerDiagnostic[] => {
   const seen = new Set<string>();
   return diagnostics.filter((diagnostic) => {
      const key = `${diagnostic.path}\u0000${diagnostic.message}`;
      if (seen.has(key)) {
         return false;
      }
      seen.add(key);
      return true;
   });
};

export const collectWorkspaceLayerDiagnostics = (
   rootDirectory = process.cwd(),
): readonly WorkspaceLayerDiagnostic[] => {
   const packages = collectWorkspacePackages(rootDirectory);
   const packagesByName = new Map(
      packages.map((workspacePackage) => [
         workspacePackage.name,
         workspacePackage,
      ]),
   );

   return dedupeDiagnostics(
      packages.flatMap((workspacePackage) => [
         ...dependencyDiagnostics(workspacePackage, packagesByName),
         ...importDiagnostics(rootDirectory, workspacePackage, packages),
      ]),
   );
};

export const runWorkspaceLayerChecks = (
   rootDirectory = process.cwd(),
): boolean => {
   const diagnostics = collectWorkspaceLayerDiagnostics(rootDirectory);
   for (const diagnostic of diagnostics) {
      console.error(`${diagnostic.path}:1: ${diagnostic.message}`);
      console.error(
         "Workspace layer check failed. Keep internal package imports declared and aligned with the monorepo layer graph.",
      );
   }
   return diagnostics.length > 0;
};
