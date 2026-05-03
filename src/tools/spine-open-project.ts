import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runSpine } from "../services/spine-cli.js";
import { formatToolError, textContent } from "./common.js";

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
        const result = await runSpine([projectPath], { waitForExit: false });
        return textContent(
          JSON.stringify(
            {
              message: "已尝试打开项目。",
              ...result,
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return textContent(formatToolError(error));
      }
    },
  );
}
