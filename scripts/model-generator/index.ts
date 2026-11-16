import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	watch,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectTsFiles, discoverWorkspaces } from "../shared/workspaces";

export interface ModelSummary {
	generated: string[];
	skipped: string[];
	unchanged: string[];
}

export interface ModelWatcher {
	close: () => void;
	regenerate: () => ModelSummary;
}

const HEADER = "// AUTO-GENERATED FILE. DO NOT EDIT.";
const TS_EXTENSION_REGEX = /\.ts$/;
const LINE_WIDTH = 80;
const TABLE_DECLARATION_REGEX =
	/export\s+const\s+(\w+)\s*=\s*pgTable(?:<[^>\n]*>)?\s*\(/g;
const DRIZZLE_ZOD_EXPORTS = [
	"createInsertSchema",
	"createSelectSchema",
	"createUpdateSchema",
];

export function extractTableNames(content: string): string[] {
	const names: string[] = [];
	for (const match of content.matchAll(TABLE_DECLARATION_REGEX)) {
		const [, tableName] = match;
		if (tableName) {
			names.push(tableName);
		}
	}
	return names;
}

export function toPascalCase(value: string): string {
	return value
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function formatImport(moduleSpecifier: string, names: string[]): string {
	const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
	const singleLine = `import { ${sortedNames.join(", ")} } from "${moduleSpecifier}";`;
	if (singleLine.length <= LINE_WIDTH) {
		return singleLine;
	}
	return `import {\n\t${sortedNames.join(",\n\t")},\n} from "${moduleSpecifier}";`;
}

export function buildModelSource(
	moduleSpecifier: string,
	tableNames: string[]
): string {
	const sortedTables = [...tableNames].sort((a, b) => a.localeCompare(b));
	const blocks = sortedTables.map((tableName) => {
		const base = toPascalCase(tableName);
		return [
			`export const ${base}ModelSchema = createSelectSchema(${tableName});`,
			`export const ${base}InsertSchema = createInsertSchema(${tableName});`,
			`export const ${base}UpdateSchema = createUpdateSchema(${tableName});`,
		].join("\n");
	});
	return [
		HEADER,
		formatImport("drizzle-zod", DRIZZLE_ZOD_EXPORTS),
		formatImport(moduleSpecifier, sortedTables),
		"",
		blocks.join("\n\n"),
		"",
	].join("\n");
}

function cleanupStaleModels(modelsDir: string, expected: Set<string>): number {
	if (!existsSync(modelsDir)) {
		return 0;
	}
	let removed = 0;
	for (const file of collectTsFiles(modelsDir)) {
		if (expected.has(file)) {
			continue;
		}
		if (readFileSync(file, "utf-8").startsWith(HEADER)) {
			rmSync(file);
			removed += 1;
		}
	}
	return removed;
}

function toModuleSpecifier(fromFile: string, toFile: string): string {
	const relative = path
		.relative(path.dirname(fromFile), toFile)
		.replace(TS_EXTENSION_REGEX, "")
		.split(path.sep)
		.join("/");
	return relative.startsWith(".") ? relative : `./${relative}`;
}

export function generateWorkspaceModels(rootDir: string): ModelSummary {
	const workspaces = discoverWorkspaces(rootDir);

	const generated: string[] = [];
	const unchanged: string[] = [];
	const skipped: string[] = [];

	for (const workspace of workspaces) {
		const workspaceAbsPath = path.join(rootDir, workspace);
		const schemaDir = path.join(workspaceAbsPath, "src", "schema");
		if (!existsSync(schemaDir)) {
			skipped.push(workspace);
			continue;
		}

		const modelsDir = path.join(workspaceAbsPath, "src", "lib", "models");
		const expected = new Set<string>();
		const seenModel = new Map<string, string>();
		let changed = false;

		for (const schemaFile of collectTsFiles(schemaDir)) {
			const relFile = path
				.relative(schemaDir, schemaFile)
				.split(path.sep)
				.join("/");
			const tableNames = extractTableNames(
				readFileSync(schemaFile, "utf-8")
			);
			if (tableNames.length === 0) {
				continue;
			}

			for (const tableName of tableNames) {
				const base = toPascalCase(tableName);
				const firstFile = seenModel.get(base);
				if (firstFile !== undefined) {
					throw new Error(
						`Duplicate model "${base}" in workspace ${workspace}: ${firstFile} and ${workspace}/src/schema/${relFile}`
					);
				}
				seenModel.set(base, `${workspace}/src/schema/${relFile}`);
			}

			const outputPath = path.join(modelsDir, relFile);
			const outputText = buildModelSource(
				toModuleSpecifier(outputPath, schemaFile),
				tableNames
			);
			expected.add(outputPath);

			const existing = existsSync(outputPath)
				? readFileSync(outputPath, "utf-8")
				: "";
			if (existing !== outputText) {
				mkdirSync(path.dirname(outputPath), { recursive: true });
				writeFileSync(outputPath, outputText);
				changed = true;
			}
		}

		const removed = cleanupStaleModels(modelsDir, expected);
		if (removed > 0) {
			changed = true;
		}

		if (changed) {
			generated.push(workspace);
		} else {
			unchanged.push(workspace);
		}
	}

	generated.sort((a, b) => a.localeCompare(b));
	unchanged.sort((a, b) => a.localeCompare(b));
	skipped.sort((a, b) => a.localeCompare(b));

	return { generated, skipped, unchanged };
}

function getSchemaDirs(rootDir: string): string[] {
	const dirs: string[] = [];
	for (const workspace of discoverWorkspaces(rootDir)) {
		const schemaDir = path.join(rootDir, workspace, "src", "schema");
		if (existsSync(schemaDir)) {
			dirs.push(schemaDir);
		}
	}
	return dirs;
}

export function watchWorkspaceModels(
	rootDir: string,
	options?: {
		debounceMs?: number;
		onError?: (error: unknown) => void;
		onSummary?: (summary: ModelSummary) => void;
	}
): ModelWatcher {
	const { debounceMs = 200, onError, onSummary } = options ?? {};
	const watchers = new Map<string, { close: () => void }>();
	let timer: NodeJS.Timeout | undefined;
	let closed = false;

	const syncWatchers = (): void => {
		const dirs = new Set(getSchemaDirs(rootDir));
		for (const [dir, watcher] of watchers) {
			if (!dirs.has(dir)) {
				watcher.close();
				watchers.delete(dir);
			}
		}
		for (const dir of dirs) {
			if (watchers.has(dir)) {
				continue;
			}
			watchers.set(
				dir,
				watch(dir, { recursive: true }, () => {
					if (closed) {
						return;
					}
					if (timer !== undefined) {
						clearTimeout(timer);
					}
					timer = setTimeout(() => {
						timer = undefined;
						regenerate();
					}, debounceMs);
				})
			);
		}
	};

	const regenerate = (): ModelSummary => {
		if (closed) {
			return { generated: [], skipped: [], unchanged: [] };
		}
		try {
			const summary = generateWorkspaceModels(rootDir);
			onSummary?.(summary);
			syncWatchers();
			return summary;
		} catch (error) {
			(onError ?? ((err) => console.error(err)))(error);
			syncWatchers();
			return { generated: [], skipped: [], unchanged: [] };
		}
	};

	regenerate();

	return {
		close: () => {
			if (closed) {
				return;
			}
			closed = true;
			if (timer !== undefined) {
				clearTimeout(timer);
				timer = undefined;
			}
			for (const watcher of watchers.values()) {
				watcher.close();
			}
			watchers.clear();
		},
		regenerate,
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
	const watchMode = process.argv.includes("--watch") || process.argv.includes("-w");

	const logSummary = (summary: ModelSummary): void => {
		console.log("Generated models:", summary.generated);
		console.log("Unchanged models:", summary.unchanged);
		console.log("Skipped models:", summary.skipped);
	};

	if (watchMode) {
		const watcher = watchWorkspaceModels(rootDir, { onSummary: logSummary });
		console.log("Watching for db schema changes...");
		const shutdown = (): void => {
			watcher.close();
			process.exit(0);
		};
		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);
	} else {
		try {
			logSummary(generateWorkspaceModels(rootDir));
		} catch (error) {
			console.error(error);
			process.exitCode = 1;
		}
	}
}
