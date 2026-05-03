import path from "node:path";
import {
  buildAnimationPresets,
  resolveAnimationPresets,
} from "./animation-presets.js";
import {
  copyUsedAssetsToImagesDir,
  createImagesDir,
  ensureOutputDir,
  getGeneratedProjectPaths,
  writeGenerationManifest,
  writeSkeletonJson,
} from "../services/generated-project-service.js";
import type { AssetAnalysisResult, RecommendedPart } from "../types/asset-analysis.js";
import type {
  BasicAnimationRequest,
  GeneratedSkeletonJsonResult,
} from "../types/generated-spine.js";

export interface SimpleSkeletonGenerationResult extends GeneratedSkeletonJsonResult {
  skeletonJson: Record<string, unknown>;
  manifestPath: string;
  selectedAnimations: string[];
}

type JsonObject = Record<string, unknown>;

const BONE_ROLE_ORDER = [
  "body",
  "head",
  "tail",
  "eye_left",
  "eye_right",
  "eye",
  "paw_left",
  "paw_right",
  "paw",
  "ear_left",
  "ear_right",
  "ear",
  "shadow",
  "background",
  "unknown",
];

export async function generateSimpleSkeletonJson(params: {
  assetAnalysis: AssetAnalysisResult;
  request: BasicAnimationRequest;
}): Promise<SimpleSkeletonGenerationResult> {
  const request = normalizeGenerationRequest(params.request);
  const outputDir = await ensureOutputDir(request.outputDir, request.overwrite ?? false);
  const paths = getGeneratedProjectPaths(outputDir, request.projectName);

  if (params.assetAnalysis.recommendedParts.length === 0) {
    throw new Error("No usable PNG assets were found for skeleton generation.");
  }

  const imagesDir = await createImagesDir(outputDir);
  await copyUsedAssetsToImagesDir(
    params.assetAnalysis.recommendedParts,
    imagesDir,
  );
  const usedAssets = params.assetAnalysis.recommendedParts.map(
    (part) => part.asset.filePath,
  );
  const animationResult = buildAnimationPresets({
    request,
    parts: params.assetAnalysis.recommendedParts,
  });
  const warnings = [...params.assetAnalysis.warnings, ...animationResult.warnings];
  const skeletonJson = buildSkeletonJson({
    assetAnalysis: params.assetAnalysis,
    request,
    animations: animationResult.animations,
  });
  const jsonPath = await writeSkeletonJson(outputDir, request.projectName, skeletonJson);
  const manifestPath = await writeGenerationManifest({
    outputDir,
    request,
    assetAnalysis: params.assetAnalysis,
    generatedJsonPath: jsonPath,
    projectPath: paths.projectPath,
    exportOutputDir: paths.exportOutputDir,
    warnings,
  });

  return {
    skeletonName: request.skeletonName ?? request.projectName,
    jsonPath,
    imagesDir,
    outputDir,
    projectPath: paths.projectPath,
    exportOutputDir: paths.exportOutputDir,
    usedAssets,
    warnings,
    skeletonJson,
    manifestPath,
    selectedAnimations: animationResult.selectedAnimations,
  };
}

export function normalizeGenerationRequest(
  request: BasicAnimationRequest,
): BasicAnimationRequest {
  return {
    ...request,
    characterType: request.characterType ?? "generic",
    canvasWidth: request.canvasWidth ?? 512,
    canvasHeight: request.canvasHeight ?? 512,
    fps: request.fps ?? 30,
    exportMode: request.exportMode,
    animations: resolveAnimationPresets(request),
  };
}

function buildSkeletonJson(params: {
  assetAnalysis: AssetAnalysisResult;
  request: BasicAnimationRequest;
  animations: Record<string, unknown>;
}): Record<string, unknown> {
  const canvasWidth = params.request.canvasWidth ?? 512;
  const canvasHeight = params.request.canvasHeight ?? 512;
  const parts = params.assetAnalysis.recommendedParts;
  const bones = buildBones(parts);
  const slots = buildSlots(parts);
  const skins = [buildDefaultSkin(parts)];

  return {
    skeleton: {
      spine: "4.2.00",
      hash: "",
      x: -canvasWidth / 2,
      y: -canvasHeight / 2,
      width: canvasWidth,
      height: canvasHeight,
    },
    bones,
    slots,
    skins,
    animations: params.animations,
  };
}

function buildBones(parts: RecommendedPart[]): JsonObject[] {
  const partIndex = new Map(parts.map((part) => [part.role, part]));
  const sortedParts = [...parts].sort(
    (a, b) => BONE_ROLE_ORDER.indexOf(a.role) - BONE_ROLE_ORDER.indexOf(b.role),
  );
  const bones: JsonObject[] = [{ name: "root" }];

  for (const part of sortedParts) {
    const bone: JsonObject = {
      name: part.boneName,
      parent: getParentBoneName(part, partIndex),
      x: round(part.x),
      y: round(part.y),
    };

    if (part.rotation !== 0) {
      bone.rotation = round(part.rotation);
    }

    if (part.scaleX !== 1) {
      bone.scaleX = part.scaleX;
    }

    if (part.scaleY !== 1) {
      bone.scaleY = part.scaleY;
    }

    bones.push(bone);
  }

  return bones;
}

function buildSlots(parts: RecommendedPart[]): JsonObject[] {
  return parts.map((part) => ({
    name: part.slotName,
    bone: part.boneName,
    attachment: part.attachmentName,
  }));
}

function buildDefaultSkin(parts: RecommendedPart[]): JsonObject {
  const attachments: JsonObject = {};

  for (const part of parts) {
    attachments[part.slotName] = {
      [part.attachmentName]: {
        type: "region",
        path: path.parse(part.asset.fileName).name,
        x: 0,
        y: 0,
        width: part.asset.width,
        height: part.asset.height,
      },
    };
  }

  return {
    name: "default",
    attachments,
  };
}

function getParentBoneName(
  part: RecommendedPart,
  partIndex: Map<string, RecommendedPart>,
): string {
  switch (part.role) {
    case "head":
      return partIndex.has("body") ? "body" : "root";
    case "tail":
    case "paw_left":
    case "paw_right":
    case "paw":
      return partIndex.has("body") ? "body" : "root";
    case "eye_left":
    case "eye_right":
    case "eye":
    case "ear_left":
    case "ear_right":
    case "ear":
      if (partIndex.has("head")) {
        return "head";
      }

      return partIndex.has("body") ? "body" : "root";
    case "background":
    case "shadow":
    case "body":
    case "unknown":
      return "root";
  }
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
