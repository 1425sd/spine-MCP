import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateAnimationJson } from "../json/animation-writer.js";
import { getIntensityMultiplier, resolveLoadingPreset } from "../json/presets.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  sourceJsonPath: z
    .string()
    .min(1)
    .describe("Source Spine JSON file to read. It is preserved unchanged."),
  outputJsonPath: z
    .string()
    .min(1)
    .describe("Destination JSON file where the modified loading animation copy will be written."),
  preset: z
    .enum([
      "cute_cat_loading",
      "logo_bounce",
      "breathing_idle",
      "floating_character",
      "blink_loop",
    ])
    .describe("Loading animation preset to generate."),
  duration: z
    .number()
    .positive()
    .optional()
    .describe("Optional duration override in seconds. If omitted, the preset default is used."),
  intensity: z
    .enum(["soft", "normal", "strong"])
    .default("normal")
    .describe("Motion intensity multiplier for transform amplitudes."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("When false, stop if outputJsonPath exists or the preset animation already exists. When true, overwrite those generated targets."),
};

export function registerSpineCreateLoadingAnimationPresetTool(server: McpServer): void {
  server.tool(
    "spine_create_loading_animation_preset",
    "Create a loading animation preset on a Spine JSON copy. Presets: cute_cat_loading, logo_bounce, breathing_idle, floating_character, blink_loop. Writes JSON + manifest only. Not for mesh, IK, weights, or UI automation.",
    schema,
    async (request) => {
      try {
        const preset = resolveLoadingPreset({
          preset: request.preset,
          duration: request.duration,
        });
        const result = await generateAnimationJson({
          sourceJsonPath: request.sourceJsonPath,
          outputJsonPath: request.outputJsonPath,
          userGoal: preset.userGoal,
          animationName: preset.animationName,
          duration: preset.duration,
          loop: true,
          characterType: preset.characterType,
          selectedKinds: preset.kinds,
          intensity: request.intensity,
          overwrite: request.overwrite,
        });

        return textContent(
          formatJson({
            success: true,
            preset: request.preset,
            intensity: request.intensity,
            intensityMultiplier: getIntensityMultiplier(request.intensity),
            ...result,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, "create_loading_animation_preset"));
      }
    },
  );
}
