import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeAssets } from "../services/asset-analyzer.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  assetsDir: z
    .string()
    .min(1)
    .describe("Directory containing PNG assets to scan and infer Spine part roles from."),
};

export function registerSpineAnalyzeAssetsTool(server: McpServer): void {
  server.tool(
    "spine_analyze_assets",
    "Use this read-only tool when the user provides a folder of PNG parts and wants to see what roles MCP can infer before generation. It lists PNG dimensions, inferred roles, recommended parts, and warnings. Do not use it to write files, call Spine CLI, build projects, or automate the Spine UI.",
    schema,
    async ({ assetsDir }) => {
      try {
        const result = await analyzeAssets(assetsDir);
        return textContent(formatJson({ success: true, ...result }));
      } catch (error) {
        return textContent(formatToolError(error, "analyze_assets"));
      }
    },
  );
}
