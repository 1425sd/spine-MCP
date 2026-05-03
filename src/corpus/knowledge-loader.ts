import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnimationRecommendation,
  LearnedAnimationPresets,
  LearnedNamingRules,
  LearnedSpineStats,
  LoadedKnowledge,
} from "../types/corpus-learning.js";
import type { BasicAnimationPresetName } from "../types/generated-spine.js";
import { KNOWLEDGE_FILE_NAMES } from "./guide-generator.js";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

export function getDefaultKnowledgeDir(): string {
  return path.join(PROJECT_ROOT, "knowledge");
}

export function getCorpusCacheRoot(): string {
  return path.join(PROJECT_ROOT, ".cache", "corpus-json");
}

export async function loadKnowledge(
  knowledgeDir?: string,
): Promise<LoadedKnowledge> {
  const resolvedKnowledgeDir = path.resolve(knowledgeDir ?? getDefaultKnowledgeDir());
  const warnings: string[] = [];
  const guidePath = path.join(resolvedKnowledgeDir, KNOWLEDGE_FILE_NAMES.guide);
  const presetsPath = path.join(resolvedKnowledgeDir, KNOWLEDGE_FILE_NAMES.presets);
  const namingPath = path.join(resolvedKnowledgeDir, KNOWLEDGE_FILE_NAMES.namingRules);
  const statsPath = path.join(resolvedKnowledgeDir, KNOWLEDGE_FILE_NAMES.stats);

  if (!(await pathExists(guidePath)) || !(await pathExists(presetsPath)) || !(await pathExists(namingPath))) {
    return {
      exists: false,
      knowledgeDir: resolvedKnowledgeDir,
      warnings: [
        `Knowledge files not found in ${resolvedKnowledgeDir}. Please run spine_learn_from_corpus first.`,
      ],
    };
  }

  let guideMarkdown: string | undefined;
  let presets: LearnedAnimationPresets | undefined;
  let namingRules: LearnedNamingRules | undefined;
  let stats: LearnedSpineStats | undefined;

  try {
    guideMarkdown = await readFile(guidePath, "utf8");
  } catch (error) {
    warnings.push(`Could not read guide: ${errorToMessage(error)}`);
  }

  try {
    presets = JSON.parse(await readFile(presetsPath, "utf8")) as LearnedAnimationPresets;
  } catch (error) {
    warnings.push(`Could not read animation presets: ${errorToMessage(error)}`);
  }

  try {
    namingRules = JSON.parse(await readFile(namingPath, "utf8")) as LearnedNamingRules;
  } catch (error) {
    warnings.push(`Could not read naming rules: ${errorToMessage(error)}`);
  }

  if (await pathExists(statsPath)) {
    try {
      stats = JSON.parse(await readFile(statsPath, "utf8")) as LearnedSpineStats;
    } catch (error) {
      warnings.push(`Could not read learned stats: ${errorToMessage(error)}`);
    }
  }

  return {
    exists: Boolean(guideMarkdown && presets && namingRules),
    knowledgeDir: resolvedKnowledgeDir,
    guideMarkdown,
    stats,
    presets,
    namingRules,
    warnings,
  };
}

export function recommendAnimationParams(params: {
  userGoal: string;
  characterType?: "cat" | "mascot" | "logo" | "generic";
  availableAssetRoles?: string[];
  presets?: LearnedAnimationPresets;
  namingRules?: LearnedNamingRules;
}): AnimationRecommendation {
  const warnings: string[] = [];
  const normalizedGoal = params.userGoal.toLowerCase();
  const roles = new Set((params.availableAssetRoles ?? []).map((role) => role.toLowerCase()));
  const inferredCharacterType = params.characterType ?? inferCharacterType(normalizedGoal);
  const recommendedAnimations = selectAnimations({
    normalizedGoal,
    characterType: inferredCharacterType,
    roles,
    warnings,
  });
  const presets = params.presets ?? defaultPresets();
  const recommendedPresetParams = pickPresetParams(recommendedAnimations, presets);
  const recommendedDuration = chooseRecommendedDuration(recommendedAnimations, presets);

  return {
    recommendedAnimations,
    recommendedDuration,
    recommendedPresetParams,
    warnings,
    reasoningSummary: buildReasoningSummary({
      characterType: inferredCharacterType,
      animations: recommendedAnimations,
      hasKnowledge: Boolean(params.presets && params.namingRules),
    }),
    requestPatch: {
      animations: recommendedAnimations,
      duration: recommendedDuration,
      presetParams: recommendedPresetParams,
    },
  };
}

function selectAnimations(params: {
  normalizedGoal: string;
  characterType: "cat" | "mascot" | "logo" | "generic";
  roles: Set<string>;
  warnings: string[];
}): BasicAnimationPresetName[] {
  const animations = new Set<BasicAnimationPresetName>();
  const hasExplicitRoles = params.roles.size > 0;

  if (params.characterType === "cat") {
    ["idle", "breathing", "blink", "tail_wag"].forEach((name) =>
      animations.add(name as BasicAnimationPresetName),
    );
  } else if (params.characterType === "logo") {
    animations.add("logo_bounce");
    animations.add("float");
  } else if (params.characterType === "mascot") {
    animations.add("idle");
    animations.add("breathing");
    animations.add("blink");
  } else {
    animations.add("idle");
  }

  if (containsAny(params.normalizedGoal, ["float", "漂浮", "hover"])) animations.add("float");
  if (containsAny(params.normalizedGoal, ["blink", "眨眼", "wink"])) animations.add("blink");
  if (containsAny(params.normalizedGoal, ["tail", "尾巴", "wag"])) animations.add("tail_wag");
  if (containsAny(params.normalizedGoal, ["bounce", "弹跳", "logo"])) animations.add("logo_bounce");
  if (containsAny(params.normalizedGoal, ["wave", "挥手", "paw"])) animations.add("paw_wave");
  if (containsAny(params.normalizedGoal, ["head", "头", "bob"])) animations.add("head_bob");
  if (containsAny(params.normalizedGoal, ["breath", "呼吸"])) animations.add("breathing");

  if (hasExplicitRoles && !hasAny(params.roles, ["tail"]) && animations.delete("tail_wag")) {
    params.warnings.push("tail_wag was recommended by goal/type, but no tail asset role is available.");
  }

  if (
    hasExplicitRoles &&
    !hasAny(params.roles, ["eye", "eye_left", "eye_right"]) &&
    animations.delete("blink")
  ) {
    params.warnings.push("blink was recommended by goal/type, but no eye asset role is available.");
  }

  if (
    hasExplicitRoles &&
    !hasAny(params.roles, ["paw", "paw_left", "paw_right"]) &&
    animations.delete("paw_wave")
  ) {
    params.warnings.push("paw_wave was recommended by goal/type, but no paw asset role is available.");
  }

  if (animations.size === 0) {
    animations.add("idle");
  }

  return [...animations];
}

function pickPresetParams(
  animations: BasicAnimationPresetName[],
  presets: LearnedAnimationPresets,
): Partial<Record<BasicAnimationPresetName, Record<string, number>>> {
  const result: Partial<Record<BasicAnimationPresetName, Record<string, number>>> = {};

  for (const animation of animations) {
    const preset = presets[animation];
    if (preset) {
      result[animation] = { ...preset };
    }
  }

  return result;
}

function chooseRecommendedDuration(
  animations: BasicAnimationPresetName[],
  presets: LearnedAnimationPresets,
): number {
  const first = animations[0];
  const preset = first ? presets[first] : undefined;
  if (preset && "duration" in preset && typeof preset.duration === "number") {
    return preset.duration;
  }
  if (first === "blink") return presets.blink.interval;
  return 1.2;
}

function inferCharacterType(goal: string): "cat" | "mascot" | "logo" | "generic" {
  if (containsAny(goal, ["cat", "kitten", "小猫", "猫"])) return "cat";
  if (containsAny(goal, ["logo", "标志"])) return "logo";
  if (containsAny(goal, ["mascot", "吉祥物"])) return "mascot";
  return "generic";
}

function buildReasoningSummary(params: {
  characterType: string;
  animations: BasicAnimationPresetName[];
  hasKnowledge: boolean;
}): string {
  const source = params.hasKnowledge ? "learned corpus presets" : "built-in fallback presets";
  return `Selected ${params.animations.join(", ")} for ${params.characterType} using ${source}.`;
}

function defaultPresets(): LearnedAnimationPresets {
  return {
    idle: { duration: 1.2, bodyTranslateY: 4, headTranslateY: 6 },
    breathing: { duration: 1.6, minScale: 1, maxScale: 1.03 },
    blink: { interval: 2, closedDuration: 0.12 },
    tail_wag: { duration: 1, minRotation: -12, maxRotation: 12 },
    head_bob: { duration: 1.2, translateY: 8 },
    float: { duration: 2, translateY: 6 },
    logo_bounce: { duration: 1.2, translateY: 18, minScale: 0.98, maxScale: 1.05 },
    paw_wave: { duration: 1.2, minRotation: -15, maxRotation: 15 },
  };
}

function hasAny(values: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await stat(inputPath);
    return true;
  } catch {
    return false;
  }
}

function errorToMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
