import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const SPINE_RULES_RESOURCE_URI = "spine://rules";

export const SPINE_RULES = `# Spine MCP Rules

This MCP server only automates Spine through the official Spine CLI.

Allowed scope:
- Inspect Spine inputs with -i.
- Export Spine projects with -i, -o, -e <export-settings.json>, and optional -m.
- Import JSON or binary skeleton data into .spine projects with -r.
- Run Spine animation clean up with -m.
- Open a .spine project for manual editing without waiting for Spine to exit.
- Analyze existing Spine JSON files: inspect skeleton, bones, slots, skins, attachments, and animations.
- Infer common JSON roles such as body, head, tail, eyes, paws, root, and logo.
- Write modified JSON copies with basic rotate, translate, scale, and slot attachment timelines.
- Write custom rotate, translate, and scale timelines for multiple existing bones in a copied Spine JSON file.
- Preserve source JSON files and write generated output only to user-specified output JSON paths or outputDir.
- Import generated JSON copies through Spine CLI.
- Export generated .spine projects through Spine CLI.
- Read an existing Spine JSON file or export an existing .spine project to JSON through Spine CLI when a JSON export settings file is provided.
- Infer existing bones, slots, and default attachments from the generated JSON copy.
- Add basic bone transform and slot attachment timelines to a copied JSON file under outputDir.
- Copy an optional imagesDir into outputDir/images.
- Scan local Spine corpora for .spine and .json files.
- Export .spine files to .cache/corpus-json for analysis.
- Parse exported or existing Spine JSON files one project at a time.
- Extract naming, skeleton, attachment, timeline, duration, and transform statistics.
- Write learned guide and machine-readable JSON knowledge files under knowledge/ or a user-provided outputKnowledgeDir.
- Use learned presets and naming rules to recommend generator parameters.
- Fall back to built-in defaults when knowledge files are missing.

Out of scope:
- Passing mode strings such as "json" or "json+pack" to Spine -e.
- Updating Spine versions as part of an export command.
- UI automation.
- AutoHotkey.
- Mouse or keyboard simulation.
- Timeline dragging.
- Direct editor bone manipulation.
- Mesh binding.
- Bone weight editing.
- Direct mutation of internal .spine project structure.
- Arbitrary shell command execution.
- Modifying or deleting corpus source files.
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
