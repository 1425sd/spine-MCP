import type { RecommendedPart } from "../types/asset-analysis.js";
import type {
  BasicAnimationPresetName,
  BasicAnimationRequest,
} from "../types/generated-spine.js";

export type SpineAnimations = Record<string, unknown>;

export interface AnimationPresetBuildResult {
  animations: SpineAnimations;
  selectedAnimations: BasicAnimationPresetName[];
  warnings: string[];
}

export function resolveAnimationPresets(
  request: Pick<BasicAnimationRequest, "animations" | "characterType">,
): BasicAnimationPresetName[] {
  if (request.animations?.length) {
    return [...new Set(request.animations)];
  }

  switch (request.characterType) {
    case "cat":
      return ["idle", "breathing", "blink", "tail_wag"];
    case "logo":
      return ["logo_bounce", "float"];
    case "mascot":
      return ["idle", "breathing", "blink", "head_bob"];
    case "generic":
    default:
      return ["idle"];
  }
}

export function buildAnimationPresets(params: {
  request: Pick<BasicAnimationRequest, "animations" | "characterType" | "duration">;
  parts: RecommendedPart[];
}): AnimationPresetBuildResult {
  const selectedAnimations = resolveAnimationPresets(params.request);
  const partIndex = new Map(params.parts.map((part) => [part.role, part]));
  const warnings: string[] = [];
  const animations: SpineAnimations = {};

  for (const preset of selectedAnimations) {
    const animation = buildPresetAnimation({
      preset,
      partIndex,
      durationOverride: params.request.duration,
      warnings,
    });

    if (animation) {
      animations[preset] = animation;
    }
  }

  return {
    animations,
    selectedAnimations,
    warnings,
  };
}

function buildPresetAnimation(params: {
  preset: BasicAnimationPresetName;
  partIndex: Map<string, RecommendedPart>;
  durationOverride: number | undefined;
  warnings: string[];
}): unknown | undefined {
  switch (params.preset) {
    case "idle":
      return buildIdle(params.partIndex, params.durationOverride ?? 1.2);
    case "breathing":
      return buildBreathing(params.partIndex, params.durationOverride ?? 1.6);
    case "blink":
      return buildBlink(params.partIndex, params.durationOverride ?? 2, params.warnings);
    case "tail_wag":
      return buildTailWag(params.partIndex, params.durationOverride ?? 1, params.warnings);
    case "head_bob":
      return buildHeadBob(params.partIndex, params.durationOverride ?? 1.2);
    case "float":
      return buildFloat(params.durationOverride ?? 2);
    case "logo_bounce":
      return buildLogoBounce(params.durationOverride ?? 1.2);
    case "paw_wave":
      return buildPawWave(params.partIndex, params.durationOverride ?? 1.2, params.warnings);
  }
}

function buildIdle(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
): unknown {
  const half = duration / 2;
  const bones: Record<string, unknown> = {
    [partIndex.has("body") ? "body" : "root"]: {
      translate: [
        { time: 0, y: 0 },
        { time: half, y: 4 },
        { time: duration, y: 0 },
      ],
    },
  };

  if (partIndex.has("head")) {
    bones.head = {
      translate: [
        { time: 0, y: 0 },
        { time: half, y: 6 },
        { time: duration, y: 0 },
      ],
    };
  }

  return { bones };
}

function buildBreathing(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
): unknown {
  const half = duration / 2;
  const bones: Record<string, unknown> = {
    [partIndex.has("body") ? "body" : "root"]: {
      scale: [
        { time: 0, x: 1, y: 1 },
        { time: half, x: 1.03, y: 1.03 },
        { time: duration, x: 1, y: 1 },
      ],
    },
  };

  if (partIndex.has("head")) {
    bones.head = {
      translate: [
        { time: 0, y: 0 },
        { time: half, y: 3 },
        { time: duration, y: 0 },
      ],
    };
  }

  return { bones };
}

function buildBlink(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  warnings: string[],
): unknown | undefined {
  const eyeParts = ["eye_left", "eye_right", "eye"]
    .map((role) => partIndex.get(role))
    .filter((part): part is RecommendedPart => part !== undefined);

  if (eyeParts.length === 0) {
    warnings.push("blink animation was requested, but no eye PNG was found.");
    return undefined;
  }

  const closeTime = Math.max(0.05, duration * 0.5);
  const openTime = Math.min(duration, closeTime + 0.08);
  const slots: Record<string, unknown> = {};

  for (const part of eyeParts) {
    slots[part.slotName] = {
      attachment: [
        { time: 0, name: part.attachmentName },
        { time: closeTime, name: null },
        { time: openTime, name: part.attachmentName },
        { time: duration, name: part.attachmentName },
      ],
    };
  }

  return { slots };
}

function buildTailWag(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  warnings: string[],
): unknown | undefined {
  if (!partIndex.has("tail")) {
    warnings.push("tail_wag animation was requested, but no tail PNG was found.");
    return undefined;
  }

  return {
    bones: {
      tail: {
        rotate: [
          { time: 0, value: -12 },
          { time: duration / 2, value: 12 },
          { time: duration, value: -12 },
        ],
      },
    },
  };
}

function buildHeadBob(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
): unknown {
  const targetBone = partIndex.has("head") ? "head" : "root";

  return {
    bones: {
      [targetBone]: {
        translate: [
          { time: 0, y: 0 },
          { time: duration / 2, y: 8 },
          { time: duration, y: 0 },
        ],
      },
    },
  };
}

function buildFloat(duration: number): unknown {
  return {
    bones: {
      root: {
        translate: [
          { time: 0, y: -6 },
          { time: duration / 2, y: 6 },
          { time: duration, y: -6 },
        ],
      },
    },
  };
}

function buildLogoBounce(duration: number): unknown {
  return {
    bones: {
      root: {
        translate: [
          { time: 0, y: 0 },
          { time: duration * 0.35, y: 18 },
          { time: duration * 0.65, y: -2 },
          { time: duration, y: 0 },
        ],
        scale: [
          { time: 0, x: 1, y: 1 },
          { time: duration * 0.35, x: 1.05, y: 0.95 },
          { time: duration * 0.65, x: 0.98, y: 1.04 },
          { time: duration, x: 1, y: 1 },
        ],
      },
    },
  };
}

function buildPawWave(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  warnings: string[],
): unknown | undefined {
  const paw =
    partIndex.get("paw_right") ?? partIndex.get("paw_left") ?? partIndex.get("paw");

  if (!paw) {
    warnings.push("paw_wave animation was requested, but no paw PNG was found.");
    return undefined;
  }

  return {
    bones: {
      [paw.boneName]: {
        rotate: [
          { time: 0, value: 0 },
          { time: duration * 0.25, value: -15 },
          { time: duration * 0.5, value: 15 },
          { time: duration * 0.75, value: -10 },
          { time: duration, value: 0 },
        ],
      },
    },
  };
}
