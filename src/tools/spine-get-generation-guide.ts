import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadKnowledge } from "../corpus/knowledge-loader.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  knowledgeDir: z
    .string()
    .min(1)
    .optional()
    .describe("Directory containing learned Spine knowledge files. Defaults to project knowledge/."),
};

export function registerSpineGetGenerationGuideTool(server: McpServer): void {
  server.tool(
    "spine_get_generation_guide",
    "Use this to load the learned Spine generation guide and machine-readable presets before deciding animation parameters. It reads learned-spine-guide.md, learned-animation-presets.json, and learned-naming-rules.json. If files are missing, run spine_learn_from_corpus first. Do not use it to scan corpus, call Spine CLI, or build animations.",
    schema,
    async ({ knowledgeDir }) => {
      try {
        const knowledge = await loadKnowledge(knowledgeDir);
        return textContent(
          formatJson({
            success: knowledge.exists,
            message: knowledge.exists
              ? "Loaded learned Spine generation guide."
              : "Knowledge files are missing. Please run spine_learn_from_corpus first.",
            ...knowledge,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, "get_generation_guide"));
      }
    },
  );
}
