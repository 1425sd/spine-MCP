import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  loadKnowledge,
  recommendAnimationParams,
} from "../corpus/knowledge-loader.js";
import { formatJson, formatToolError, textContent } from "./common.js";
import { characterTypeSchema } from "./generated-tool-schemas.js";

const schema = {
  userGoal: z
    .string()
    .min(1)
    .describe("User's animation goal, for example a cute cat loading animation with blink and tail wag."),
  characterType: characterTypeSchema,
  availableAssetRoles: z
    .array(z.string().min(1))
    .optional()
    .describe("Optional asset roles currently available, such as body, head, tail, eye_left, eye_right."),
  knowledgeDir: z
    .string()
    .min(1)
    .optional()
    .describe("Directory containing learned knowledge files. Defaults to project knowledge/."),
};

export function registerSpineRecommendAnimationParamsTool(server: McpServer): void {
  server.tool(
    "spine_recommend_animation_params",
    "Use this to turn a user goal into recommended BasicAnimationRequest parameters using learned corpus presets and naming rules. It returns recommendedAnimations, duration, preset params, warnings, and a short reasoning summary. If knowledge is missing, it falls back to built-in defaults. Do not use it to write files, call Spine CLI, or build projects directly.",
    schema,
    async ({ userGoal, characterType, availableAssetRoles, knowledgeDir }) => {
      try {
        const knowledge = await loadKnowledge(knowledgeDir);
        const recommendation = recommendAnimationParams({
          userGoal,
          characterType,
          availableAssetRoles,
          presets: knowledge.presets,
          namingRules: knowledge.namingRules,
        });

        return textContent(
          formatJson({
            success: true,
            knowledgeFound: knowledge.exists,
            knowledgeDir: knowledge.knowledgeDir,
            ...recommendation,
            warnings: [...knowledge.warnings, ...recommendation.warnings],
          }),
        );
      } catch (error) {
        return textContent(formatToolError(error, "recommend_animation_params"));
      }
    },
  );
}
