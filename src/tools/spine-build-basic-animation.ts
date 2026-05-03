import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateSimpleSkeletonJson } from "../generators/simple-spine-json-generator.js";
import { analyzeAssets } from "../services/asset-analyzer.js";
import { createExportOutputDir } from "../services/generated-project-service.js";
import { runSpine } from "../services/spine-cli.js";
import { validateGeneratedSpineJson } from "../services/spine-json-validator.js";
import { formatJson, formatToolError, textContent, validateExportSettingsPath } from "./common.js";
import {
  animationsSchema,
  canvasHeightSchema,
  canvasWidthSchema,
  characterTypeSchema,
  durationSchema,
  exportModeSchema,
  fpsSchema,
  overwriteSchema,
  projectNameSchema,
} from "./generated-tool-schemas.js";

const schema = {
  assetsDir: z
    .string()
    .min(1)
    .describe("Directory containing PNG region assets to analyze and use for the basic Spine animation."),
  outputDir: z
    .string()
    .min(1)
    .describe("Directory where generated JSON, images, .spine project, manifest, and export output should be written."),
  projectName: projectNameSchema,
  skeletonName: z
    .string()
    .min(1)
    .optional()
    .describe("Optional skeleton name passed to Spine CLI import. Defaults to projectName."),
  animationDescription: z
    .string()
    .optional()
    .describe("Optional natural-language animation note stored in the generation manifest for traceability."),
  characterType: characterTypeSchema,
  canvasWidth: canvasWidthSchema,
  canvasHeight: canvasHeightSchema,
  fps: fpsSchema,
  duration: durationSchema,
  animations: animationsSchema,
  exportMode: exportModeSchema,
  openAfterBuild: z
    .boolean()
    .default(false)
    .describe("When true, open the generated .spine project after import and export without waiting for Spine to exit."),
  overwrite: overwriteSchema,
};

export function registerSpineBuildBasicAnimationTool(server: McpServer): void {
  server.tool(
    "spine_build_basic_animation",
    "High-level Text-to-Spine generator for simple region PNG animations. Supports idle, breathing, blink, tail_wag, head_bob, float, logo_bounce, paw_wave. Defaults: cat->idle/breathing/blink/tail_wag, logo->logo_bounce/float, generic->idle. Not for mesh, IK, weights, or UI automation.",
    schema,
    async (request) => {
      let failedAt:
        | "analyze_assets"
        | "generate_json"
        | "validate_json"
        | "import_json"
        | "export" = "analyze_assets";

      try {
        const assetAnalysis = await analyzeAssets(request.assetsDir);
        failedAt = "generate_json";
        const generationResult = await generateSimpleSkeletonJson({
          assetAnalysis,
          request,
        });

        failedAt = "validate_json";
        const validation = validateGeneratedSpineJson(generationResult.skeletonJson);
        const warnings = [...generationResult.warnings, ...validation.warnings];

        if (!validation.isValid) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              jsonPath: generationResult.jsonPath,
              projectPath: generationResult.projectPath,
              imagesDir: generationResult.imagesDir,
              exportOutputDir: generationResult.exportOutputDir,
              usedAssets: generationResult.usedAssets,
              warnings,
              validation,
            }),
          );
        }

        failedAt = "import_json";
        const importArgs = [
          "-i",
          generationResult.jsonPath,
          "-o",
          generationResult.projectPath,
          "-r",
          generationResult.skeletonName,
        ];
        const importResult = await runSpine(importArgs);

        if (!importResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              jsonPath: generationResult.jsonPath,
              projectPath: generationResult.projectPath,
              imagesDir: generationResult.imagesDir,
              exportOutputDir: generationResult.exportOutputDir,
              usedAssets: generationResult.usedAssets,
              warnings,
              validation,
              importResult,
            }),
          );
        }

        failedAt = "export";
        const settingsCheck = await validateExportSettingsPath(request.exportMode, "spine_build_basic_animation");
        if (!settingsCheck.valid) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              error: settingsCheck.error,
              jsonPath: generationResult.jsonPath,
              projectPath: generationResult.projectPath,
              importResult,
            }),
          );
        }

        const exportOutputDir = await createExportOutputDir(generationResult.outputDir);
        const exportArgs = ["-i", generationResult.projectPath, "-o", exportOutputDir];
        if (request.exportMode) {
          exportArgs.push("-e", request.exportMode);
        }
        const exportResult = await runSpine(exportArgs);

        if (!exportResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              jsonPath: generationResult.jsonPath,
              projectPath: generationResult.projectPath,
              imagesDir: generationResult.imagesDir,
              exportOutputDir,
              usedAssets: generationResult.usedAssets,
              warnings,
              validation,
              importResult,
              exportResult,
            }),
          );
        }

        const openResult = request.openAfterBuild === true
          ? await runSpine([generationResult.projectPath], { waitForExit: false })
          : undefined;

        if (openResult && !openResult.success) {
          warnings.push(
            "openAfterBuild was requested, but Spine did not start successfully. Import and export already completed.",
          );
        }

        return textContent(
          formatJson({
            success: true,
            jsonPath: generationResult.jsonPath,
            projectPath: generationResult.projectPath,
            imagesDir: generationResult.imagesDir,
            exportOutputDir,
            usedAssets: generationResult.usedAssets,
            warnings,
            selectedAnimations: generationResult.selectedAnimations,
            validation,
            importResult,
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
