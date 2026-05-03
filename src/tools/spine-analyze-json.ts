import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeSpineJsonFile } from "../json/analyze-spine-json.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  jsonPath: z
    .string()
    .min(1)
    .describe("Path to a Spine JSON file to inspect. The tool is read-only."),
};

export function registerSpineAnalyzeJsonTool(server: McpServer): void {
  server.tool(
    "spine_analyze_json",
    "Read-only Spine JSON inspection tool. Use this to list skeleton metadata, bones, slots, skins, attachments, animations, and inferred common roles such as body, head, tail, eyes, paws, and logo before generating animation keyframes. Do not use it to modify files, call Spine CLI, export, import, or automate the Spine UI.",
    schema,
    async ({ jsonPath }) => {
      try {
        const analysis = await analyzeSpineJsonFile(jsonPath);
        return textContent(formatJson({ success: true, ...analysis }));
      } catch (error) {
        return textContent(formatToolError(error, "analyze_json"));
      }
    },
  );
}
