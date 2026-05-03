#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSpineRulesResource } from "./resources/spine-rules.js";
import { registerSpineAnalyzeJsonTool } from "./tools/spine-analyze-json.js";
import { registerSpineAddSimpleAnimationTool } from "./tools/spine-add-simple-animation.js";
import { registerSpineBuildAnimationFromExistingProjectTool } from "./tools/spine-build-animation-from-existing-project.js";
import { registerSpineBuildAnimationFromJsonTool } from "./tools/spine-build-animation-from-json.js";
import { registerSpineCleanTool } from "./tools/spine-clean.js";
import { registerSpineControlBonesTool } from "./tools/spine-control-bones.js";
import { registerSpineExportTool } from "./tools/spine-export.js";
import { registerSpineGenerateAnimationJsonTool } from "./tools/spine-generate-animation-json.js";
import { registerSpineGetGenerationGuideTool } from "./tools/spine-get-generation-guide.js";
import { registerSpineLearnFromCorpusTool } from "./tools/spine-learn-from-corpus.js";
import { registerSpineImportJsonTool } from "./tools/spine-import-json.js";
import { registerSpineInfoTool } from "./tools/spine-info.js";
import { registerSpineOpenProjectTool } from "./tools/spine-open-project.js";
import { registerSpineRecommendAnimationParamsTool } from "./tools/spine-recommend-animation-params.js";
import { registerSpineScanCorpusTool } from "./tools/spine-scan-corpus.js";
import { registerSpineCreateLoadingAnimationPresetTool } from "./tools/spine-create-loading-animation-preset.js";

interface ToolRegistration {
  name: string;
  register: (server: McpServer) => void;
}

const toolRegistrations: ToolRegistration[] = [
  { name: "spine_info", register: registerSpineInfoTool },
  { name: "spine_export", register: registerSpineExportTool },
  { name: "spine_import_json", register: registerSpineImportJsonTool },
  { name: "spine_clean", register: registerSpineCleanTool },
  { name: "spine_open_project", register: registerSpineOpenProjectTool },
  { name: "spine_analyze_json", register: registerSpineAnalyzeJsonTool },
  { name: "spine_generate_animation_json", register: registerSpineGenerateAnimationJsonTool },
  { name: "spine_add_simple_animation", register: registerSpineAddSimpleAnimationTool },
  { name: "spine_control_bones", register: registerSpineControlBonesTool },
  { name: "spine_scan_corpus", register: registerSpineScanCorpusTool },
  { name: "spine_learn_from_corpus", register: registerSpineLearnFromCorpusTool },
  { name: "spine_get_generation_guide", register: registerSpineGetGenerationGuideTool },
  { name: "spine_recommend_animation_params", register: registerSpineRecommendAnimationParamsTool },
  { name: "spine_build_animation_from_existing_project", register: registerSpineBuildAnimationFromExistingProjectTool },
  { name: "spine_build_animation_from_json", register: registerSpineBuildAnimationFromJsonTool },
  { name: "spine_create_loading_animation_preset", register: registerSpineCreateLoadingAnimationPresetTool },
];

const server = new McpServer({
  name: "spine-mcp",
  version: "0.1.0",
});

registerSpineRulesResource(server);

let registeredCount = 0;
const registeredNames: string[] = [];

for (const tool of toolRegistrations) {
  try {
    tool.register(server);
    registeredCount++;
    registeredNames.push(tool.name);
  } catch (error) {
    console.error(`[spine-mcp] Failed to register tool "${tool.name}":`, error);
  }
}

console.error(`[spine-mcp] Registering ${toolRegistrations.length} tools...`);
console.error(`[spine-mcp] Successfully registered ${registeredCount}/${toolRegistrations.length} tools`);
console.error(`[spine-mcp] Tools: ${registeredNames.join(", ")}`);

const transport = new StdioServerTransport();

server.connect(transport).catch((error: unknown) => {
  console.error("Failed to start spine-mcp server:", error);
  process.exitCode = 1;
});
