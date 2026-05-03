import { z } from "zod";

export const animationPresetNameSchema = z.enum([
  "idle",
  "breathing",
  "blink",
  "tail_wag",
  "head_bob",
  "float",
  "logo_bounce",
  "paw_wave",
]);

export const characterTypeSchema = z
  .enum(["cat", "mascot", "logo", "generic"])
  .optional()
  .describe("Character category used to choose default layout and animation presets.");

export const exportModeSchema = z
  .enum(["json", "json+pack", "binary", "binary+pack"])
  .default("json+pack")
  .describe('Spine export mode passed to -e, for example "json+pack".');

export const projectNameSchema = z
  .string()
  .min(1)
  .refine((value) => !/[\\/:]/.test(value) && value !== "." && value !== "..", {
    message: "projectName must be a file name, not a path.",
  })
  .describe("Project file base name to generate inside outputDir, without path separators.");

export const animationsSchema = z
  .array(animationPresetNameSchema)
  .optional()
  .describe(
    "Animation preset names to generate. If omitted, defaults depend on characterType.",
  );

export const canvasWidthSchema = z
  .number()
  .positive()
  .optional()
  .describe("Optional Spine skeleton canvas width. Defaults to 512.");

export const canvasHeightSchema = z
  .number()
  .positive()
  .optional()
  .describe("Optional Spine skeleton canvas height. Defaults to 512.");

export const fpsSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe("Optional intended animation FPS metadata for callers. Defaults to 30.");

export const durationSchema = z
  .number()
  .positive()
  .optional()
  .describe("Optional duration override in seconds for generated animation presets.");

export const overwriteSchema = z
  .boolean()
  .default(false)
  .describe(
    "When false, stop if outputDir already exists. When true, overwrite generated files inside outputDir without deleting files outside it.",
  );
