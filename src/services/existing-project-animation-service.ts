import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  createExportOutputDir,
  ensureOutputDir,
} from "./generated-project-service.js";
import { runSpine, type SpineCommandResult } from "./spine-cli.js";
import type { AnimationRecommendation } from "../types/corpus-learning.js";
import type { BasicAnimationPresetName } from "../types/generated-spine.js";

type JsonObject = Record<string, unknown>;
type SlotInfo = {
  slotName: string;
  boneName?: string;
  attachmentName?: string;
};

export interface ExistingProjectAnimationRequest {
  sourceJsonPath?: string;
  spineProjectPath?: string;
  imagesDir?: string;
  outputDir: string;
  projectName: string;
  userGoal: string;
  exportMode?: "json" | "json+pack" | "binary" | "binary+pack";
  openAfterBuild?: boolean;
  overwrite?: boolean;
  knowledgeDir?: string;
}

export interface ExistingProjectPreparationResult {
  sourceKind: "json" | "spine";
  sourceJsonPath: string;
  warnings: string[];
}

export interface ExistingProjectRoleMap {
  rootBone: string;
  bodyBone?: string;
  headBone?: string;
  tailBone?: string;
  pawBone?: string;
  eyeSlots: Array<{ slotName: string; attachmentName?: string }>;
  availableAssetRoles: string[];
  warnings: string[];
}

export interface ExistingProjectAnimationBuildResult {
  sourceKind: "json" | "spine";
  sourceJsonPath: string;
  generatedJsonPath: string;
  projectPath: string;
  exportOutputDir: string;
  copiedImagesDir?: string;
  roleMap: ExistingProjectRoleMap;
  generatedAnimationNames: string[];
  warnings: string[];
  importResult: SpineCommandResult;
  exportResult?: SpineCommandResult;
  openResult?: SpineCommandResult;
}

export async function prepareExistingProjectJson(params: {
  request: ExistingProjectAnimationRequest;
  outputDir: string;
}): Promise<ExistingProjectPreparationResult> {
  const warnings: string[] = [];

  if (params.request.sourceJsonPath) {
    if (params.request.spineProjectPath) {
      warnings.push(
        "Both sourceJsonPath and spineProjectPath were provided. sourceJsonPath takes precedence.",
      );
    }

    const sourceJsonPath = path.resolve(params.request.sourceJsonPath);
    await assertFileExists(sourceJsonPath, "sourceJsonPath");
    return {
      sourceKind: "json",
      sourceJsonPath,
      warnings,
    };
  }

  if (!params.request.spineProjectPath) {
    throw new Error("Either sourceJsonPath or spineProjectPath must be provided.");
  }

  const spineProjectPath = path.resolve(params.request.spineProjectPath);
  await assertFileExists(spineProjectPath, "spineProjectPath");

  const exportDir = path.join(params.outputDir, "_source-export");
  await mkdir(exportDir, { recursive: true });

  const exportResult = await runSpine([
    "-i",
    spineProjectPath,
    "-o",
    exportDir,
    "-e",
    "json",
  ]);

  if (!exportResult.success) {
    throw Object.assign(
      new Error("Failed to export source .spine project to JSON."),
      { spineResult: exportResult },
    );
  }

  const sourceJsonPath = await findBestJsonFile(exportDir);
  if (!sourceJsonPath) {
    throw new Error(`Spine export succeeded, but no JSON was found in ${exportDir}.`);
  }

  return {
    sourceKind: "spine",
    sourceJsonPath,
    warnings,
  };
}

export function addBasicAnimationsToExistingSpineJson(params: {
  skeletonJson: unknown;
  recommendation: AnimationRecommendation;
  userGoal: string;
}): {
  skeletonJson: JsonObject;
  roleMap: ExistingProjectRoleMap;
  generatedAnimationNames: string[];
  warnings: string[];
} {
  if (!isObject(params.skeletonJson)) {
    throw new Error("Source Spine JSON root must be an object.");
  }

  const skeletonJson = cloneJsonObject(params.skeletonJson);
  const roleMap = inferExistingProjectRoles(skeletonJson);
  const warnings = [...roleMap.warnings];
  const animations = ensureObjectProperty(skeletonJson, "animations");
  const generatedAnimationNames: string[] = [];

  for (const presetName of params.recommendation.recommendedAnimations) {
    const animation = buildExistingProjectPreset({
      presetName,
      roleMap,
      presetParams: params.recommendation.recommendedPresetParams[presetName],
      warnings,
    });

    if (!animation) {
      continue;
    }

    const animationName = getAvailableAnimationName(animations, presetName);
    animations[animationName] = animation;
    generatedAnimationNames.push(animationName);
  }

  if (generatedAnimationNames.length === 0) {
    const fallbackAnimation = buildExistingProjectPreset({
      presetName: "idle",
      roleMap,
      presetParams: params.recommendation.recommendedPresetParams.idle,
      warnings,
    });

    if (fallbackAnimation) {
      const animationName = getAvailableAnimationName(animations, "idle");
      animations[animationName] = fallbackAnimation;
      generatedAnimationNames.push(animationName);
    }
  }

  return {
    skeletonJson,
    roleMap,
    generatedAnimationNames,
    warnings,
  };
}

export async function writeModifiedExistingProject(params: {
  outputDir: string;
  projectName: string;
  skeletonJson: JsonObject;
  imagesDir?: string;
}): Promise<{
  generatedJsonPath: string;
  copiedImagesDir?: string;
}> {
  assertSafeProjectName(params.projectName);

  if (params.imagesDir) {
    const skeleton = ensureObjectProperty(params.skeletonJson, "skeleton");
    skeleton.images = "./images/";
  }

  const generatedJsonPath = path.join(params.outputDir, `${params.projectName}.json`);
  await writeFile(
    generatedJsonPath,
    `${JSON.stringify(params.skeletonJson, null, 2)}\n`,
    "utf8",
  );

  if (!params.imagesDir) {
    return { generatedJsonPath };
  }

  const copiedImagesDir = path.join(params.outputDir, "images");
  await copyDirectoryRecursive(path.resolve(params.imagesDir), copiedImagesDir);
  return { generatedJsonPath, copiedImagesDir };
}

export async function buildExistingProjectAnimation(params: {
  request: ExistingProjectAnimationRequest;
  recommendation: AnimationRecommendation;
}): Promise<ExistingProjectAnimationBuildResult> {
  const outputDir = await ensureOutputDir(
    params.request.outputDir,
    params.request.overwrite ?? false,
  );
  const prepared = await prepareExistingProjectJson({
    request: params.request,
    outputDir,
  });

  return buildPreparedExistingProjectAnimation({
    request: params.request,
    outputDir,
    prepared,
    recommendation: params.recommendation,
  });
}

export async function buildPreparedExistingProjectAnimation(params: {
  request: ExistingProjectAnimationRequest;
  outputDir: string;
  prepared: ExistingProjectPreparationResult;
  recommendation: AnimationRecommendation;
}): Promise<ExistingProjectAnimationBuildResult> {
  const parsed = JSON.parse(await readFile(params.prepared.sourceJsonPath, "utf8")) as unknown;
  const animationResult = addBasicAnimationsToExistingSpineJson({
    skeletonJson: parsed,
    recommendation: params.recommendation,
    userGoal: params.request.userGoal,
  });
  const warnings = [...params.prepared.warnings, ...animationResult.warnings];

  if (!params.request.imagesDir) {
    warnings.push(
      "No imagesDir was provided. Spine import will rely on image paths already present in the source JSON.",
    );
  }

  const written = await writeModifiedExistingProject({
    outputDir: params.outputDir,
    projectName: params.request.projectName,
    skeletonJson: animationResult.skeletonJson,
    imagesDir: params.request.imagesDir,
  });
  const projectPath = path.join(params.outputDir, `${params.request.projectName}.spine`);
  const importResult = await runSpine([
    "-i",
    written.generatedJsonPath,
    "-o",
    projectPath,
    "-r",
    params.request.projectName,
  ]);

  if (!importResult.success) {
    return {
      sourceKind: params.prepared.sourceKind,
      sourceJsonPath: params.prepared.sourceJsonPath,
      generatedJsonPath: written.generatedJsonPath,
      projectPath,
      exportOutputDir: path.join(params.outputDir, "dist"),
      copiedImagesDir: written.copiedImagesDir,
      roleMap: animationResult.roleMap,
      generatedAnimationNames: animationResult.generatedAnimationNames,
      warnings,
      importResult,
    };
  }

  const exportOutputDir = await createExportOutputDir(params.outputDir);
  const exportResult = await runSpine([
    "-i",
    projectPath,
    "-o",
    exportOutputDir,
    "-e",
    params.request.exportMode ?? "json+pack",
  ]);
  const openResult =
    exportResult.success && params.request.openAfterBuild !== false
      ? await runSpine([projectPath], { waitForExit: false })
      : undefined;

  return {
    sourceKind: params.prepared.sourceKind,
    sourceJsonPath: params.prepared.sourceJsonPath,
    generatedJsonPath: written.generatedJsonPath,
    projectPath,
    exportOutputDir,
    copiedImagesDir: written.copiedImagesDir,
    roleMap: animationResult.roleMap,
    generatedAnimationNames: animationResult.generatedAnimationNames,
    warnings,
    importResult,
    exportResult,
    openResult,
  };
}

export function inferExistingProjectRoles(skeletonJson: JsonObject): ExistingProjectRoleMap {
  const bones = asObjectArray(skeletonJson.bones);
  const slots = asObjectArray(skeletonJson.slots);
  const warnings: string[] = [];
  const boneNames = bones
    .map((bone) => (typeof bone.name === "string" ? bone.name : undefined))
    .filter((name): name is string => Boolean(name));
  const slotInfos: SlotInfo[] = slots.flatMap((slot) => {
    if (typeof slot.name !== "string") {
      return [];
    }

    return [
      {
        slotName: slot.name,
        boneName: typeof slot.bone === "string" ? slot.bone : undefined,
        attachmentName:
          typeof slot.attachment === "string" ? slot.attachment : undefined,
      },
    ];
  });

  const rootBone =
    findName(boneNames, ["root", "main", "center"]) ?? boneNames[0] ?? "root";
  const bodyBone =
    findName(boneNames, ["body", "torso", "chest", "spine", "hips", "base"]) ??
    findSlotBoneByKeywords(slotInfos, ["body", "torso", "chest", "spine", "hips"]);
  const headBone =
    findName(boneNames, ["head", "face", "neck"]) ??
    findSlotBoneByKeywords(slotInfos, ["head", "face"]);
  const tailBone =
    findName(boneNames, ["tail"]) ??
    findSlotBoneByKeywords(slotInfos, ["tail"]);
  const pawBone =
    findName(boneNames, ["paw", "hand", "foot", "arm", "leg"]) ??
    findSlotBoneByKeywords(slotInfos, ["paw", "hand", "foot", "arm", "leg"]);
  const eyeSlots = slotInfos.filter((slot) =>
    matchesName(`${slot.slotName} ${slot.attachmentName ?? ""}`, [
      "eye",
      "eyes",
      "pupil",
      "blink",
      "eyelid",
    ]),
  );
  const availableAssetRoles = new Set<string>();

  if (bodyBone) availableAssetRoles.add("body");
  if (headBone) availableAssetRoles.add("head");
  if (tailBone) availableAssetRoles.add("tail");
  if (pawBone) availableAssetRoles.add("paw");
  if (eyeSlots.length > 0) availableAssetRoles.add("eye");

  if (!bodyBone) {
    warnings.push("Could not infer a body bone from the existing skeleton.");
  }
  if (!headBone) {
    warnings.push("Could not infer a head bone from the existing skeleton.");
  }
  if (!tailBone) {
    warnings.push("Could not infer a tail bone from the existing skeleton.");
  }
  if (eyeSlots.length === 0) {
    warnings.push("Could not infer eye slots from the existing skeleton.");
  }

  return {
    rootBone,
    bodyBone,
    headBone,
    tailBone,
    pawBone,
    eyeSlots,
    availableAssetRoles: [...availableAssetRoles],
    warnings,
  };
}

function buildExistingProjectPreset(params: {
  presetName: BasicAnimationPresetName;
  roleMap: ExistingProjectRoleMap;
  presetParams?: Record<string, number>;
  warnings: string[];
}): unknown | undefined {
  const duration = getDuration(params.presetName, params.presetParams);

  switch (params.presetName) {
    case "idle":
      return buildIdle(params.roleMap, duration, params.presetParams);
    case "breathing":
      return buildBreathing(params.roleMap, duration, params.presetParams);
    case "blink":
      return buildBlink(params.roleMap, duration, params.presetParams, params.warnings);
    case "tail_wag":
      return buildTailWag(params.roleMap, duration, params.presetParams, params.warnings);
    case "head_bob":
      return buildHeadBob(params.roleMap, duration, params.presetParams, params.warnings);
    case "float":
      return buildFloat(params.roleMap, duration, params.presetParams);
    case "logo_bounce":
      return buildLogoBounce(params.roleMap, duration, params.presetParams);
    case "paw_wave":
      return buildPawWave(params.roleMap, duration, params.presetParams, params.warnings);
  }
}

function buildIdle(
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const bodyBone = roleMap.bodyBone ?? roleMap.rootBone;
  const bones: JsonObject = {
    [bodyBone]: {
      translate: threeKeyY(duration, presetParams?.bodyTranslateY ?? 4),
    },
  };

  if (roleMap.headBone) {
    bones[roleMap.headBone] = {
      translate: threeKeyY(duration, presetParams?.headTranslateY ?? 6),
    };
  }

  return { bones };
}

function buildBreathing(
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const bodyBone = roleMap.bodyBone ?? roleMap.rootBone;
  const minScale = presetParams?.minScale ?? 1;
  const maxScale = presetParams?.maxScale ?? 1.03;
  const bones: JsonObject = {
    [bodyBone]: {
      scale: [
        { time: 0, x: minScale, y: minScale },
        { time: duration / 2, x: maxScale, y: maxScale },
        { time: duration, x: minScale, y: minScale },
      ],
    },
  };

  if (roleMap.headBone) {
    bones[roleMap.headBone] = {
      translate: threeKeyY(duration, 3),
    };
  }

  return { bones };
}

function buildBlink(
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  if (roleMap.eyeSlots.length === 0) {
    warnings.push("blink was requested, but no eye slots were inferred.");
    return undefined;
  }

  const closedDuration = presetParams?.closedDuration ?? 0.12;
  const closeTime = Math.max(0.05, duration * 0.5);
  const openTime = Math.min(duration, closeTime + closedDuration);
  const slots: JsonObject = {};

  for (const eyeSlot of roleMap.eyeSlots) {
    if (!eyeSlot.attachmentName) {
      warnings.push(
        `blink skipped slot "${eyeSlot.slotName}" because it has no default attachment.`,
      );
      continue;
    }

    slots[eyeSlot.slotName] = {
      attachment: [
        { time: 0, name: eyeSlot.attachmentName },
        { time: closeTime, name: null },
        { time: openTime, name: eyeSlot.attachmentName },
        { time: duration, name: eyeSlot.attachmentName },
      ],
    };
  }

  return Object.keys(slots).length > 0 ? { slots } : undefined;
}

function buildTailWag(
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  if (!roleMap.tailBone) {
    warnings.push("tail_wag was requested, but no tail bone was inferred.");
    return undefined;
  }

  const minRotation = presetParams?.minRotation ?? -12;
  const maxRotation = presetParams?.maxRotation ?? 12;
  return {
    bones: {
      [roleMap.tailBone]: {
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
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  if (!roleMap.headBone) {
    warnings.push("head_bob was requested, but no head bone was inferred.");
    return undefined;
  }

  return {
    bones: {
      [roleMap.headBone]: {
        translate: threeKeyY(duration, presetParams?.translateY ?? 8),
      },
    },
  };
}

function buildFloat(
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const translateY = presetParams?.translateY ?? 6;
  return {
    bones: {
      [roleMap.rootBone]: {
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
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
): unknown {
  const translateY = presetParams?.translateY ?? 18;
  const minScale = presetParams?.minScale ?? 0.98;
  const maxScale = presetParams?.maxScale ?? 1.05;

  return {
    bones: {
      [roleMap.rootBone]: {
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
  roleMap: ExistingProjectRoleMap,
  duration: number,
  presetParams: Record<string, number> | undefined,
  warnings: string[],
): unknown | undefined {
  if (!roleMap.pawBone) {
    warnings.push("paw_wave was requested, but no paw/hand/arm bone was inferred.");
    return undefined;
  }

  const minRotation = presetParams?.minRotation ?? -15;
  const maxRotation = presetParams?.maxRotation ?? 15;
  return {
    bones: {
      [roleMap.pawBone]: {
        rotate: [
          { time: 0, value: 0 },
          { time: duration * 0.25, value: minRotation },
          { time: duration * 0.5, value: maxRotation },
          { time: duration * 0.75, value: minRotation },
          { time: duration, value: 0 },
        ],
      },
    },
  };
}

function threeKeyY(duration: number, y: number): Array<{ time: number; y: number }> {
  return [
    { time: 0, y: 0 },
    { time: duration / 2, y },
    { time: duration, y: 0 },
  ];
}

function getDuration(
  presetName: BasicAnimationPresetName,
  presetParams: Record<string, number> | undefined,
): number {
  if (typeof presetParams?.duration === "number") {
    return presetParams.duration;
  }

  if (presetName === "blink" && typeof presetParams?.interval === "number") {
    return presetParams.interval;
  }

  const defaults: Record<BasicAnimationPresetName, number> = {
    idle: 1.2,
    breathing: 1.6,
    blink: 2,
    tail_wag: 1,
    head_bob: 1.2,
    float: 2,
    logo_bounce: 1.2,
    paw_wave: 1.2,
  };

  return defaults[presetName];
}

function getAvailableAnimationName(animations: JsonObject, baseName: string): string {
  if (!Object.prototype.hasOwnProperty.call(animations, baseName)) {
    return baseName;
  }

  const aiName = `ai_${baseName}`;
  if (!Object.prototype.hasOwnProperty.call(animations, aiName)) {
    return aiName;
  }

  let index = 2;
  while (Object.prototype.hasOwnProperty.call(animations, `${aiName}_${index}`)) {
    index += 1;
  }

  return `${aiName}_${index}`;
}

async function findBestJsonFile(dir: string): Promise<string | undefined> {
  const jsonFiles = await findJsonFiles(dir);
  const candidates: Array<{ filePath: string; mtimeMs: number; size: number }> = [];

  for (const filePath of jsonFiles) {
    const info = await stat(filePath);
    candidates.push({ filePath, mtimeMs: info.mtimeMs, size: info.size });
  }

  candidates.sort((a, b) => b.size - a.size || b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath;
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findJsonFiles(entryPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      results.push(entryPath);
    }
  }

  return results;
}

async function copyDirectoryRecursive(sourceDir: string, destinationDir: string): Promise<void> {
  const info = await stat(sourceDir);
  if (!info.isDirectory()) {
    throw new Error(`imagesDir is not a directory: ${sourceDir}`);
  }

  await mkdir(destinationDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function assertFileExists(filePath: string, fieldName: string): Promise<void> {
  const info = await stat(filePath);
  if (!info.isFile()) {
    throw new Error(`${fieldName} is not a file: ${filePath}`);
  }
}

function assertSafeProjectName(projectName: string): void {
  if (!projectName.trim()) {
    throw new Error("projectName cannot be empty.");
  }

  if (
    projectName.includes("/") ||
    projectName.includes("\\") ||
    projectName.includes(":") ||
    projectName === "." ||
    projectName === ".."
  ) {
    throw new Error(`projectName must be a file name, not a path: ${projectName}`);
  }
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function ensureObjectProperty(parent: JsonObject, propertyName: string): JsonObject {
  if (!isObject(parent[propertyName])) {
    parent[propertyName] = {};
  }

  return parent[propertyName] as JsonObject;
}

function asObjectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function findName(names: string[], keywords: string[]): string | undefined {
  return names.find((name) => matchesName(name, keywords));
}

function findSlotBoneByKeywords(
  slots: SlotInfo[],
  keywords: string[],
): string | undefined {
  return slots.find((slot) =>
    slot.boneName
      ? matchesName(`${slot.slotName} ${slot.attachmentName ?? ""} ${slot.boneName}`, keywords)
      : false,
  )?.boneName;
}

function matchesName(name: string, keywords: string[]): boolean {
  const normalized = name.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
