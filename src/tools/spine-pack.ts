import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatSpineResult, formatToolError, textContent } from "./common.js";

const schema = {
  imagesDir: z
    .string()
    .min(1)
    .describe("Folder containing PNG images to pack into a Spine texture atlas."),
  outputDir: z
    .string()
    .min(1)
    .describe("Destination folder where Spine should write atlas and packed texture output."),
  packSettingsOrName: z
    .string()
    .min(1)
    .describe("Texture packer settings name or settings file path passed to Spine -p."),
  projectPath: z
    .string()
    .min(1)
    .optional()
    .describe("Optional .spine project path passed with -j when pack settings should be read from a project."),
};

export function registerSpinePackTool(server: McpServer): void {
  server.tool(
    "spine_pack_textures",
    "Use this to pack a folder of PNG images into a Spine atlas using the official Spine CLI texture packer. Do not use it to export skeleton data, import JSON, edit meshes, or automate the editor UI.",
    schema,
    async ({ imagesDir, outputDir, packSettingsOrName, projectPath }) => {
      try {
        const args = ["-i", imagesDir, "-o", outputDir, "-p", packSettingsOrName];

        if (projectPath) {
          args.push("-j", projectPath);
        }

        const result = await runSpine(args);
        return textContent(formatSpineResult(result));
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
