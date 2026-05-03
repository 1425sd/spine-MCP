import { stat } from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatJson, formatToolError, textContent } from "./common.js";

const schema = {
  projectPath: z
    .string()
    .min(1)
    .describe("Path to the .spine project file to open in the local Spine application."),
};

export function registerSpineOpenProjectTool(server: McpServer): void {
  server.tool(
    "spine_open_project",
    "Use this to open a .spine project in the local Spine application so you can continue manual editing. Do not use it for CLI exports, texture packing, JSON import, UI automation, or waiting for editor operations to finish.",
    schema,
    async ({ projectPath }) => {
      try {
        if (!projectPath.toLowerCase().endsWith(".spine")) {
          return textContent(
            formatJson({
              success: false,
              error: `spine_open_project only accepts .spine project files. Received: ${path.basename(projectPath)}`,
            }),
          );
        }

        try {
          const info = await stat(projectPath);
          if (!info.isFile()) {
            return textContent(
              formatJson({
                success: false,
                error: `Path is not a file: ${projectPath}`,
              }),
            );
          }
        } catch {
          return textContent(
            formatJson({
              success: false,
              error: `File does not exist: ${projectPath}`,
            }),
          );
        }

        const result = await runSpine([projectPath], { waitForExit: false });
        return textContent(
          formatJson({
            message:
              "The editor launch was requested. Please confirm manually in Spine.",
            ...result,
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
