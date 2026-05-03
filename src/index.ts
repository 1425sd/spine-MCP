#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSpineRulesResource } from "./resources/spine-rules.js";
import { registerSpineAnalyzeAssetsTool } from "./tools/spine-analyze-assets.js";
import { registerSpineBuildBasicAnimationWithKnowledgeTool } from "./tools/spine-build-basic-animation-with-knowledge.js";
import { registerSpineBuildBasicAnimationTool } from "./tools/spine-build-basic-animation.js";
import { registerSpineCleanTool } from "./tools/spine-clean.js";
import { registerSpineExportTool } from "./tools/spine-export.js";
import { registerSpineGenerateSimpleSkeletonJsonTool } from "./tools/spine-generate-simple-skeleton-json.js";
import { registerSpineGetGenerationGuideTool } from "./tools/spine-get-generation-guide.js";
import { registerSpineLearnFromCorpusTool } from "./tools/spine-learn-from-corpus.js";
import { registerSpineImportGeneratedJsonTool } from "./tools/spine-import-generated-json.js";
import { registerSpineImportJsonTool } from "./tools/spine-import-json.js";
import { registerSpineInfoTool } from "./tools/spine-info.js";
import { registerSpineOpenProjectTool } from "./tools/spine-open-project.js";
import { registerSpinePackTool } from "./tools/spine-pack.js";
import { registerSpineRecommendAnimationParamsTool } from "./tools/spine-recommend-animation-params.js";
import { registerSpineScanCorpusTool } from "./tools/spine-scan-corpus.js";
import { registerSpineValidateAssetsTool } from "./tools/spine-validate-assets.js";
import { registerSpineValidateGeneratedJsonTool } from "./tools/spine-validate-generated-json.js";

const server = new McpServer({
  name: "spine-mcp",
  version: "0.1.0",
});

registerSpineRulesResource(server);
registerSpineInfoTool(server);
registerSpineExportTool(server);
registerSpinePackTool(server);
registerSpineImportJsonTool(server);
registerSpineCleanTool(server);
registerSpineOpenProjectTool(server);
registerSpineValidateAssetsTool(server);
registerSpineAnalyzeAssetsTool(server);
registerSpineGenerateSimpleSkeletonJsonTool(server);
registerSpineValidateGeneratedJsonTool(server);
registerSpineImportGeneratedJsonTool(server);
registerSpineBuildBasicAnimationTool(server);
registerSpineScanCorpusTool(server);
registerSpineLearnFromCorpusTool(server);
registerSpineGetGenerationGuideTool(server);
registerSpineRecommendAnimationParamsTool(server);
registerSpineBuildBasicAnimationWithKnowledgeTool(server);

const transport = new StdioServerTransport();

server.connect(transport).catch((error: unknown) => {
  console.error("Failed to start spine-mcp server:", error);
  process.exitCode = 1;
});
