import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scanCorpus } from "../corpus/corpus-scanner.js";
import { extractSpineFeatures } from "../corpus/spine-feature-extractor.js";
import {
  addFailedProject,
  addProjectFeatures,
  createCorpusStatisticsAccumulator,
  finalizeCorpusStatistics,
} from "../corpus/corpus-statistics.js";
import { writeKnowledgeFiles } from "../corpus/guide-generator.js";
import {
  getCorpusCacheRoot,
  getDefaultKnowledgeDir,
} from "../corpus/knowledge-loader.js";
import { runSpine } from "../services/spine-cli.js";
import type {
  CorpusProjectFile,
  FailedCorpusProject,
} from "../types/corpus-learning.js";
import { formatJson, formatToolError, textContent, validateExportSettingsPath } from "./common.js";

const schema = {
  corpusDir: z
    .string()
    .min(1)
    .describe("Directory containing real Spine .spine and .json source projects to analyze."),
  outputKnowledgeDir: z
    .string()
    .min(1)
    .optional()
    .describe("Directory where learned knowledge files should be written. Defaults to project knowledge/."),
  exportSettingsPath: z
    .string()
    .min(1)
    .optional()
    .describe("Path to a Spine export settings .json file used to export .spine corpus projects to JSON. Required for analyzing .spine files with Spine 3.8.75."),
  maxProjects: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional maximum project count for test runs before analyzing a full corpus."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Whether to overwrite existing knowledge files in outputKnowledgeDir."),
};

export function registerSpineLearnFromCorpusTool(server: McpServer): void {
  server.tool(
    "spine_learn_from_corpus",
    "Use this to build the local Spine Corpus Learning Layer. It scans .json and .spine projects, exports .spine files to .cache/corpus-json when needed, extracts naming/animation/statistical features, and writes markdown/json knowledge files. It never modifies or deletes corpus source files. Single-project failures are recorded and do not stop the batch. Do not use it for live animation generation or UI automation.",
    schema,
    async ({ corpusDir, outputKnowledgeDir, exportSettingsPath, maxProjects, overwrite }) => {
      try {
        const settingsCheck = await validateExportSettingsPath(
          exportSettingsPath,
          "spine_learn_from_corpus",
        );
        if (!settingsCheck.valid) {
          return textContent(
            formatJson({
              success: false,
              failedAt: "learn_from_corpus",
              error: settingsCheck.error,
            }),
          );
        }

        const knowledgeDir = path.resolve(outputKnowledgeDir ?? getDefaultKnowledgeDir());
        const scan = await scanCorpus(corpusDir, maxProjects);
        const accumulator = createCorpusStatisticsAccumulator();
        const warnings = [...scan.warnings];
        const hasSpineProjects = scan.projects.some((project) => project.extension === ".spine");

        if (hasSpineProjects && !exportSettingsPath) {
          warnings.push(
            "No exportSettingsPath was provided. .spine corpus projects cannot be exported to JSON with Spine 3.8.75 and will be recorded as failed projects.",
          );
        }

        for (let index = 0; index < scan.projects.length; index += 1) {
          const project = scan.projects[index];
          console.error(
            `[spine-mcp] learning ${index + 1}/${scan.projects.length}: ${project.relativePath}`,
          );

          const resolved = await resolveProjectJson(project, exportSettingsPath);
          if ("failedProject" in resolved) {
            addFailedProject(accumulator, resolved.failedProject);
            continue;
          }

          try {
            const jsonText = await readFile(resolved.jsonPath, "utf8");
            const parsed = JSON.parse(jsonText) as unknown;
            const features = extractSpineFeatures({
              projectPath: project.filePath,
              jsonPath: resolved.jsonPath,
              sourceType: project.extension,
              json: parsed,
            });
            addProjectFeatures(accumulator, features);
          } catch (error) {
            addFailedProject(accumulator, {
              projectPath: project.filePath,
              failedAt: error instanceof SyntaxError ? "parse_json" : "extract_features",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const { stats, presets, namingRules, examples } =
          finalizeCorpusStatistics(accumulator);
        const knowledgeFiles = await writeKnowledgeFiles({
          outputKnowledgeDir: knowledgeDir,
          overwrite,
          stats,
          presets,
          namingRules,
          examples,
        });

        return textContent(
          formatJson({
            success: true,
            analyzedProjectCount: stats.projectCount,
            failedProjectCount: stats.failedProjectCount,
            knowledgeFiles,
            warnings,
            failedProjects: stats.failedProjects,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, "learn_from_corpus"));
      }
    },
  );
}

async function resolveProjectJson(
  project: CorpusProjectFile,
  exportSettingsPath: string | undefined,
): Promise<{ jsonPath: string } | { failedProject: FailedCorpusProject }> {
  if (project.extension === ".json") {
    return { jsonPath: project.filePath };
  }

  const cacheDir = getCacheDirForProject(project);
  await mkdir(cacheDir, { recursive: true });
  const cachedJson = await findUsableCachedJson(cacheDir, project.mtimeMs);

  if (cachedJson) {
    return { jsonPath: cachedJson };
  }

  if (!exportSettingsPath) {
    return {
      failedProject: {
        projectPath: project.filePath,
        failedAt: "export_spine",
        error:
          "exportSettingsPath is required to export .spine corpus projects to JSON with Spine 3.8.75.",
      },
    };
  }

  const exportResult = await runSpine([
    "-i",
    project.filePath,
    "-o",
    cacheDir,
    "-e",
    exportSettingsPath,
  ]);
  if (!exportResult.success) {
    return {
      failedProject: {
        projectPath: project.filePath,
        failedAt: "export_spine",
        error: "Spine CLI export failed.",
        command: exportResult.command,
        args: exportResult.args,
        stdout: exportResult.stdout,
        stderr: exportResult.stderr,
        exitCode: exportResult.exitCode,
      },
    };
  }

  const exportedJson = await findUsableCachedJson(cacheDir, 0);
  if (!exportedJson) {
    return {
      failedProject: {
        projectPath: project.filePath,
        failedAt: "export_spine",
        error: `Spine CLI export completed, but no JSON was found in cache directory: ${cacheDir}`,
        command: exportResult.command,
        args: exportResult.args,
        stdout: exportResult.stdout,
        stderr: exportResult.stderr,
        exitCode: exportResult.exitCode,
      },
    };
  }

  return { jsonPath: exportedJson };
}

function getCacheDirForProject(project: CorpusProjectFile): string {
  const baseName = path.parse(project.fileName).name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const hash = crypto.createHash("sha1").update(project.filePath).digest("hex").slice(0, 10);
  return path.join(getCorpusCacheRoot(), `${baseName}-${hash}`);
}

async function findUsableCachedJson(
  cacheDir: string,
  sourceMtimeMs: number,
): Promise<string | undefined> {
  const jsonFiles = await findJsonFiles(cacheDir);
  const candidates: Array<{ filePath: string; mtimeMs: number; size: number }> = [];

  for (const filePath of jsonFiles) {
    const info = await stat(filePath);
    if (info.mtimeMs >= sourceMtimeMs && info.size > 0) {
      candidates.push({ filePath, mtimeMs: info.mtimeMs, size: info.size });
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.size - a.size);
  return candidates[0]?.filePath;
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await findJsonFiles(entryPath)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        results.push(entryPath);
      }
    }
  } catch {
    return [];
  }

  return results;
}
