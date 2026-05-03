import { z } from "zod";

export const characterTypeSchema = z
  .enum(["cat", "mascot", "logo", "generic"])
  .optional()
  .describe("Character category used to choose default layout and animation presets.");

export const exportModeSchema = z
  .string()
  .min(1)
  .optional()
  .describe('Deprecated alias for exportSettingsPath. Must be a Spine export settings .json file path. Mode strings like "json" or "json+pack" are not accepted by Spine 3.8.75.');

export const exportSettingsPathSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Path to a Spine export settings .json file used with -e. If omitted, tools that can build a .spine project skip the final export step.");

export const projectNameSchema = z
  .string()
  .min(1)
  .refine((value) => !/[\\/:]/.test(value) && value !== "." && value !== "..", {
    message: "projectName must be a file name, not a path.",
  })
  .describe("Project file base name to generate inside outputDir, without path separators.");

export const overwriteSchema = z
  .boolean()
  .default(false)
  .describe(
    "When false, stop if outputDir already exists. When true, overwrite generated files inside outputDir without deleting files outside it.",
  );
