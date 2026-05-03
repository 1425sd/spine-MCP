import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const SPINE_RULES_RESOURCE_URI = "spine://rules";

export const SPINE_RULES = `# Spine MCP Rules

This MCP server only automates Spine through the official Spine CLI.

Allowed first-version scope:
- Inspect Spine inputs with -i.
- Export Spine projects with -i, -o, -e, optional --update, and optional -m.
- Pack PNG folders into atlases with -p.
- Import JSON or binary skeleton data into .spine projects with -r.
- Run Spine animation clean up with -m.
- Open a .spine project for manual editing without waiting for Spine to exit.
- Read asset folders to validate required PNG files.

Allowed second-version scope:
- Analyze PNG asset folders by reading file names and image dimensions.
- Infer simple part roles such as body, head, tail, eyes, paws, ears, shadow, and background.
- Generate basic Spine JSON with bones, slots, default skin region attachments, and simple animation timelines.
- Copy selected PNG assets to outputDir/images.
- Write generation.manifest.json inside outputDir.
- Import generated JSON through Spine CLI.
- Export generated .spine projects through Spine CLI.

Out of scope:
- UI automation.
- AutoHotkey.
- Mouse or keyboard simulation.
- Timeline dragging.
- Mesh binding.
- Bone weight editing.
- Direct mutation of internal .spine project structure.
- Arbitrary shell command execution.
`;

export function registerSpineRulesResource(server: McpServer): void {
  server.resource(
    "spine_rules",
    SPINE_RULES_RESOURCE_URI,
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: SPINE_RULES,
        },
      ],
    }),
  );
}
