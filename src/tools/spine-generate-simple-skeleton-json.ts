import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateSimpleSkeletonJson } from "../generators/simple-spine-json-generator.js";
import { analyzeAssets } from "../services/asset-analyzer.js";
import { validateGeneratedSpineJson } from "../services/spine-json-validator.js";
import { formatJson, formatToolError, textContent } from "./common.js";
import {
  animationsSchema,
  canvasHeightSchema,
  canvasWidthSchema,
  characterTypeSchema,
  durationSchema,
  fpsSchema,
  overwriteSchema,
  projectNameSchema,
} from "./generated-tool-schemas.js";

const schema = {
  assetsDir: z
    .string()
    .min(1)
    .describe("Directory containing PNG assets to analyze and copy into outputDir/images."),
  outputDir: z
    .string()
    .min(1)
    .describe("Directory where generated JSON, images, and generation manifest should be written."),
  projectName: projectNameSchema,
  skeletonName: z
    .string()
    .min(1)
    .optional()
    .describe("Optional skeleton name for later Spine import. Defaults to projectName."),
  characterType: characterTypeSchema,
  canvasWidth: canvasWidthSchema,
  canvasHeight: canvasHeightSchema,
  fps: fpsSchema,
  duration: durationSchema,
  animations: animationsSchema,
  overwrite: overwriteSchema,
};

export function registerSpineGenerateSimpleSkeletonJsonTool(server: McpServer): void {
  server.tool(
    "spine_generate_simple_skeleton_json",
    "Use this to generate a basic Spine JSON skeleton from simple region PNG parts without calling Spine CLI. It is useful for debugging generated JSON, images folder contents, and animation presets before import. Do not use it for professional mesh, weights, IK, complex skins, editor UI automation, or direct .spine binary edits.",
    schema,
    async (request) => {
      let failedAt = "analyze_assets";

      try {
        const assetAnalysis = await analyzeAssets(request.assetsDir);
        failedAt = "generate_json";
        const generationResult = await generateSimpleSkeletonJson({
          assetAnalysis,
          request,
        });
        failedAt = "validate_json";
        const validation = validateGeneratedSpineJson(generationResult.skeletonJson);

        return textContent(
          formatJson({
            success: validation.isValid,
            ...generationResult,
            validation,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, failedAt));
      }
    },
  );
}
