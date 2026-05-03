import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scanCorpus } from "../corpus/corpus-scanner.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  corpusDir: z
    .string()
    .min(1)
    .describe("Directory containing Spine source .spine and .json projects to scan."),
  maxProjects: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional maximum number of .spine/.json files to return for a quick test scan."),
};

export function registerSpineScanCorpusTool(server: McpServer): void {
  server.tool(
    "spine_scan_corpus",
    "Use this read-only tool to confirm a corpus path before learning. It recursively scans for .spine and .json files and returns counts without parsing or exporting projects. Do not use it to generate knowledge, call Spine CLI, modify corpus files, or build animations.",
    schema,
    async ({ corpusDir, maxProjects }) => {
      try {
        const result = await scanCorpus(corpusDir, maxProjects);
        return textContent(formatJson({ success: true, ...result }));
      } catch (error) {
        return textContent(formatToolError(error, "scan_corpus"));
      }
    },
  );
}
