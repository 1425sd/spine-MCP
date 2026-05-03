import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeSpineJsonObject,
  readSpineJsonFile,
} from "./analyze-spine-json.js";
import {
  getIntensityMultiplier,
  resolveAnimationKinds,
} from "./presets.js";
import type {
  AddSimpleAnimationRequest,
  GenerateAnimationJsonRequest,
  GenerateAnimationJsonResult,
  InferredRoleName,
  InferredRoleTarget,
  JsonAnimationKind,
  JsonAnimationManifest,
  JsonAnimationModification,
  SimpleBoneKeyframe,
  SpineJsonObject,
} from "./types.js";

type AnimationObject = Record<string, unknown>;

export async function generateAnimationJson(
  request: GenerateAnimationJsonRequest,
): Promise<GenerateAnimationJsonResult> {
  const sourceJsonPath = path.resolve(request.sourceJsonPath);
  const outputJsonPath = path.resolve(request.outputJsonPath);
  const animationName = request.animationName ?? "generated_loop";
  const duration = request.duration ?? 2;
  const loop = request.loop ?? true;
  const selectedKinds = request.selectedKinds?.length
    ? request.selectedKinds
    : resolveAnimationKinds({
      userGoal: request.userGoal,
      characterType: request.characterType,
    });

  await assertWritableOutput(outputJsonPath, request.overwrite ?? false);

  const sourceJson = await readSpineJsonFile(sourceJsonPath);
  const nextJson = cloneJsonObject(sourceJson);
  const analysis = analyzeSpineJsonObject(nextJson, sourceJsonPath);
  const animations = ensureObjectProperty(nextJson, "animations");

  assertAnimationWriteAllowed(animations, animationName, request.overwrite ?? false);

  if (request.imagesPath) {
    const skeleton = ensureObjectProperty(nextJson, "skeleton");
    skeleton.images = request.imagesPath;
  }

  const warnings = [...analysis.warnings];
  const animation = createPresetAnimation({
    selectedKinds,
    analysis,
    duration,
    intensity: request.intensity,
    warnings,
  });

  animations[animationName] = animation.animation;
  await writeJsonFile(outputJsonPath, nextJson);

  const manifestPath = await writeJsonAnimationManifest({
    outputJsonPath,
    manifest: {
      tool: "spine_generate_animation_json",
      request,
      sourceJsonPath,
      outputJsonPath,
      animationName,
      modifications: animation.modifications,
      warnings,
      createdAt: new Date().toISOString(),
    },
  });

  return {
    sourceJsonPath,
    outputJsonPath,
    manifestPath,
    animationName,
    duration,
    loop,
    selectedKinds,
    analysis,
    modifications: animation.modifications,
    warnings,
  };
}

export async function addSimpleBoneAnimation(
  request: AddSimpleAnimationRequest,
): Promise<{
  sourceJsonPath: string;
  outputJsonPath: string;
  manifestPath: string;
  animationName: string;
  modification: JsonAnimationModification;
  warnings: string[];
}> {
  const sourceJsonPath = path.resolve(request.sourceJsonPath);
  const outputJsonPath = path.resolve(request.outputJsonPath);
  await assertWritableOutput(outputJsonPath, request.overwrite ?? false);

  const sourceJson = await readSpineJsonFile(sourceJsonPath);
  const nextJson = cloneJsonObject(sourceJson);
  const analysis = analyzeSpineJsonObject(nextJson, sourceJsonPath);
  const warnings = [...analysis.warnings];

  if (!analysis.bones.some((bone) => bone.name === request.targetBone)) {
    throw new Error(`targetBone does not exist in source JSON: ${request.targetBone}`);
  }

  const animations = ensureObjectProperty(nextJson, "animations");
  assertAnimationWriteAllowed(animations, request.animationName, request.overwrite ?? false);

  animations[request.animationName] = {
    bones: {
      [request.targetBone]: {
        [request.animationType]: normalizeSimpleKeyframes(
          request.animationType,
          request.keyframes,
        ),
      },
    },
  };

  await writeJsonFile(outputJsonPath, nextJson);

  const modification: JsonAnimationModification = {
    kind: "custom",
    target: request.targetBone,
    timeline: request.animationType,
    keyframeCount: request.keyframes.length,
  };
  const manifestPath = await writeJsonAnimationManifest({
    outputJsonPath,
    manifest: {
      tool: "spine_add_simple_animation",
      request,
      sourceJsonPath,
      outputJsonPath,
      animationName: request.animationName,
      modifications: [modification],
      warnings,
      createdAt: new Date().toISOString(),
    },
  });

  return {
    sourceJsonPath,
    outputJsonPath,
    manifestPath,
    animationName: request.animationName,
    modification,
    warnings,
  };
}

export async function writeJsonAnimationManifest(params: {
  outputJsonPath: string;
  manifest: JsonAnimationManifest;
}): Promise<string> {
  const manifestPath = path.join(path.dirname(params.outputJsonPath), "generation.manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(params.manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

function createPresetAnimation(params: {
  selectedKinds: JsonAnimationKind[];
  analysis: ReturnType<typeof analyzeSpineJsonObject>;
  duration: number;
  intensity?: "soft" | "normal" | "strong";
  warnings: string[];
}): {
  animation: AnimationObject;
  modifications: JsonAnimationModification[];
} {
  const animation: AnimationObject = {};
  const modifications: JsonAnimationModification[] = [];
  const multiplier = getIntensityMultiplier(params.intensity);

  for (const kind of params.selectedKinds) {
    switch (kind) {
      case "breathing":
        addBreathing(animation, params.analysis, params.duration, multiplier, params.warnings, modifications);
        break;
      case "head_float":
        addHeadFloat(animation, params.analysis, params.duration, multiplier, params.warnings, modifications);
        break;
      case "tail_swing":
        addTailSwing(animation, params.analysis, params.duration, multiplier, params.warnings, modifications);
        break;
      case "blink":
        addBlink(animation, params.analysis, params.duration, params.warnings, modifications);
        break;
      case "paw_wave":
        addPawWave(animation, params.analysis, params.duration, multiplier, params.warnings, modifications);
        break;
      case "logo_bounce":
        addLogoBounce(animation, params.analysis, params.duration, multiplier, modifications);
        break;
      case "floating":
        addFloating(animation, params.analysis, params.duration, multiplier, modifications);
        break;
    }
  }

  if (modifications.length === 0) {
    addFloating(animation, params.analysis, params.duration, multiplier, modifications);
    params.warnings.push("No requested target bones or slots were inferred. Added a root floating fallback.");
  }

  return { animation, modifications };
}

function addBreathing(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  multiplier: number,
  warnings: string[],
  modifications: JsonAnimationModification[],
): void {
  const target = getRole(analysis, ["body", "root"]);
  if (!target?.boneName) {
    warnings.push("breathing requested, but no body/root bone was inferred.");
    return;
  }

  const maxScale = 1 + 0.03 * multiplier;
  setBoneTimeline(animation, target.boneName, "scale", [
    { time: 0, x: 1, y: 1 },
    { time: duration / 2, x: round(maxScale), y: round(maxScale) },
    { time: duration, x: 1, y: 1 },
  ]);
  modifications.push({
    kind: "breathing",
    target: target.boneName,
    timeline: "scale",
    keyframeCount: 3,
  });
}

function addHeadFloat(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  multiplier: number,
  warnings: string[],
  modifications: JsonAnimationModification[],
): void {
  const target = getRole(analysis, ["head"]);
  if (!target?.boneName) {
    warnings.push("head_float requested, but no head bone was inferred.");
    return;
  }

  const y = round(6 * multiplier);
  setBoneTimeline(animation, target.boneName, "translate", [
    { time: 0, y: 0 },
    { time: duration / 2, y },
    { time: duration, y: 0 },
  ]);
  modifications.push({
    kind: "head_float",
    target: target.boneName,
    timeline: "translate",
    keyframeCount: 3,
  });
}

function addTailSwing(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  multiplier: number,
  warnings: string[],
  modifications: JsonAnimationModification[],
): void {
  const target = getRole(analysis, ["tail"]);
  if (!target?.boneName) {
    warnings.push("tail_swing requested, but no tail bone was inferred.");
    return;
  }

  const angle = round(12 * multiplier);
  setBoneTimeline(animation, target.boneName, "rotate", [
    { time: 0, angle: -angle },
    { time: duration / 2, angle },
    { time: duration, angle: -angle },
  ]);
  modifications.push({
    kind: "tail_swing",
    target: target.boneName,
    timeline: "rotate",
    keyframeCount: 3,
  });
}

function addBlink(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  warnings: string[],
  modifications: JsonAnimationModification[],
): void {
  const targets = [
    getRole(analysis, ["eye_left"]),
    getRole(analysis, ["eye_right"]),
  ].filter((target): target is InferredRoleTarget => Boolean(target));
  const eyeTargets = targets.length ? targets : [getRole(analysis, ["eye"])].filter(
    (target): target is InferredRoleTarget => Boolean(target),
  );

  if (eyeTargets.length === 0) {
    warnings.push("blink requested, but no eye slot or eye bone was inferred.");
    return;
  }

  const closeTime = round(duration * 0.5);
  const openTime = round(Math.min(duration, closeTime + 0.12));

  for (const target of eyeTargets) {
    if (target.slotName && target.attachmentName) {
      setSlotTimeline(animation, target.slotName, "attachment", [
        { time: 0, name: target.attachmentName },
        { time: closeTime, name: null },
        { time: openTime, name: target.attachmentName },
        { time: duration, name: target.attachmentName },
      ]);
      modifications.push({
        kind: "blink",
        target: target.slotName,
        timeline: "attachment",
        keyframeCount: 4,
      });
      continue;
    }

    if (target.boneName) {
      setBoneTimeline(animation, target.boneName, "scale", [
        { time: 0, x: 1, y: 1 },
        { time: closeTime, x: 1, y: 0.05 },
        { time: openTime, x: 1, y: 1 },
        { time: duration, x: 1, y: 1 },
      ]);
      modifications.push({
        kind: "blink",
        target: target.boneName,
        timeline: "scale",
        keyframeCount: 4,
        note: "No eye attachment was available, so blink uses bone scale.",
      });
    }
  }
}

function addPawWave(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  multiplier: number,
  warnings: string[],
  modifications: JsonAnimationModification[],
): void {
  const target = getRole(analysis, ["paw_right", "paw_left", "paw"]);
  if (!target?.boneName) {
    warnings.push("paw_wave requested, but no paw/hand/arm bone was inferred.");
    return;
  }

  const angle = round(16 * multiplier);
  setBoneTimeline(animation, target.boneName, "rotate", [
    { time: 0, angle: 0 },
    { time: duration * 0.25, angle: -angle },
    { time: duration * 0.5, angle },
    { time: duration * 0.75, angle: -angle },
    { time: duration, angle: 0 },
  ]);
  modifications.push({
    kind: "paw_wave",
    target: target.boneName,
    timeline: "rotate",
    keyframeCount: 5,
  });
}

function addLogoBounce(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  multiplier: number,
  modifications: JsonAnimationModification[],
): void {
  const target = getRole(analysis, ["logo", "root"])?.boneName ?? analysis.bones[0]?.name ?? "root";
  const y = round(18 * multiplier);
  const maxScale = round(1 + 0.05 * multiplier);
  const minScale = round(1 - 0.02 * multiplier);

  setBoneTimeline(animation, target, "translate", [
    { time: 0, y: 0 },
    { time: duration * 0.35, y },
    { time: duration * 0.65, y: round(-2 * multiplier) },
    { time: duration, y: 0 },
  ]);
  setBoneTimeline(animation, target, "scale", [
    { time: 0, x: 1, y: 1 },
    { time: duration * 0.35, x: maxScale, y: round(0.95) },
    { time: duration * 0.65, x: minScale, y: round(1.04) },
    { time: duration, x: 1, y: 1 },
  ]);
  modifications.push({
    kind: "logo_bounce",
    target,
    timeline: "translate",
    keyframeCount: 4,
  });
  modifications.push({
    kind: "logo_bounce",
    target,
    timeline: "scale",
    keyframeCount: 4,
  });
}

function addFloating(
  animation: AnimationObject,
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  duration: number,
  multiplier: number,
  modifications: JsonAnimationModification[],
): void {
  const target = getRole(analysis, ["body", "root"])?.boneName ?? analysis.bones[0]?.name ?? "root";
  const y = round(8 * multiplier);
  setBoneTimeline(animation, target, "translate", [
    { time: 0, y: -y },
    { time: duration / 2, y },
    { time: duration, y: -y },
  ]);
  modifications.push({
    kind: "floating",
    target,
    timeline: "translate",
    keyframeCount: 3,
  });
}

function normalizeSimpleKeyframes(
  animationType: "rotate" | "translate" | "scale",
  keyframes: SimpleBoneKeyframe[],
): Array<Record<string, number>> {
  if (keyframes.length === 0) {
    throw new Error("keyframes must contain at least one keyframe.");
  }

  return keyframes.map((keyframe) => {
    if (typeof keyframe.time !== "number") {
      throw new Error("Every keyframe must include numeric time.");
    }

    if (animationType === "rotate") {
      const angle = keyframe.angle ?? keyframe.value;
      if (typeof angle !== "number") {
        throw new Error("Rotate keyframes require angle or value.");
      }
      return { time: keyframe.time, angle };
    }

    if (animationType === "translate") {
      const frame: Record<string, number> = { time: keyframe.time };
      if (typeof keyframe.x === "number") frame.x = keyframe.x;
      if (typeof keyframe.y === "number") frame.y = keyframe.y;
      return frame;
    }

    return {
      time: keyframe.time,
      x: typeof keyframe.x === "number" ? keyframe.x : 1,
      y: typeof keyframe.y === "number" ? keyframe.y : 1,
    };
  });
}

function setBoneTimeline(
  animation: AnimationObject,
  boneName: string,
  timelineName: "rotate" | "translate" | "scale",
  keyframes: unknown[],
): void {
  const bones = ensureObjectProperty(animation, "bones");
  const bone = ensureObjectProperty(bones, boneName);
  bone[timelineName] = keyframes;
}

function setSlotTimeline(
  animation: AnimationObject,
  slotName: string,
  timelineName: "attachment",
  keyframes: unknown[],
): void {
  const slots = ensureObjectProperty(animation, "slots");
  const slot = ensureObjectProperty(slots, slotName);
  slot[timelineName] = keyframes;
}

function getRole(
  analysis: ReturnType<typeof analyzeSpineJsonObject>,
  roles: InferredRoleName[],
): InferredRoleTarget | undefined {
  for (const role of roles) {
    const target = analysis.inferredRoles[role];
    if (target) {
      return target;
    }
  }

  return undefined;
}

async function assertWritableOutput(outputJsonPath: string, overwrite: boolean): Promise<void> {
  try {
    const info = await stat(outputJsonPath);
    if (!info.isFile()) {
      throw new Error(`outputJsonPath exists but is not a file: ${outputJsonPath}`);
    }
    if (!overwrite) {
      throw new Error(`outputJsonPath already exists and overwrite=false: ${outputJsonPath}`);
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(path.dirname(outputJsonPath), { recursive: true });
}

function assertAnimationWriteAllowed(
  animations: SpineJsonObject,
  animationName: string,
  overwrite: boolean,
): void {
  if (Object.prototype.hasOwnProperty.call(animations, animationName) && !overwrite) {
    throw new Error(
      `Animation "${animationName}" already exists in source JSON and overwrite=false.`,
    );
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cloneJsonObject(value: SpineJsonObject): SpineJsonObject {
  return JSON.parse(JSON.stringify(value)) as SpineJsonObject;
}

function ensureObjectProperty(parent: SpineJsonObject, propertyName: string): SpineJsonObject {
  if (!isObject(parent[propertyName])) {
    parent[propertyName] = {};
  }

  return parent[propertyName] as SpineJsonObject;
}

function isObject(value: unknown): value is SpineJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
