import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateSimpleSkeletonJson } from "../generators/simple-spine-json-generator.js";
import { analyzeAssets } from "../services/asset-analyzer.js";
import { createExportOutputDir } from "../services/generated-project-service.js";
import { runSpine } from "../services/spine-cli.js";
import { validateGeneratedSpineJson } from "../services/spine-json-validator.js";
import {
  loadKnowledge,
  recommendAnimationParams,
} from "../corpus/knowledge-loader.js";
import { formatJson, formatToolError, textContent } from "./common.js";
import {
  characterTypeSchema,
  exportModeSchema,
  overwriteSchema,
  projectNameSchema,
} from "./generated-tool-schemas.js";

const schema = {
  assetsDir: z
    .string()
    .min(1)
    .describe("Directory containing PNG region assets to analyze and animate."),
  outputDir: z
    .string()
    .min(1)
    .describe("Directory where generated JSON, images, .spine project, manifest, and export output should be written."),
  projectName: projectNameSchema,
  userGoal: z
    .string()
    .min(1)
    .describe("Natural-language animation goal used to choose learned presets and animation list."),
  skeletonName: z
    .string()
    .min(1)
    .optional()
    .describe("Optional skeleton name passed to Spine CLI import. Defaults to projectName."),
  characterType: characterTypeSchema,
  knowledgeDir: z
    .string()
    .min(1)
    .optional()
    .describe("Directory containing learned knowledge files. Defaults to project knowledge/."),
  exportMode: exportModeSchema,
  openAfterBuild: z
    .boolean()
    .default(false)
    .describe("When true, open the generated .spine project after import/export without waiting for Spine to exit."),
  overwrite: overwriteSchema,
};

export function registerSpineBuildBasicAnimationWithKnowledgeTool(server: McpServer): void {
  server.tool(
    "spine_build_basic_animation_with_knowledge",
    "High-level generator that automatically reads the Spine Corpus Learning Layer before building. It analyzes assets, recommends animations and learned preset parameters from userGoal, generates basic region-attachment Spine JSON, imports it to .spine, exports it, and optionally opens the project. If knowledge files are missing it returns a warning and falls back to second-version defaults. Use this for simple region PNG animations such as cat loading, mascot idle, logo bounce, breathing, blink, tail wag, float, and paw wave. Do not use it for mesh, IK, weights, professional rigging, UI automation, mouse/keyboard simulation, or direct .spine binary edits.",
    schema,
    async (request) => {
      let failedAt:
        | "load_knowledge"
        | "analyze_assets"
        | "recommend_params"
        | "generate_json"
        | "validate_json"
        | "import_json"
        | "export" = "load_knowledge";

      try {
        const knowledge = await loadKnowledge(request.knowledgeDir);
        const warnings = [...knowledge.warnings];

        failedAt = "analyze_assets";
        const assetAnalysis = await analyzeAssets(request.assetsDir);
        const availableAssetRoles = [
          ...new Set(assetAnalysis.recommendedParts.map((part) => part.role)),
        ];

        failedAt = "recommend_params";
        const recommendation = recommendAnimationParams({
          userGoal: request.userGoal,
          characterType: request.characterType,
          availableAssetRoles,
          presets: knowledge.presets,
          namingRules: knowledge.namingRules,
        });
        warnings.push(...recommendation.warnings);

        failedAt = "generate_json";
        const generationResult = await generateSimpleSkeletonJson({
          assetAnalysis,
          request: {
            ...request,
            animationDescription: request.userGoal,
            animations: recommendation.recommendedAnimations,
            duration: recommendation.recommendedDuration,
            presetParams: recommendation.recommendedPresetParams,
          },
        });
        warnings.push(...generationResult.warnings);

        failedAt = "validate_json";
        const validation = validateGeneratedSpineJson(generationResult.skeletonJson);
        warnings.push(...validation.warnings);

        if (!validation.isValid) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              knowledgeFound: knowledge.exists,
              recommendation,
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
        const importResult = await runSpine([
          "-i",
          generationResult.jsonPath,
          "-o",
          generationResult.projectPath,
          "-r",
          request.skeletonName ?? request.projectName,
        ]);

        if (!importResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              knowledgeFound: knowledge.exists,
              recommendation,
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
        const exportOutputDir = await createExportOutputDir(generationResult.outputDir);
        const exportResult = await runSpine([
          "-i",
          generationResult.projectPath,
          "-o",
          exportOutputDir,
          "-e",
          request.exportMode ?? "json+pack",
        ]);

        if (!exportResult.success) {
          return textContent(
            formatJson({
              success: false,
              failedAt,
              knowledgeFound: knowledge.exists,
              recommendation,
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
          warnings.push("openAfterBuild was requested, but Spine did not start successfully.");
        }

        return textContent(
          formatJson({
            success: true,
            knowledgeFound: knowledge.exists,
            knowledgeDir: knowledge.knowledgeDir,
            recommendation,
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
