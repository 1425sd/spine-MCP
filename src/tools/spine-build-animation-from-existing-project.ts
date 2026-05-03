import { readFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  buildPreparedExistingProjectAnimation,
  inferExistingProjectRoles,
  prepareExistingProjectJson,
  type ExistingProjectAnimationRequest,
} from "../services/existing-project-animation-service.js";
import { ensureOutputDir } from "../services/generated-project-service.js";
import {
  loadKnowledge,
  recommendAnimationParams,
} from "../corpus/knowledge-loader.js";
import { formatJson, textContent } from "./common.js";
import {
  characterTypeSchema,
  exportModeSchema,
  overwriteSchema,
  projectNameSchema,
} from "./generated-tool-schemas.js";

const DEFAULT_KNOWLEDGE_DIR = "G:\\spine-mcp\\knowledge";

const schema = {
  sourceJsonPath: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional existing Spine JSON file, for example a Photoshop to Spine exported skeleton JSON. When provided, this takes precedence over spineProjectPath.",
    ),
  spineProjectPath: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional existing .spine project. When sourceJsonPath is not provided, the tool exports this project to temporary JSON first using the Spine CLI.",
    ),
  imagesDir: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional folder containing images referenced by sourceJsonPath. When provided, it is copied to outputDir/images and the generated JSON uses that images folder.",
    ),
  outputDir: z
    .string()
    .min(1)
    .describe(
      "Directory where the modified JSON, imported .spine project, copied images, and exported files should be written.",
    ),
  projectName: projectNameSchema,
  userGoal: z
    .string()
    .min(1)
    .describe(
      "Natural-language animation goal. The tool uses this with learned corpus presets to choose simple keyframes for the existing skeleton.",
    ),
  characterType: characterTypeSchema,
  knowledgeDir: z
    .string()
    .min(1)
    .default(DEFAULT_KNOWLEDGE_DIR)
    .describe(
      "Directory containing learned knowledge files. Defaults to G:\\spine-mcp\\knowledge. If missing, built-in fallback presets are used.",
    ),
  exportMode: exportModeSchema,
  openAfterBuild: z
    .boolean()
    .default(true)
    .describe(
      "When true, open the generated .spine project after import/export without waiting for Spine to exit.",
    ),
  overwrite: overwriteSchema,
};

export function registerSpineBuildAnimationFromExistingProjectTool(server: McpServer): void {
  server.tool(
    "spine_build_animation_from_existing_project",
    "Build simple animation keyframes on top of an existing Spine JSON or .spine project. Use this for Photoshop to Spine exported JSON plus an images folder, or for an existing .spine project that should receive basic idle, breathing, blink, tail_wag, head_bob, float, logo_bounce, or paw_wave animations based on userGoal and learned corpus presets. It writes only to outputDir, imports the generated JSON into a new .spine project, exports json+atlas+png or the requested export mode, and can open the result. Do not use it for mesh binding, IK, weights, complex curve editing, UI automation, mouse/keyboard simulation, or direct .spine binary modification. If neither sourceJsonPath nor spineProjectPath is provided, it returns a clear error.",
    schema,
    async (request) => {
      let failedAt:
        | "load_knowledge"
        | "prepare_source"
        | "recommend_params"
        | "generate_json"
        | "import_json"
        | "export" = "prepare_source";

      try {
        if (!request.sourceJsonPath && !request.spineProjectPath) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              error: "Either sourceJsonPath or spineProjectPath must be provided.",
            }),
          );
        }

        const animationRequest: ExistingProjectAnimationRequest = {
          sourceJsonPath: request.sourceJsonPath,
          spineProjectPath: request.spineProjectPath,
          imagesDir: request.imagesDir,
          outputDir: request.outputDir,
          projectName: request.projectName,
          userGoal: request.userGoal,
          exportMode: request.exportMode,
          openAfterBuild: request.openAfterBuild,
          overwrite: request.overwrite,
          knowledgeDir: request.knowledgeDir,
        };

        failedAt = "load_knowledge";
        const knowledge = await loadKnowledge(request.knowledgeDir);
        const warnings = [...knowledge.warnings];

        failedAt = "prepare_source";
        const outputDir = await ensureOutputDir(
          request.outputDir,
          request.overwrite ?? false,
        );
        const prepared = await prepareExistingProjectJson({
          request: animationRequest,
          outputDir,
        });
        warnings.push(...prepared.warnings);

        const parsed = JSON.parse(await readFile(prepared.sourceJsonPath, "utf8")) as unknown;
        if (!isJsonObject(parsed)) {
          throw new Error("Source Spine JSON root must be an object.");
        }

        const roleMap = inferExistingProjectRoles(parsed);
        warnings.push(...roleMap.warnings);

        failedAt = "recommend_params";
        const recommendation = recommendAnimationParams({
          userGoal: request.userGoal,
          characterType: request.characterType,
          availableAssetRoles: roleMap.availableAssetRoles,
          presets: knowledge.presets,
          namingRules: knowledge.namingRules,
        });
        warnings.push(...recommendation.warnings);

        failedAt = "generate_json";
        const buildResult = await buildPreparedExistingProjectAnimation({
          request: animationRequest,
          outputDir,
          prepared,
          recommendation,
        });
        warnings.push(...buildResult.warnings);

        if (!buildResult.importResult.success) {
          failedAt = "import_json";
          return textContent(
            formatJson({
              success: false,
              failedAt,
              knowledgeFound: knowledge.exists,
              knowledgeDir: knowledge.knowledgeDir,
              recommendation,
              ...buildResult,
              warnings: dedupe(warnings),
            }),
          );
        }

        if (buildResult.exportResult && !buildResult.exportResult.success) {
          failedAt = "export";
          return textContent(
            formatJson({
              success: false,
              failedAt,
              knowledgeFound: knowledge.exists,
              knowledgeDir: knowledge.knowledgeDir,
              recommendation,
              ...buildResult,
              warnings: dedupe(warnings),
            }),
          );
        }

        if (buildResult.openResult && !buildResult.openResult.success) {
          warnings.push(
            "openAfterBuild was requested, but Spine did not start successfully.",
          );
        }

        return textContent(
          formatJson({
            success: true,
            knowledgeFound: knowledge.exists,
            knowledgeDir: knowledge.knowledgeDir,
            recommendation,
            ...buildResult,
            warnings: dedupe(warnings),
          }),
        );
      } catch (error) {
        return textContent(formatExistingProjectError(error, failedAt));
      }
    },
  );
}

function formatExistingProjectError(error: unknown, failedAt: string): string {
  if (error instanceof Error) {
    return formatJson({
      success: false,
      failedAt,
      error: error.message,
      spineResult: getSpineResult(error),
      stack: error.stack,
    });
  }

  return formatJson({
    success: false,
    failedAt,
    error: String(error),
  });
}

function getSpineResult(error: Error): unknown {
  const maybeWithResult = error as Error & { spineResult?: unknown };
  return maybeWithResult.spineResult;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
