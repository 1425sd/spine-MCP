import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatSpineResult, formatToolError, textContent } from "./common.js";

const schema = {
  inputPath: z
    .string()
    .min(1)
    .describe("Path to a Spine JSON, binary skeleton, or another supported project input to import."),
  outputProjectPath: z
    .string()
    .min(1)
    .describe("Path where Spine should write the resulting .spine project."),
  skeletonName: z
    .string()
    .min(1)
    .optional()
    .describe("Optional skeleton name to pass after -r during import."),
  scale: z
    .number()
    .positive()
    .optional()
    .describe("Optional import scale value passed to Spine with -s."),
};

export function registerSpineImportJsonTool(server: McpServer): void {
  server.tool(
    "spine_import_json",
    "Use this to import Spine JSON, binary skeleton data, or another supported input into a .spine project via the official Spine CLI. Do not use it for texture packing, project export, editor UI actions, or manual project internals editing.",
    schema,
    async ({ inputPath, outputProjectPath, skeletonName, scale }) => {
      try {
        const args = ["-i", inputPath];

        if (scale !== undefined) {
          args.push("-s", String(scale));
        }

        args.push("-o", outputProjectPath, "-r");

        if (skeletonName) {
          args.push(skeletonName);
        }

        const result = await runSpine(args);
        return textContent(formatSpineResult(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
