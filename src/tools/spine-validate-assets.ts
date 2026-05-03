import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  DEFAULT_REQUIRED_ASSET_FILES,
  validateAssetsDir,
} from "../services/file-utils.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  assetsDir: z
    .string()
    .min(1)
    .describe("Folder containing PNG character assets to validate."),
  requiredFiles: z
    .array(z.string().min(1))
    .default([...DEFAULT_REQUIRED_ASSET_FILES])
    .describe("Required PNG file names that must exist directly inside assetsDir."),
};

export function registerSpineValidateAssetsTool(server: McpServer): void {
  server.tool(
    "spine_validate_assets",
    "Use this read-only check before Spine CLI work to verify a local asset folder contains required PNG files and to list available PNGs. Do not use it to modify, create, delete, export, pack, or open files.",
    schema,
    async ({ assetsDir, requiredFiles }) => {
      try {
        const result = await validateAssetsDir(assetsDir, requiredFiles);
        return textContent(formatJson(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
