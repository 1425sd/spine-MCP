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
  request: Pick<
    BasicAnimationRequest,
    "animations" | "characterType" | "duration" | "presetParams"
  >;
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
      presetParams: params.request.presetParams?.[preset],
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
  presetParams: Record<string, number> | undefined;
  warnings: string[];
}): unknown | undefined {
  switch (params.preset) {
    case "idle":
      return buildIdle(
        params.partIndex,
        params.durationOverride ?? params.presetParams?.duration ?? 1.2,
        params.presetParams,
      );
    case "breathing":
      return buildBreathing(
        params.partIndex,
        params.durationOverride ?? params.presetParams?.duration ?? 1.6,
        params.presetParams,
      );
    case "blink":
      return buildBlink(
        params.partIndex,
        params.durationOverride ?? params.presetParams?.interval ?? 2,
        params.presetParams,
        params.warnings,
      );
    case "tail_wag":
      return buildTailWag(
        params.partIndex,
        params.durationOverride ?? params.presetParams?.duration ?? 1,
        params.presetParams,
        params.warnings,
      );
    case "head_bob":
      return buildHeadBob(
        params.partIndex,
        params.durationOverride ?? params.presetParams?.duration ?? 1.2,
        params.presetParams,
      );
    case "float":
      return buildFloat(
        params.durationOverride ?? params.presetParams?.duration ?? 2,
        params.presetParams,
      );
    case "logo_bounce":
      return buildLogoBounce(
        params.durationOverride ?? params.presetParams?.duration ?? 1.2,
        params.presetParams,
      );
    case "paw_wave":
      return buildPawWave(
        params.partIndex,
        params.durationOverride ?? params.presetParams?.duration ?? 1.2,
        params.presetParams,
        params.warnings,
      );
  }
}

function buildIdle(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const half = duration / 2;
  const bodyTranslateY = presetParams?.bodyTranslateY ?? 4;
  const headTranslateY = presetParams?.headTranslateY ?? 6;
  const bones: Record<string, unknown> = {
    [partIndex.has("body") ? "body" : "root"]: {
      translate: [
        { time: 0, y: 0 },
        { time: half, y: bodyTranslateY },
        { time: duration, y: 0 },
      ],
    },
  };

  if (partIndex.has("head")) {
    bones.head = {
      translate: [
        { time: 0, y: 0 },
        { time: half, y: headTranslateY },
        { time: duration, y: 0 },
      ],
    };
  }

  return { bones };
}

function buildBreathing(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const half = duration / 2;
  const minScale = presetParams?.minScale ?? 1;
  const maxScale = presetParams?.maxScale ?? 1.03;
  const bones: Record<string, unknown> = {
    [partIndex.has("body") ? "body" : "root"]: {
      scale: [
        { time: 0, x: minScale, y: minScale },
        { time: half, x: maxScale, y: maxScale },
        { time: duration, x: minScale, y: minScale },
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
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  const eyeParts = ["eye_left", "eye_right", "eye"]
    .map((role) => partIndex.get(role))
    .filter((part): part is RecommendedPart => part !== undefined);

  if (eyeParts.length === 0) {
    warnings.push("blink animation was requested, but no eye PNG was found.");
    return undefined;
  }

  const closedDuration = presetParams?.closedDuration ?? 0.08;
  const closeTime = Math.max(0.05, duration * 0.5);
  const openTime = Math.min(duration, closeTime + closedDuration);
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
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  if (!partIndex.has("tail")) {
    warnings.push("tail_wag animation was requested, but no tail PNG was found.");
    return undefined;
  }

  const minRotation = presetParams?.minRotation ?? -12;
  const maxRotation = presetParams?.maxRotation ?? 12;

  return {
    bones: {
      tail: {
        rotate: [
          { time: 0, value: minRotation },
          { time: duration / 2, value: maxRotation },
          { time: duration, value: minRotation },
        ],
      },
    },
  };
}

function buildHeadBob(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const targetBone = partIndex.has("head") ? "head" : "root";
  const translateY = presetParams?.translateY ?? 8;

  return {
    bones: {
      [targetBone]: {
        translate: [
          { time: 0, y: 0 },
          { time: duration / 2, y: translateY },
          { time: duration, y: 0 },
        ],
      },
    },
  };
}

function buildFloat(
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const translateY = presetParams?.translateY ?? 6;

  return {
    bones: {
      root: {
        translate: [
          { time: 0, y: -translateY },
          { time: duration / 2, y: translateY },
          { time: duration, y: -translateY },
        ],
      },
    },
  };
}

function buildLogoBounce(
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const translateY = presetParams?.translateY ?? 18;
  const minScale = presetParams?.minScale ?? 0.98;
  const maxScale = presetParams?.maxScale ?? 1.05;

  return {
    bones: {
      root: {
        translate: [
          { time: 0, y: 0 },
          { time: duration * 0.35, y: translateY },
          { time: duration * 0.65, y: -2 },
          { time: duration, y: 0 },
        ],
        scale: [
          { time: 0, x: 1, y: 1 },
          { time: duration * 0.35, x: maxScale, y: 0.95 },
          { time: duration * 0.65, x: minScale, y: 1.04 },
          { time: duration, x: 1, y: 1 },
        ],
      },
    },
  };
}

function buildPawWave(
  partIndex: Map<string, RecommendedPart>,
  duration: number,
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  const paw =
    partIndex.get("paw_right") ?? partIndex.get("paw_left") ?? partIndex.get("paw");

  if (!paw) {
    warnings.push("paw_wave animation was requested, but no paw PNG was found.");
    return undefined;
  }

  const minRotation = presetParams?.minRotation ?? -15;
  const maxRotation = presetParams?.maxRotation ?? 15;

  return {
    bones: {
      [paw.boneName]: {
        rotate: [
          { time: 0, value: 0 },
          { time: duration * 0.25, value: minRotation },
          { time: duration * 0.5, value: maxRotation },
          { time: duration * 0.75, value: -10 },
          { time: duration, value: 0 },
        ],
      },
    },
  };
}
