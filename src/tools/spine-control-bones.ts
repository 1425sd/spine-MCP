import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { controlBonesAnimation } from "../json/animation-writer.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const curveSchema = z.union([
  z.literal("stepped"),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
]);

const keyframeSchema = z.object({
  time: z.number().nonnegative().describe("Keyframe time in seconds."),
  angle: z.number().optional().describe("Rotation angle in degrees for rotate timelines."),
  value: z.number().optional().describe("Alternative rotation angle field accepted for rotate timelines."),
  x: z.number().optional().describe("X value for translate or scale timelines."),
  y: z.number().optional().describe("Y value for translate or scale timelines."),
  curve: curveSchema.optional().describe('Optional Spine curve. Omit for linear, use "stepped" for stepped, or provide a 4-number Bezier curve.'),
});

const boneControlSchema = z.object({
  boneName: z
    .string()
    .min(1)
    .describe("Existing Spine bone name to control."),
  rotate: z
    .array(keyframeSchema)
    .min(1)
    .optional()
    .describe("Optional rotate timeline keyframes. Each keyframe requires angle or value."),
  translate: z
    .array(keyframeSchema)
    .min(1)
    .optional()
    .describe("Optional translate timeline keyframes. Each keyframe requires x and/or y."),
  scale: z
    .array(keyframeSchema)
    .min(1)
    .optional()
    .describe("Optional scale timeline keyframes. Missing x/y defaults to 1."),
});

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
  boneControls: z
    .array(boneControlSchema)
    .min(1)
    .describe("Bone transform timelines to write. Supports multiple bones and multiple timeline types per bone."),
  overwrite: z
    .boolean()
    .default(false)
    .describe("When false, stop if outputJsonPath exists or animationName already exists. When true, overwrite those generated targets."),
};

export function registerSpineControlBonesTool(server: McpServer): void {
  server.tool(
    "spine_control_bones",
    "Write custom rotate, translate, and scale timelines for one or more existing bones into a Spine JSON copy. Use this when you know exact bone names and keyframes. This controls bones through JSON animation data only; it does not automate the Spine editor UI, bind meshes, edit weights, create IK, or mutate .spine binaries directly.",
    schema,
    async (request) => {
      try {
        const result = await controlBonesAnimation(request);
        return textContent(formatJson({ success: true, ...result }));
      } catch (error) {
        return textContent(formatToolError(error, "control_bones"));
      }
    },
  );
}
