import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatSpineResult, formatToolError, textContent, validateExportSettingsPath } from "./common.js";

const schema = {
  projectPath: z
    .string()
    .min(1)
    .describe("Path to the source .spine project file that should be exported."),
  outputPath: z
    .string()
    .min(1)
    .describe("Destination file or directory for Spine export output, depending on the export setting."),
  exportSettingsPath: z
    .string()
    .min(1)
    .optional()
    .describe("Path to a Spine export settings .json file used with -e. Required for Spine 3.8.75 exports."),
  exportModeOrSettings: z
    .string()
    .min(1)
    .optional()
    .describe('Deprecated alias for exportSettingsPath. Mode strings like "json" or "json+pack" are not accepted.'),
  updateVersion: z
    .string()
    .min(1)
    .optional()
    .describe("Deprecated. Spine 3.8.75 help lists --update only for editor launch, not export commands."),
  clean: z
    .boolean()
    .default(false)
    .describe("When true, add -m to clean animations during export."),
};

export function registerSpineExportTool(server: McpServer): void {
  server.tool(
    "spine_export",
    "Use this to export a .spine project with the official Spine CLI and an export settings JSON file. Do not use it for texture-only packing, JSON import, editor UI automation, or direct project structure edits.",
    schema,
    async ({ projectPath, outputPath, exportSettingsPath, exportModeOrSettings, updateVersion, clean }) => {
      try {
        if (updateVersion) {
          return textContent(
            JSON.stringify(
              {
                success: false,
                error:
                  "Spine 3.8.75 export usage does not include --update. Open/update the project separately, then run spine_export with exportSettingsPath.",
              },
              null,
              2,
            ),
          );
        }

        const effectiveExportSettingsPath = exportSettingsPath ?? exportModeOrSettings;
        const settingsCheck = await validateExportSettingsPath(
          effectiveExportSettingsPath,
          "spine_export",
          { required: true },
        );
        if (!settingsCheck.valid) {
          return textContent(
            JSON.stringify(
              { success: false, error: settingsCheck.error },
              null,
              2,
            ),
          );
        }

        const args: string[] = [];

        args.push("-i", projectPath);

        if (clean) {
          args.push("-m");
        }

        args.push("-o", outputPath);
        args.push("-e", effectiveExportSettingsPath!);

        const result = await runSpine(args);
        return textContent(formatSpineResult(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
