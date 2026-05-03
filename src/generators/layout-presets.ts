import type {
  AnalyzedAsset,
  AssetRole,
  RecommendedPart,
} from "../types/asset-analysis.js";

type AssetsByRole = Partial<Record<AssetRole, AnalyzedAsset[]>>;

const LAYOUT_ROLE_ORDER: AssetRole[] = [
  "background",
  "shadow",
  "tail",
  "body",
  "paw_left",
  "paw_right",
  "paw",
  "ear_left",
  "ear_right",
  "ear",
  "head",
  "eye_left",
  "eye_right",
  "eye",
];

export const DEFAULT_CANVAS_WIDTH = 512;
export const DEFAULT_CANVAS_HEIGHT = 512;

export function createRecommendedParts(byRole: AssetsByRole): RecommendedPart[] {
  const body = chooseBestAsset(byRole.body);
  const head = chooseBestAsset(byRole.head);
  const parts: RecommendedPart[] = [];

  for (const role of LAYOUT_ROLE_ORDER) {
    const asset = chooseBestAsset(byRole[role]);

    if (!asset) {
      continue;
    }

    parts.push(createRecommendedPart(role, asset, body, head));
  }

  return parts;
}

export function chooseBestAsset(
  assets: AnalyzedAsset[] | undefined,
): AnalyzedAsset | undefined {
  if (!assets?.length) {
    return undefined;
  }

  return [...assets].sort((a, b) => {
    const confidenceDiff = b.confidence - a.confidence;
    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    const areaDiff = b.width * b.height - a.width * a.height;
    if (areaDiff !== 0) {
      return areaDiff;
    }

    return a.fileName.localeCompare(b.fileName);
  })[0];
}

function createRecommendedPart(
  role: AssetRole,
  asset: AnalyzedAsset,
  body: AnalyzedAsset | undefined,
  head: AnalyzedAsset | undefined,
): RecommendedPart {
  const bodyWidth = body?.width ?? asset.width;
  const bodyHeight = body?.height ?? asset.height;
  const headWidth = head?.width ?? Math.max(1, bodyWidth * 0.6);
  const headHeight = head?.height ?? Math.max(1, bodyHeight * 0.5);
  const transform = getDefaultTransform(role, bodyWidth, bodyHeight, headWidth, headHeight);

  return {
    role,
    asset,
    boneName: role,
    slotName: role,
    attachmentName: asset.baseName,
    x: transform.x,
    y: transform.y,
    rotation: transform.rotation,
    scaleX: 1,
    scaleY: 1,
  };
}

function getDefaultTransform(
  role: AssetRole,
  bodyWidth: number,
  bodyHeight: number,
  headWidth: number,
  headHeight: number,
): { x: number; y: number; rotation: number } {
  switch (role) {
    case "body":
      return { x: 0, y: 0, rotation: 0 };
    case "head":
      return { x: 0, y: bodyHeight * 0.35, rotation: 0 };
    case "tail":
      return { x: bodyWidth * 0.35, y: 0, rotation: -15 };
    case "eye_left":
      return { x: -headWidth * 0.15, y: headHeight * 0.1, rotation: 0 };
    case "eye_right":
      return { x: headWidth * 0.15, y: headHeight * 0.1, rotation: 0 };
    case "eye":
      return { x: 0, y: headHeight * 0.1, rotation: 0 };
    case "paw_left":
      return { x: -bodyWidth * 0.2, y: -bodyHeight * 0.25, rotation: 0 };
    case "paw_right":
      return { x: bodyWidth * 0.2, y: -bodyHeight * 0.25, rotation: 0 };
    case "paw":
      return { x: 0, y: -bodyHeight * 0.25, rotation: 0 };
    case "ear_left":
      return { x: -headWidth * 0.2, y: headHeight * 0.45, rotation: -8 };
    case "ear_right":
      return { x: headWidth * 0.2, y: headHeight * 0.45, rotation: 8 };
    case "ear":
      return { x: 0, y: headHeight * 0.45, rotation: 0 };
    case "shadow":
      return { x: 0, y: -bodyHeight * 0.45, rotation: 0 };
    case "background":
      return { x: 0, y: 0, rotation: 0 };
    case "unknown":
      return { x: 0, y: 0, rotation: 0 };
  }
}
