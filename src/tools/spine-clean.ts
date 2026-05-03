import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatSpineResult, formatToolError, textContent } from "./common.js";

const schema = {
  inputPath: z
    .string()
    .min(1)
    .describe("Path to the Spine project or import/export input that should be processed with Spine animation clean up."),
};

export function registerSpineCleanTool(server: McpServer): void {
  server.tool(
    "spine_clean",
    "Use this to run Spine CLI animation clean up with -m on a project or supported input. Do not use it to delete files, rewrite project internals directly, export assets, pack textures, or automate the editor UI.",
    schema,
    async ({ inputPath }) => {
      try {
        const result = await runSpine(["-i", inputPath, "-m"]);
        return textContent(formatSpineResult(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
