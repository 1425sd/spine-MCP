import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateAnimationJson } from "../json/animation-writer.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  sourceJsonPath: z
    .string()
    .min(1)
    .describe("Source Spine JSON file to read. It is preserved unchanged."),
  outputJsonPath: z
    .string()
    .min(1)
    .describe("Destination JSON file where the modified copy with generated animation will be written."),
  userGoal: z
    .string()
    .min(1)
    .describe("Natural-language animation goal used to select basic JSON animation timelines."),
  animationName: z
    .string()
    .min(1)
    .default("generated_loop")
    .describe('Animation name to add under animations. Defaults to "generated_loop".'),
  duration: z
    .number()
    .positive()
    .default(2)
    .describe("Animation duration in seconds. Defaults to 2."),
  loop: z
    .boolean()
    .default(true)
    .describe("Whether the generated keyframes should be loop-friendly. Spine JSON stores loop behavior at playback time, so this is recorded in the manifest."),
  characterType: z
    .string()
    .min(1)
    .optional()
    .describe('Optional character hint such as "cat", "mascot", "logo", or "generic".'),
  overwrite: z
    .boolean()
    .default(false)
    .describe("When false, stop if outputJsonPath exists or animationName already exists. When true, overwrite those generated targets."),
};

export function registerSpineGenerateAnimationJsonTool(server: McpServer): void {
  server.tool(
    "spine_generate_animation_json",
    "Generate a modified Spine JSON copy by adding basic animation keyframes to an existing skeleton. Supports breathing, head_float, tail_swing, blink, paw_wave, logo_bounce, and floating by reading bones, slots, skins, and animations from sourceJsonPath. Use this for Photoshop-to-Spine JSON or existing exported Spine JSON. It only writes JSON and generation.manifest.json; it does not open Spine, import, export, pack textures, automate UI, bind mesh, edit weights, or modify .spine binaries.",
    schema,
    async (request) => {
      try {
        const result = await generateAnimationJson(request);
        return textContent(formatJson({ success: true, ...result }));
      } catch (error) {
        return textContent(formatToolError(error, "generate_json"));
      }
    },
  );
}
