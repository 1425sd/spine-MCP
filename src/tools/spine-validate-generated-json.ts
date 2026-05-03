import { readFile } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { validateGeneratedSpineJson } from "../services/spine-json-validator.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  jsonPath: z
    .string()
    .min(1)
    .describe("Path to a generated Spine skeleton JSON file to validate."),
};

export function registerSpineValidateGeneratedJsonTool(server: McpServer): void {
  server.tool(
    "spine_validate_generated_json",
    "Use this read-only tool to validate a generated basic Spine JSON before importing it into Spine. It checks required top-level sections, slot bone references, skin attachments, and animation bone references. Do not use it to call Spine CLI, write files, or validate advanced mesh/IK/weights features.",
    schema,
    async ({ jsonPath }) => {
      try {
        const jsonText = await readFile(jsonPath, "utf8");
        const parsed = JSON.parse(jsonText) as unknown;
        const validation = validateGeneratedSpineJson(parsed);

        return textContent(
          formatJson({
            success: validation.isValid,
            jsonPath,
            ...validation,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, "validate_json"));
      }
    },
  );
}
