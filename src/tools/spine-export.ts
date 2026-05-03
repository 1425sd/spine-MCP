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
  exportModeOrSettings: z
    .string()
    .min(1)
    .optional()
    .describe('Spine export settings JSON file path. Mode strings like "json+pack" are not accepted - provide a real .json export settings file, or omit to use Spine defaults.'),
  updateVersion: z
    .string()
    .min(1)
    .optional()
    .describe('Optional Spine version update target before export, for example "lateststable" or a concrete version.'),
  clean: z
    .boolean()
    .default(false)
    .describe("When true, add -m to clean animations during export."),
};

export function registerSpineExportTool(server: McpServer): void {
  server.tool(
    "spine_export",
    "Use this to export a .spine project with the official Spine CLI, optionally updating the project version or cleaning animations. Do not use it for texture-only packing, JSON import, editor UI automation, or direct project structure edits.",
    schema,
    async ({ projectPath, outputPath, exportModeOrSettings, updateVersion, clean }) => {
      try {
        const settingsCheck = await validateExportSettingsPath(exportModeOrSettings, "spine_export");
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

        if (updateVersion) {
          args.push("--update", updateVersion);
        }

        args.push("-i", projectPath);

        if (clean) {
          args.push("-m");
        }

        args.push("-o", outputPath);

        if (exportModeOrSettings) {
          args.push("-e", exportModeOrSettings);
        }

        const result = await runSpine(args);
        return textContent(formatSpineResult(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
