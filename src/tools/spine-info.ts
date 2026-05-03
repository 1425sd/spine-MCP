import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatSpineResult, formatToolError, textContent } from "./common.js";

const schema = {
  inputPath: z
    .string()
    .min(1)
    .describe("Path to a .spine, .json, .skel file, or an images folder to inspect with Spine CLI."),
};

export function registerSpineInfoTool(server: McpServer): void {
  server.tool(
    "spine_info",
    "Use this to inspect Spine project, JSON, binary skeleton, or folder metadata through the Spine CLI. Do not use it to export, modify, pack, or open projects.",
    schema,
    async ({ inputPath }) => {
      try {
        const result = await runSpine(["-i", inputPath]);
        return textContent(formatSpineResult(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
