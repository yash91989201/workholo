import {
  existsSync,
  mkdirSync,
  readFileSync,
  watch,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateWorkspaceModels } from "../schema-generator/index";
import { collectTsFiles, discoverWorkspaces } from "../shared/workspaces";

export interface GenerationSummary {
  generated: string[];
  skipped: string[];
  unchanged: string[];
}

export interface Scheduler {
  clearTimeout: (handle: unknown) => void;
  setTimeout: (callback: () => void, ms?: number) => unknown;
}

export type CreateWatcher = (
  path: string,
  options: { recursive: true },
  listener: (eventType: string, filename: string | Buffer | null) => void
) => { close: () => void };

export interface WatchOptions {
  createWatcher?: CreateWatcher;
  debounceMs?: number;
  initial?: boolean;
  onError?: (error: unknown) => void;
  onEvent?: (event: {
    eventType: string;
    filename: string | null;
    workspace: string;
  }) => void;
  onSummary?: (summary: GenerationSummary) => void;
  scheduler?: Scheduler;
}

export interface TypeWatcher {
  close: () => void;
  regenerate: () => GenerationSummary;
  readonly watchers: ReadonlyMap<string, { close: () => void }>;
}

type TimerHandle = ReturnType<Scheduler["setTimeout"]>;

const DEFAULT_SCHEDULER: Scheduler = {
  clearTimeout: (handle) => {
    Reflect.apply(globalThis.clearTimeout, globalThis, [handle]);
  },
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
};

const DEFAULT_CREATE_WATCHER: CreateWatcher = (target, options, listener) =>
  watch(target, options, listener);

const TYPE_SOURCE_DIRS = ["schemas", "models"] as const;

function getTypeSourceDirs(rootDir: string): string[] {
  const workspaces = discoverWorkspaces(rootDir);
  const dirs: string[] = [];
  for (const workspace of workspaces) {
    for (const dirName of TYPE_SOURCE_DIRS) {
      const dir = path.join(rootDir, workspace, "src", "lib", dirName);
      if (existsSync(dir)) {
        dirs.push(dir);
      }
    }
  }
  return dirs;
}

const HEADER = "// AUTO-GENERATED FILE. DO NOT EDIT.";

const SCHEMA_EXPORT_REGEX =
  /export\s+const\s+(\w+(?:Schema|Input|Output))\s*=/g;
const TS_EXTENSION_REGEX = /\.ts$/;
const LINE_WIDTH = 80;

function extractSchemaNames(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(SCHEMA_EXPORT_REGEX)) {
    const [, schemaName] = match;
    if (!schemaName) {
      continue;
    }
    names.push(schemaName);
  }
  return names;
}

function toTypeName(schemaName: string): string {
  if (schemaName.endsWith("Schema")) {
    return `${schemaName.slice(0, -"Schema".length)}Type`;
  }
  return `${schemaName}Type`;
}

function formatImport(moduleSpecifier: string, schemaNames: string[]): string {
  const sortedNames = [...schemaNames].sort((a, b) => a.localeCompare(b));
  const singleLine = `import type { ${sortedNames.join(", ")} } from "${moduleSpecifier}";`;
  if (sortedNames.length <= 1 || singleLine.length <= LINE_WIDTH) {
    return singleLine;
  }
  return `import type {\n  ${sortedNames.join(",\n  ")},\n} from "${moduleSpecifier}";`;
}

interface SchemaEntry {
  file: string;
  schema: string;
}

function generateTypesText(
  workspace: string,
  workspaceAbsPath: string
): string {
  const libDir = path.join(workspaceAbsPath, "src", "lib");

  const seenSchema = new Map<string, string>();
  const seenType = new Map<string, SchemaEntry>();
  const byModule = new Map<string, string[]>();

  for (const dirName of TYPE_SOURCE_DIRS) {
    const sourceDir = path.join(libDir, dirName);
    if (!existsSync(sourceDir)) {
      continue;
    }
    const relFiles = collectTsFiles(sourceDir)
      .map((file) => path.relative(sourceDir, file).split(path.sep).join("/"))
      .sort((a, b) => a.localeCompare(b));

    for (const relFile of relFiles) {
      const filePath = path.join(sourceDir, relFile);
      const content = readFileSync(filePath, "utf-8");
      const moduleSpecifier = `./${dirName}/${relFile.replace(TS_EXTENSION_REGEX, "")}`;
      const errorFilePath = `${workspace}/src/lib/${dirName}/${relFile}`;

      const names = extractSchemaNames(content);
      for (const schemaName of names) {
        const firstFile = seenSchema.get(schemaName);
        if (firstFile !== undefined) {
          throw new Error(
            `Duplicate schema export "${schemaName}" in workspace ${workspace}: ${firstFile} and ${errorFilePath}`
          );
        }
        seenSchema.set(schemaName, errorFilePath);

        const typeName = toTypeName(schemaName);
        const existingType = seenType.get(typeName);
        if (existingType) {
          throw new Error(
            `Duplicate generated type "${typeName}" in workspace ${workspace}: from ${existingType.schema} (${existingType.file}) and ${schemaName} (${errorFilePath})`
          );
        }
        seenType.set(typeName, { file: errorFilePath, schema: schemaName });

        const list = byModule.get(moduleSpecifier) ?? [];
        list.push(schemaName);
        byModule.set(moduleSpecifier, list);
      }
    }
  }

  if (seenSchema.size === 0) {
    return `${HEADER}\n`;
  }

  const sortedModules = [...byModule.keys()].sort((a, b) => a.localeCompare(b));
  const importLines: string[] = [];
  for (const moduleSpecifier of sortedModules) {
    const names = byModule.get(moduleSpecifier) ?? [];
    importLines.push(formatImport(moduleSpecifier, names));
  }

  const sortedTypeNames = [...seenType.keys()].sort((a, b) =>
    a.localeCompare(b)
  );
  const declLines = sortedTypeNames.map((typeName) => {
    const entry = seenType.get(typeName);
    return `export type ${typeName} = z.infer<typeof ${entry?.schema ?? ""}>;`;
  });

  return [
    HEADER,
    `import type { z } from "zod";`,
    ...importLines,
    "",
    ...declLines,
    "",
  ].join("\n");
}

export function generateWorkspaceTypes(rootDir: string): GenerationSummary {
  const workspaces = discoverWorkspaces(rootDir);

  const generated: string[] = [];
  const unchanged: string[] = [];
  const skipped: string[] = [];

  for (const workspace of workspaces) {
    const workspaceAbsPath = path.join(rootDir, workspace);
    const libDir = path.join(workspaceAbsPath, "src", "lib");
    const hasSource = TYPE_SOURCE_DIRS.some((dirName) =>
      existsSync(path.join(libDir, dirName))
    );
    if (!hasSource) {
      skipped.push(workspace);
      continue;
    }

    const outputText = generateTypesText(workspace, workspaceAbsPath);
    const outputPath = path.join(workspaceAbsPath, "src", "lib", "types.ts");

    let existing = "";
    if (existsSync(outputPath)) {
      existing = readFileSync(outputPath, "utf-8");
    }

    if (existing === outputText) {
      unchanged.push(workspace);
    } else {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, outputText);
      generated.push(workspace);
    }
  }

  generated.sort((a, b) => a.localeCompare(b));
  unchanged.sort((a, b) => a.localeCompare(b));
  skipped.sort((a, b) => a.localeCompare(b));

  return { generated, skipped, unchanged };
}

export function parseCliArgs(argv: string[]): {
  watch: boolean;
  debounceMs: number;
} {
  let watchMode = false;
  let debounceMs = 200;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--watch" || arg === "-w") {
      watchMode = true;
      continue;
    }
    if (
      (arg === "--debounce" || arg === "--debounce-ms") &&
      i + 1 < argv.length
    ) {
      const next = argv[i + 1];
      if (typeof next === "string") {
        const parsed = Number.parseInt(next, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          debounceMs = parsed;
        }
      }
    }
  }
  return { debounceMs, watch: watchMode };
}

export function watchWorkspaceTypes(
  rootDir: string,
  options?: WatchOptions
): TypeWatcher {
  const {
    initial = true,
    debounceMs = 200,
    onEvent,
    onError,
    onSummary,
    createWatcher = DEFAULT_CREATE_WATCHER,
    scheduler = DEFAULT_SCHEDULER,
  } = options ?? {};

  const watcherMap = new Map<string, { close: () => void }>();
  let timer: TimerHandle | undefined;
  let closed = false;

  function regenerateInternal(): GenerationSummary {
    if (closed) {
      return { generated: [], skipped: [], unchanged: [] };
    }
    try {
      const summary = generateWorkspaceTypes(rootDir);
      if (onSummary) {
        onSummary(summary);
      }
      syncWatchers();
      return summary;
    } catch (error) {
      const handler = onError ?? ((err) => console.error(err));
      handler(error);
      // Keep watching; sync so newly added/removed schemas dirs are tracked.
      syncWatchers();
      return { generated: [], skipped: [], unchanged: [] };
    }
  }

  function syncWatchers(): void {
    const dirs = getTypeSourceDirs(rootDir);
    const nextSet = new Set(dirs);
    for (const [dir, w] of watcherMap) {
      if (!nextSet.has(dir)) {
        w.close();
        watcherMap.delete(dir);
      }
    }
    for (const dir of dirs) {
      if (watcherMap.has(dir)) {
        continue;
      }
      const w = createWatcher(
        dir,
        { recursive: true },
        (eventType, filename) => {
          if (closed) {
            return;
          }
          const normalizedFilename = Buffer.isBuffer(filename)
            ? filename.toString("utf-8")
            : filename;
          if (onEvent) {
            const workspace = path
              .relative(rootDir, path.resolve(dir, "../../.."))
              .split(path.sep)
              .join("/");
            onEvent({
              eventType,
              filename: normalizedFilename,
              workspace,
            });
          }
          if (timer !== undefined) {
            scheduler.clearTimeout(timer);
            timer = undefined;
          }
          if (closed) {
            return;
          }
          timer = scheduler.setTimeout(() => {
            timer = undefined;
            regenerateInternal();
          }, debounceMs);
        }
      );
      watcherMap.set(dir, w);
    }
  }

  if (initial) {
    regenerateInternal();
  } else {
    syncWatchers();
  }

  return {
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      if (timer !== undefined) {
        scheduler.clearTimeout(timer);
        timer = undefined;
      }
      for (const w of watcherMap.values()) {
        w.close();
      }
      watcherMap.clear();
    },
    regenerate: () => regenerateInternal(),
    get watchers() {
      return watcherMap;
    },
  };
}

function isMainModule(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, "../..");
  const { watch: watchMode, debounceMs } = parseCliArgs(process.argv);

  try {
    generateWorkspaceModels(rootDir);
  } catch (error) {
    console.error(error);
  }

  if (watchMode) {
    const watcher = watchWorkspaceTypes(rootDir, {
      debounceMs,
      onSummary: (summary) => {
        console.log("Generated:", summary.generated);
        console.log("Unchanged:", summary.unchanged);
        console.log("Skipped:", summary.skipped);
      },
    });
    console.log("Watching for schema changes...");

    const shutdown = () => {
      watcher.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    try {
      const summary = generateWorkspaceTypes(rootDir);
      console.log("Generated:", summary.generated);
      console.log("Unchanged:", summary.unchanged);
      console.log("Skipped:", summary.skipped);
    } catch (err) {
      console.error(err);
      process.exitCode = 1;
    }
  }
}
