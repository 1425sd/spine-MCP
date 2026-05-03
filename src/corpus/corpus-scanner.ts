import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CorpusProjectFile, CorpusScanResult } from "../types/corpus-learning.js";

const SUPPORTED_EXTENSIONS = new Set([".json", ".spine"]);
const IGNORED_DIRS = new Set([
  ".git",
  ".cache",
  "node_modules",
  "build",
  "knowledge",
]);

export async function scanCorpus(
  corpusDir: string,
  maxProjects?: number,
): Promise<CorpusScanResult> {
  const resolvedCorpusDir = path.resolve(corpusDir);
  const warnings: string[] = [];

  if (!(await isDirectory(resolvedCorpusDir))) {
    throw new Error(`corpusDir does not exist or is not a directory: ${resolvedCorpusDir}`);
  }

  const discoveredProjects: CorpusProjectFile[] = [];
  await walkCorpus(resolvedCorpusDir, resolvedCorpusDir, discoveredProjects);
  const projects = dedupePairedSpineJson(discoveredProjects).slice(
    0,
    maxProjects,
  );

  const spineFileCount = projects.filter(
    (project) => project.extension === ".spine",
  ).length;
  const jsonFileCount = projects.filter(
    (project) => project.extension === ".json",
  ).length;

  if (projects.length === 0) {
    warnings.push(`No .spine or .json files were found in ${resolvedCorpusDir}.`);
  }

  return {
    corpusDir: resolvedCorpusDir,
    totalFiles: projects.length,
    spineFileCount,
    jsonFileCount,
    projects,
    warnings,
  };
}

async function walkCorpus(
  rootDir: string,
  currentDir: string,
  projects: CorpusProjectFile[],
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walkCorpus(rootDir, entryPath, projects);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    const info = await stat(entryPath);
    projects.push({
      filePath: entryPath,
      relativePath: path.relative(rootDir, entryPath),
      fileName: entry.name,
      extension: extension as ".json" | ".spine",
      sizeBytes: info.size,
      mtimeMs: info.mtimeMs,
    });
  }
}

function dedupePairedSpineJson(projects: CorpusProjectFile[]): CorpusProjectFile[] {
  const dirsWithJson = new Set(
    projects
      .filter((project) => project.extension === ".json")
      .map((project) => path.dirname(project.relativePath).toLowerCase()),
  );
  const byProjectKey = new Map<string, CorpusProjectFile>();

  for (const project of projects) {
    if (
      project.extension === ".spine" &&
      dirsWithJson.has(path.dirname(project.relativePath).toLowerCase())
    ) {
      continue;
    }

    const key = project.relativePath
      .slice(0, -path.extname(project.relativePath).length)
      .toLowerCase();
    const existing = byProjectKey.get(key);

    if (!existing) {
      byProjectKey.set(key, project);
      continue;
    }

    if (existing.extension === ".spine" && project.extension === ".json") {
      byProjectKey.set(key, project);
    }
  }

  return [...byProjectKey.values()].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );
}

async function isDirectory(inputPath: string): Promise<boolean> {
  try {
    const info = await stat(inputPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}
