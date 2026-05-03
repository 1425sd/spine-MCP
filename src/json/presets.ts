import type { JsonAnimationKind } from "./types.js";

export type LoadingAnimationPreset =
  | "cute_cat_loading"
  | "logo_bounce"
  | "breathing_idle"
  | "floating_character"
  | "blink_loop";

export interface LoadingPresetConfig {
  preset: LoadingAnimationPreset;
  userGoal: string;
  characterType: string;
  animationName: string;
  duration: number;
  kinds: JsonAnimationKind[];
}

export function resolveLoadingPreset(params: {
  preset: string;
  duration?: number;
}): LoadingPresetConfig {
  switch (params.preset) {
    case "cute_cat_loading":
      return {
        preset: "cute_cat_loading",
        userGoal: "cute cat loading animation with breathing, head float, tail swing, and blink",
        characterType: "cat",
        animationName: "cute_cat_loading",
        duration: params.duration ?? 2,
        kinds: ["breathing", "head_float", "tail_swing", "blink"],
      };
    case "logo_bounce":
      return {
        preset: "logo_bounce",
        userGoal: "logo bounce loading animation",
        characterType: "logo",
        animationName: "logo_bounce",
        duration: params.duration ?? 1.4,
        kinds: ["logo_bounce"],
      };
    case "breathing_idle":
      return {
        preset: "breathing_idle",
        userGoal: "soft idle breathing animation",
        characterType: "generic",
        animationName: "breathing_idle",
        duration: params.duration ?? 2,
        kinds: ["breathing", "head_float"],
      };
    case "floating_character":
      return {
        preset: "floating_character",
        userGoal: "floating character loading animation",
        characterType: "generic",
        animationName: "floating_character",
        duration: params.duration ?? 2.4,
        kinds: ["floating", "head_float"],
      };
    case "blink_loop":
      return {
        preset: "blink_loop",
        userGoal: "looping blink animation",
        characterType: "generic",
        animationName: "blink_loop",
        duration: params.duration ?? 2,
        kinds: ["blink"],
      };
    default:
      throw new Error(
        `Unsupported loading animation preset "${params.preset}". Supported presets: cute_cat_loading, logo_bounce, breathing_idle, floating_character, blink_loop.`,
      );
  }
}

export function resolveAnimationKinds(params: {
  userGoal: string;
  characterType?: string;
}): JsonAnimationKind[] {
  const goal = params.userGoal.toLowerCase();
  const characterType = params.characterType?.toLowerCase();
  const kinds = new Set<JsonAnimationKind>();

  if (characterType === "cat") {
    kinds.add("breathing");
    kinds.add("head_float");
    kinds.add("tail_swing");
    kinds.add("blink");
  } else if (characterType === "logo") {
    kinds.add("logo_bounce");
  } else if (characterType === "mascot") {
    kinds.add("breathing");
    kinds.add("head_float");
    kinds.add("blink");
  }

  if (containsAny(goal, ["breath", "breathe", "\u547c\u5438"])) {
    kinds.add("breathing");
  }
  if (containsAny(goal, ["head", "bob", "\u5934"])) {
    kinds.add("head_float");
  }
  if (containsAny(goal, ["tail", "wag", "swing", "\u5c3e\u5df4"])) {
    kinds.add("tail_swing");
  }
  if (containsAny(goal, ["blink", "wink", "\u7728", "\u773c"])) {
    kinds.add("blink");
  }
  if (containsAny(goal, ["paw", "wave", "hand", "\u722a", "\u6325"])) {
    kinds.add("paw_wave");
  }
  if (containsAny(goal, ["logo", "bounce", "\u6807", "\u5f39"])) {
    kinds.add("logo_bounce");
  }
  if (containsAny(goal, ["float", "hover", "\u6f02"])) {
    kinds.add("floating");
  }

  if (kinds.size === 0) {
    kinds.add("floating");
  }

  return [...kinds];
}

export function getIntensityMultiplier(
  intensity: "soft" | "normal" | "strong" | undefined,
): number {
  switch (intensity) {
    case "soft":
      return 0.65;
    case "strong":
      return 1.45;
    case "normal":
    default:
      return 1;
  }
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
