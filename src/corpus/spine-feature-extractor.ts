import type {
  CorpusAnimationType,
  ExtractedAnimationFeatures,
  NumericRange,
  SpineProjectFeatures,
} from "../types/corpus-learning.js";

type JsonObject = Record<string, unknown>;

export function extractSpineFeatures(params: {
  projectPath: string;
  jsonPath: string;
  sourceType: ".json" | ".spine";
  json: unknown;
}): SpineProjectFeatures {
  if (!isObject(params.json)) {
    throw new Error("Spine JSON root must be an object.");
  }

  const root = params.json;
  const bones = asArray(root.bones);
  const slots = asArray(root.slots);
  const skins = asArray(root.skins);
  const animationsObject = isObject(root.animations) ? root.animations : {};
  const events = isObject(root.events) ? root.events : undefined;
  const attachmentInfo = extractAttachments(skins);
  const animationNames = Object.keys(animationsObject);
  const animations = animationNames.map((animationName) =>
    extractAnimationFeatures(animationName, animationsObject[animationName]),
  );

  return {
    projectPath: params.projectPath,
    jsonPath: params.jsonPath,
    sourceType: params.sourceType,
    spineVersion: isObject(root.skeleton) && typeof root.skeleton.spine === "string"
      ? root.skeleton.spine
      : undefined,
    skeletonName: isObject(root.skeleton) && typeof root.skeleton.name === "string"
      ? root.skeleton.name
      : undefined,
    bonesCount: bones.length,
    slotsCount: slots.length,
    skinsCount: skins.length,
    animationsCount: animationNames.length,
    attachmentsCount: attachmentInfo.attachmentNames.length,
    hasMesh: attachmentInfo.hasMesh,
    hasConstraints:
      asArray(root.ik).length > 0 ||
      asArray(root.transform).length > 0 ||
      asArray(root.path).length > 0 ||
      asArray(root.physics).length > 0 ||
      asArray(root.constraints).length > 0,
    hasEvents: Boolean(events && Object.keys(events).length > 0) ||
      animations.some((animation) => animation.timelinesUsed.includes("event")),
    boneNames: extractNamedItems(bones),
    slotNames: extractNamedItems(slots),
    skinNames: extractNamedItems(skins),
    attachmentNames: attachmentInfo.attachmentNames,
    animationNames,
    animations,
  };
}

export function classifyAnimationName(name: string): CorpusAnimationType {
  const normalized = name.toLowerCase().replace(/[\s._-]+/g, "");

  if (containsAny(normalized, ["idle", "stand", "loop"])) return "idle";
  if (containsAny(normalized, ["breathing", "breath", "breathe"])) return "breathing";
  if (containsAny(normalized, ["blink", "wink"])) return "blink";
  if (containsAny(normalized, ["walk"])) return "walk";
  if (containsAny(normalized, ["run"])) return "run";
  if (containsAny(normalized, ["jump"])) return "jump";
  if (containsAny(normalized, ["attack", "atk", "skill"])) return "attack";
  if (containsAny(normalized, ["hit", "hurt", "damage"])) return "hit";
  if (containsAny(normalized, ["die", "death", "dead"])) return "die";
  if (containsAny(normalized, ["tailwag", "tail"])) return "tail_wag";
  if (containsAny(normalized, ["wave"])) return "wave";
  if (containsAny(normalized, ["float", "hover"])) return "float";
  if (containsAny(normalized, ["bounce", "logo"])) return "logo_bounce";

  return "unknown";
}

function extractAnimationFeatures(
  animationName: string,
  animationValue: unknown,
): ExtractedAnimationFeatures {
  const animation = isObject(animationValue) ? animationValue : {};
  const bonesObject = isObject(animation.bones) ? animation.bones : {};
  const slotsObject = isObject(animation.slots) ? animation.slots : {};
  const timelinesUsed = new Set<string>();
  const rotateValues: number[] = [];
  const translateXValues: number[] = [];
  const translateYValues: number[] = [];
  const scaleValues: number[] = [];
  const allTimes: number[] = [];
  let keyframeCount = 0;
  let loopFriendlyVotes = 0;
  let loopFriendlyComparable = 0;

  for (const [boneName, boneTimelineValue] of Object.entries(bonesObject)) {
    if (!isObject(boneTimelineValue)) {
      continue;
    }

    for (const [timelineName, timelineValue] of Object.entries(boneTimelineValue)) {
      const keys = asArray(timelineValue);
      if (keys.length === 0) {
        continue;
      }

      timelinesUsed.add(timelineName);
      keyframeCount += countKeyframes(keys);
      collectTimes(keys, allTimes);

      if (timelineName === "rotate") {
        collectNumeric(keys, ["value", "angle"], rotateValues);
      } else if (timelineName === "translate") {
        collectNumeric(keys, ["x"], translateXValues);
        collectNumeric(keys, ["y"], translateYValues);
      } else if (timelineName === "scale") {
        collectNumeric(keys, ["x", "y"], scaleValues);
      }

      const loopFriendly = isTimelineLoopFriendly(keys, timelineName);
      if (loopFriendly !== undefined) {
        loopFriendlyComparable += 1;
        if (loopFriendly) {
          loopFriendlyVotes += 1;
        }
      }
    }

    void boneName;
  }

  for (const slotTimelineValue of Object.values(slotsObject)) {
    if (!isObject(slotTimelineValue)) {
      continue;
    }

    for (const [timelineName, timelineValue] of Object.entries(slotTimelineValue)) {
      const keys = asArray(timelineValue);
      if (keys.length === 0) {
        continue;
      }

      timelinesUsed.add(timelineName);
      keyframeCount += countKeyframes(keys);
      collectTimes(keys, allTimes);
    }
  }

  for (const topLevelTimeline of ["drawOrder", "events", "event"]) {
    const keys = asArray(animation[topLevelTimeline]);
    if (keys.length > 0) {
      timelinesUsed.add(topLevelTimeline === "events" ? "event" : topLevelTimeline);
      keyframeCount += countKeyframes(keys);
      collectTimes(keys, allTimes);
    }
  }

  return {
    animationName,
    animationType: classifyAnimationName(animationName),
    duration: maxNumber(allTimes) ?? 0,
    bonesAffected: Object.keys(bonesObject),
    slotsAffected: Object.keys(slotsObject),
    timelinesUsed: [...timelinesUsed].sort(),
    rotateRange: toRange(rotateValues),
    translateXRange: toRange(translateXValues),
    translateYRange: toRange(translateYValues),
    scaleRange: toRange(scaleValues),
    loopFriendly:
      loopFriendlyComparable > 0 && loopFriendlyVotes / loopFriendlyComparable >= 0.6,
    keyframeCount,
  };
}

function extractAttachments(skins: unknown[]): {
  attachmentNames: string[];
  hasMesh: boolean;
} {
  const attachmentNames = new Set<string>();
  let hasMesh = false;

  for (const skin of skins) {
    if (!isObject(skin) || !isObject(skin.attachments)) {
      continue;
    }

    for (const slotAttachments of Object.values(skin.attachments)) {
      if (!isObject(slotAttachments)) {
        continue;
      }

      for (const [attachmentName, attachmentValue] of Object.entries(slotAttachments)) {
        attachmentNames.add(attachmentName);

        if (isObject(attachmentValue)) {
          const type = typeof attachmentValue.type === "string"
            ? attachmentValue.type.toLowerCase()
            : "";
          if (
            type.includes("mesh") ||
            Array.isArray(attachmentValue.vertices) ||
            Array.isArray(attachmentValue.triangles)
          ) {
            hasMesh = true;
          }
        }
      }
    }
  }

  return {
    attachmentNames: [...attachmentNames].sort(),
    hasMesh,
  };
}

function extractNamedItems(items: unknown[]): string[] {
  return items
    .filter((item): item is JsonObject => isObject(item) && typeof item.name === "string")
    .map((item) => item.name as string);
}

function collectNumeric(
  keys: unknown[],
  propertyNames: string[],
  output: number[],
): void {
  for (const key of keys) {
    if (!isObject(key)) {
      continue;
    }

    for (const propertyName of propertyNames) {
      const value = key[propertyName];
      if (typeof value === "number" && Number.isFinite(value)) {
        output.push(value);
      }
    }
  }
}

function collectTimes(keys: unknown[], output: number[]): void {
  collectNumeric(keys, ["time"], output);
}

function countKeyframes(keys: unknown[]): number {
  return keys.filter((key) => isObject(key) && typeof key.time === "number").length;
}

function isTimelineLoopFriendly(
  keys: unknown[],
  timelineName: string,
): boolean | undefined {
  const comparableKeys = keys.filter(isObject);
  if (comparableKeys.length < 2) {
    return undefined;
  }

  const first = comparableKeys[0];
  const last = comparableKeys[comparableKeys.length - 1];

  if (timelineName === "rotate") {
    return areClose(getFirstNumber(first, ["value", "angle"]), getFirstNumber(last, ["value", "angle"]), 2);
  }

  if (timelineName === "translate" || timelineName === "scale") {
    const xClose = areClose(getFirstNumber(first, ["x"]), getFirstNumber(last, ["x"]), timelineName === "scale" ? 0.03 : 2);
    const yClose = areClose(getFirstNumber(first, ["y"]), getFirstNumber(last, ["y"]), timelineName === "scale" ? 0.03 : 2);
    return xClose && yClose;
  }

  return undefined;
}

function getFirstNumber(value: JsonObject, keys: string[]): number | undefined {
  for (const key of keys) {
    if (typeof value[key] === "number") {
      return value[key];
    }
  }

  return undefined;
}

function areClose(
  left: number | undefined,
  right: number | undefined,
  tolerance: number,
): boolean {
  if (left === undefined && right === undefined) {
    return true;
  }

  if (left === undefined || right === undefined) {
    return false;
  }

  return Math.abs(left - right) <= tolerance;
}

function toRange(values: number[]): NumericRange {
  if (values.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function maxNumber(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return Math.max(...values);
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
