import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  jsonPath: z
    .string()
    .min(1)
    .describe("Path to the generated Spine skeleton JSON to import."),
  outputProjectPath: z
    .string()
    .min(1)
    .describe("Destination .spine project path that Spine CLI should write."),
  skeletonName: z
    .string()
    .min(1)
    .optional()
    .describe("Optional skeleton name passed after -r during Spine CLI import."),
  scale: z
    .number()
    .positive()
    .optional()
    .describe("Optional import scale value passed to Spine CLI with -s."),
};

export function registerSpineImportGeneratedJsonTool(server: McpServer): void {
  server.tool(
    "spine_import_generated_json",
    "Use this to import a generated basic Spine JSON into a .spine project via the official Spine CLI. Do not use it to generate JSON, pack textures, export, automate the editor UI, or edit .spine internals.",
    schema,
    async ({ jsonPath, outputProjectPath, skeletonName, scale }) => {
      try {
        const args = ["-i", jsonPath, "-o", outputProjectPath, "-r"];

        if (skeletonName) {
          args.push(skeletonName);
        }

        if (scale !== undefined) {
          args.push("-s", String(scale));
        }

        const result = await runSpine(args);
        return textContent(
          formatJson({
            failedAt: result.success ? undefined : "import_json",
            ...result,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, "import_json"));
      }
    },
  );
}
