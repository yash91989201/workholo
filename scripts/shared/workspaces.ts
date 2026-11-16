import { globSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TS_EXTENSION_REGEX = /\.ts$/;
const DECLARATION_FILE_REGEX = /\.d\.ts$/;
const TSX_EXTENSION_REGEX = /\.tsx$/;

const WORKSPACES_ERROR =
	"Root package.json must define workspaces as a string array or workspaces.packages as a string array";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		throw new Error(WORKSPACES_ERROR);
	}
	for (const item of value) {
		if (typeof item !== "string") {
			throw new Error(WORKSPACES_ERROR);
		}
	}
	return value;
}

function getWorkspacePatterns(rootDir: string): string[] {
	const pkgPath = path.join(rootDir, "package.json");
	const raw: unknown = JSON.parse(readFileSync(pkgPath, "utf-8"));
	if (!isPlainObject(raw)) {
		throw new Error(WORKSPACES_ERROR);
	}
	const { workspaces } = raw;
	if (workspaces === undefined) {
		throw new Error(WORKSPACES_ERROR);
	}
	if (Array.isArray(workspaces)) {
		return readStringArray(workspaces);
	}
	if (isPlainObject(workspaces)) {
		const { packages } = workspaces;
		if (packages === undefined) {
			throw new Error(WORKSPACES_ERROR);
		}
		return readStringArray(packages);
	}
	throw new Error(WORKSPACES_ERROR);
}

function normalizePattern(pattern: string): string {
	let p = pattern;
	if (p.startsWith("./")) {
		p = p.slice(2);
	}
	if (p.endsWith("/")) {
		p = p.slice(0, -1);
	}
	return p;
}

export function discoverWorkspaces(rootDir: string): string[] {
	const patterns = getWorkspacePatterns(rootDir);
	const positiveManifestPatterns: string[] = [];
	const exclusionManifestPatterns: string[] = [];
	for (const raw of patterns) {
		const negative = raw.startsWith("!");
		const stripped = negative ? raw.slice(1) : raw;
		const normalized = normalizePattern(stripped);
		const manifestPattern = `${normalized}/package.json`;
		if (negative) {
			exclusionManifestPatterns.push(manifestPattern);
		} else {
			positiveManifestPatterns.push(manifestPattern);
		}
	}

	const manifestPathSet = new Set<string>();
	for (const pattern of positiveManifestPatterns) {
		const matches = globSync(pattern, {
			cwd: rootDir,
			exclude: exclusionManifestPatterns,
		});
		if (matches.length === 0) {
			console.warn(
				`! Workspace pattern "${pattern}" matched no manifest paths`
			);
		}
		for (const match of matches) {
			manifestPathSet.add(match.split(path.sep).join("/"));
		}
	}

	const workspaceRoots = new Set<string>();
	for (const manifestPath of manifestPathSet) {
		const idx = manifestPath.lastIndexOf("/");
		if (idx < 0) {
			continue;
		}
		workspaceRoots.add(manifestPath.slice(0, idx));
	}

	return [...workspaceRoots].sort((a, b) => a.localeCompare(b));
}

export function collectTsFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...collectTsFiles(fullPath));
			continue;
		}
		if (!entry.isFile()) {
			continue;
		}
		if (!TS_EXTENSION_REGEX.test(entry.name)) {
			continue;
		}
		if (DECLARATION_FILE_REGEX.test(entry.name)) {
			continue;
		}
		if (TSX_EXTENSION_REGEX.test(entry.name)) {
			continue;
		}
		out.push(fullPath);
	}
	return out;
}
