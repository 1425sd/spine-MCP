import {
  copyFile,
  mkdir,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeSpineJsonFile } from "../json/analyze-spine-json.js";
import {
  generateAnimationJson,
  writeJsonAnimationManifest,
} from "../json/animation-writer.js";
import type { JsonAnimationKind } from "../json/types.js";
import {
  loadKnowledge,
  recommendAnimationParams,
} from "../corpus/knowledge-loader.js";
import { createExportOutputDir, ensureOutputDir } from "../services/generated-project-service.js";
import { runSpine } from "../services/spine-cli.js";
import { formatJson, formatToolError, textContent, validateExportSettingsPath } from "./common.js";
import { overwriteSchema, projectNameSchema } from "./generated-tool-schemas.js";

const DEFAULT_KNOWLEDGE_DIR = "G:\\spine-mcp\\knowledge";

const schema = {
  sourceJsonPath: z
    .string()
    .min(1)
    .describe("Source Spine JSON file to analyze and animate. It is preserved unchanged."),
  imagesDir: z
    .string()
    .min(1)
    .optional()
    .describe("Optional folder containing images referenced by the JSON. When provided, it is copied to outputDir/images and packed."),
  outputDir: z
    .string()
    .min(1)
    .describe("Directory where animated JSON, .spine project, dist export, atlas/png pack, and manifest are written."),
  projectName: projectNameSchema,
  userGoal: z
    .string()
    .min(1)
    .describe("Natural-language goal used to select basic animation timelines."),
  animationName: z
    .string()
    .min(1)
    .optional()
    .describe('Optional animation name. Defaults to "generated_loop".'),
  characterType: z
    .string()
    .min(1)
    .optional()
    .describe('Optional character hint such as "cat", "mascot", "logo", or "generic".'),
  exportMode: z
    .string()
    .min(1)
    .default("json+pack")
    .describe('Spine export mode passed to -e. Defaults to "json+pack".'),
  openAfterBuild: z
    .boolean()
    .default(true)
    .describe("When true, open the generated .spine project after import/export without waiting for Spine to exit."),
  overwrite: overwriteSchema,
  knowledgeDir: z
    .string()
    .min(1)
    .default(DEFAULT_KNOWLEDGE_DIR)
    .describe("Directory containing learned knowledge files. Defaults to G:\\spine-mcp\\knowledge. Missing knowledge falls back to built-in defaults."),
};

export function registerSpineBuildAnimationFromJsonTool(server: McpServer): void {
  server.tool(
    "spine_build_animation_from_json",
    "One-step JSON animation pipeline: analyze source JSON, generate animated copy, import to .spine, optionally pack images, export, and open. Use for Photoshop-to-Spine JSON plus images. Not for .spine sources, mesh, IK, weights, or UI automation.",
    schema,
    async (request) => {
      let failedAt:
        | "analyze_json"
        | "generate_json"
        | "import_json"
        | "pack_textures"
        | "export"
        | "open_project" = "analyze_json";

      try {
        const outputDir = await ensureOutputDir(
          request.outputDir,
          request.overwrite ?? false,
        );
        const exportOutputDir = await createExportOutputDir(outputDir);
        const animatedJsonPath = path.join(outputDir, `${request.projectName}.animated.json`);
        const projectPath = path.join(outputDir, `${request.projectName}.spine`);
        const warnings: string[] = [];

        failedAt = "analyze_json";
        const analysis = await analyzeSpineJsonFile(request.sourceJsonPath);
        warnings.push(...analysis.warnings);

        const knowledge = await loadKnowledge(request.knowledgeDir);
        warnings.push(...knowledge.warnings);
        const recommendation = recommendAnimationParams({
          userGoal: request.userGoal,
          characterType: normalizeKnownCharacterType(request.characterType),
          availableAssetRoles: Object.keys(analysis.inferredRoles),
          presets: knowledge.presets,
          namingRules: knowledge.namingRules,
        });
        warnings.push(...recommendation.warnings);

        const copiedImagesDir = request.imagesDir
          ? await copyImagesForBuild(request.imagesDir, outputDir)
          : undefined;
        if (!copiedImagesDir) {
          warnings.push(
            "No imagesDir was provided. Spine import will rely on image paths already present in the source JSON.",
          );
        }

        failedAt = "generate_json";
        const selectedKinds = mapRecommendedKinds(recommendation.recommendedAnimations);
        const generated = await generateAnimationJson({
          sourceJsonPath: request.sourceJsonPath,
          outputJsonPath: animatedJsonPath,
          userGoal: request.userGoal,
          animationName: request.animationName ?? "generated_loop",
          duration: recommendation.recommendedDuration || 2,
          loop: true,
          characterType: request.characterType,
          selectedKinds,
          overwrite: request.overwrite,
          imagesPath: copiedImagesDir ? "./images/" : undefined,
        });
        warnings.push(...generated.warnings);

        failedAt = "import_json";
        const importResult = await runSpine([
          "-i",
          animatedJsonPath,
          "-o",
          projectPath,
          "-r",
          request.projectName,
        ]);
        if (!importResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              warnings: dedupe(warnings),
              knowledgeFound: knowledge.exists,
              recommendation,
              animatedJsonPath,
              projectPath,
              exportOutputDir,
              copiedImagesDir,
              generated,
              importResult,
            }),
          );
        }

        failedAt = "pack_textures";
        const packResult = copiedImagesDir
          ? await runSpine([
            "-i",
            copiedImagesDir,
            "-o",
            exportOutputDir,
            "-p",
            request.projectName,
          ])
          : undefined;
        if (packResult && !packResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              warnings: dedupe(warnings),
              knowledgeFound: knowledge.exists,
              recommendation,
              animatedJsonPath,
              projectPath,
              exportOutputDir,
              copiedImagesDir,
              generated,
              importResult,
              packResult,
            }),
          );
        }

        failedAt = "export";
        const settingsCheck = await validateExportSettingsPath(request.exportMode, "spine_build_animation_from_json");
        if (!settingsCheck.valid) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              error: settingsCheck.error,
              warnings: dedupe(warnings),
              knowledgeFound: knowledge.exists,
              recommendation,
              animatedJsonPath,
              projectPath,
              importResult,
              packResult,
            }),
          );
        }

        const exportArgs = ["-i", projectPath, "-o", exportOutputDir];
        if (request.exportMode) {
          exportArgs.push("-e", request.exportMode);
        }
        const exportResult = await runSpine(exportArgs);
        if (!exportResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              warnings: dedupe(warnings),
              knowledgeFound: knowledge.exists,
              recommendation,
              animatedJsonPath,
              projectPath,
              exportOutputDir,
              copiedImagesDir,
              generated,
              importResult,
              packResult,
              exportResult,
            }),
          );
        }

        failedAt = "open_project";
        const openResult = request.openAfterBuild
          ? await runSpine([projectPath], { waitForExit: false })
          : undefined;
        if (openResult && !openResult.success) {
          warnings.push("openAfterBuild was requested, but Spine did not start successfully.");
        }

        const manifestPath = await writeJsonAnimationManifest({
          outputJsonPath: animatedJsonPath,
          manifest: {
            tool: "spine_build_animation_from_json",
            request,
            sourceJsonPath: path.resolve(request.sourceJsonPath),
            outputJsonPath: animatedJsonPath,
            animationName: generated.animationName,
            modifications: generated.modifications,
            warnings: dedupe(warnings),
            createdAt: new Date().toISOString(),
          },
        });

        return textContent(
          formatJson({
            success: true,
            warnings: dedupe(warnings),
            knowledgeFound: knowledge.exists,
            knowledgeDir: knowledge.knowledgeDir,
            recommendation,
            animatedJsonPath,
            projectPath,
            exportOutputDir,
            copiedImagesDir,
            manifestPath,
            generated,
            importResult,
            packResult,
            exportResult,
            openResult,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, failedAt));
      }
    },
  );
}

function mapRecommendedKinds(animations: string[]): JsonAnimationKind[] {
  const result = new Set<JsonAnimationKind>();

  for (const animation of animations) {
    switch (animation) {
      case "idle":
        result.add("breathing");
        result.add("head_float");
        break;
      case "breathing":
        result.add("breathing");
        break;
      case "blink":
        result.add("blink");
        break;
      case "tail_wag":
        result.add("tail_swing");
        break;
      case "head_bob":
        result.add("head_float");
        break;
      case "float":
        result.add("floating");
        break;
      case "logo_bounce":
        result.add("logo_bounce");
        break;
      case "paw_wave":
        result.add("paw_wave");
        break;
    }
  }

  if (result.size === 0) {
    result.add("floating");
  }

  return [...result];
}

function normalizeKnownCharacterType(
  characterType: string | undefined,
): "cat" | "mascot" | "logo" | "generic" | undefined {
  if (
    characterType === "cat" ||
    characterType === "mascot" ||
    characterType === "logo" ||
    characterType === "generic"
  ) {
    return characterType;
  }

  return undefined;
}

async function copyImagesForBuild(imagesDir: string, outputDir: string): Promise<string> {
  const destinationDir = path.join(outputDir, "images");
  await copyDirectoryRecursive(path.resolve(imagesDir), destinationDir);
  return destinationDir;
}

async function copyDirectoryRecursive(sourceDir: string, destinationDir: string): Promise<void> {
  const info = await stat(sourceDir);
  if (!info.isDirectory()) {
    throw new Error(`imagesDir is not a directory: ${sourceDir}`);
  }

  await mkdir(destinationDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
