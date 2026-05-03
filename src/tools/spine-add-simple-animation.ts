import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addSimpleBoneAnimation } from "../json/animation-writer.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const keyframeSchema = z
  .object({
    time: z.number().nonnegative().describe("Keyframe time in seconds."),
    angle: z.number().optional().describe("Rotation angle in degrees for rotate timelines."),
    value: z.number().optional().describe("Alternative rotation angle field accepted for convenience."),
    x: z.number().optional().describe("X value for translate or scale timelines."),
    y: z.number().optional().describe("Y value for translate or scale timelines."),
  })
  .describe("One simple Spine keyframe. Rotate uses angle/value; translate and scale use x/y.");

const schema = {
  sourceJsonPath: z
    .string()
    .min(1)
    .describe("Source Spine JSON file to read. It is preserved unchanged."),
  outputJsonPath: z
    .string()
    .min(1)
    .describe("Destination JSON file where the modified copy will be written."),
  animationName: z
    .string()
    .min(1)
    .describe("Animation name to add or overwrite."),
  targetBone: z
    .string()
    .min(1)
    .describe("Existing bone name that receives the timeline."),
  animationType: z
    .enum(["rotate", "translate", "scale"])
    .describe("Simple bone timeline type to write."),
  keyframes: z
    .array(keyframeSchema)
    .min(1)
    .describe("Timeline keyframes to write to the target bone."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("When false, stop if outputJsonPath exists or animationName already exists. When true, overwrite those generated targets."),
};

export function registerSpineAddSimpleAnimationTool(server: McpServer): void {
  server.tool(
    "spine_add_simple_animation",
    "Low-level debug tool for adding one simple rotate, translate, or scale bone timeline to a Spine JSON copy. Use this when you already know the exact targetBone and keyframes you want. It only edits JSON and writes generation.manifest.json. Do not use it for natural-language animation planning, packing, exporting, UI automation, mesh, IK, weights, or direct .spine binary edits.",
    schema,
    async (request) => {
      try {
        const result = await addSimpleBoneAnimation(request);
        return textContent(formatJson({ success: true, ...result }));
      } catch (error) {
        return textContent(formatToolError(error, "add_simple_animation"));
      }
    },
  );
}
