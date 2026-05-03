import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import { createRecommendedParts } from "../generators/layout-presets.js";
import type {
  AnalyzedAsset,
  AssetAnalysisResult,
  AssetRole,
} from "../types/asset-analysis.js";

interface RoleMatch {
  role: AssetRole;
  confidence: number;
}

const ROLE_PATTERNS: Array<{
  role: AssetRole;
  patterns: string[];
  confidence: number;
}> = [
  { role: "eye_left", patterns: ["eye_left", "left_eye", "eye-l", "eye_l", "left-eye", "lefteye", "左眼"], confidence: 0.98 },
  { role: "eye_right", patterns: ["eye_right", "right_eye", "eye-r", "eye_r", "right-eye", "righteye", "右眼"], confidence: 0.98 },
  { role: "paw_left", patterns: ["paw_left", "left_paw", "paw-l", "paw_l", "left-paw", "leftpaw", "左爪"], confidence: 0.96 },
  { role: "paw_right", patterns: ["paw_right", "right_paw", "paw-r", "paw_r", "right-paw", "rightpaw", "右爪"], confidence: 0.96 },
  { role: "ear_left", patterns: ["ear_left", "left_ear", "ear-l", "ear_l", "left-ear", "leftear", "左耳"], confidence: 0.96 },
  { role: "ear_right", patterns: ["ear_right", "right_ear", "ear-r", "ear_r", "right-ear", "rightear", "右耳"], confidence: 0.96 },
  { role: "body", patterns: ["body", "torso", "身体"], confidence: 0.92 },
  { role: "head", patterns: ["head", "face", "头"], confidence: 0.92 },
  { role: "tail", patterns: ["tail", "尾巴"], confidence: 0.92 },
  { role: "eye", patterns: ["eye", "眼"], confidence: 0.78 },
  { role: "paw", patterns: ["paw", "foot", "爪", "脚"], confidence: 0.78 },
  { role: "ear", patterns: ["ear", "耳"], confidence: 0.78 },
  { role: "shadow", patterns: ["shadow", "阴影"], confidence: 0.85 },
  { role: "background", patterns: ["background", "bg", "背景"], confidence: 0.85 },
];

export async function analyzeAssets(assetsDir: string): Promise<AssetAnalysisResult> {
  const resolvedAssetsDir = path.resolve(assetsDir);
  const warnings: string[] = [];

  if (!(await isDirectory(resolvedAssetsDir))) {
    throw new Error(`assetsDir does not exist or is not a directory: ${resolvedAssetsDir}`);
  }

  const entries = await readdir(resolvedAssetsDir, { withFileTypes: true });
  const pngEntries = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (pngEntries.length === 0) {
    warnings.push(`No PNG files found in assetsDir: ${resolvedAssetsDir}`);
  }

  const allAssets: AnalyzedAsset[] = [];

  for (const entry of pngEntries) {
    const filePath = path.join(resolvedAssetsDir, entry.name);
    const baseName = path.parse(entry.name).name;

    try {
      const dimensions = imageSize(await readFile(filePath));
      const match = inferAssetRole(baseName);

      allAssets.push({
        fileName: entry.name,
        filePath,
        baseName,
        width: dimensions.width,
        height: dimensions.height,
        inferredRole: match.role,
        confidence: match.confidence,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Could not read PNG dimensions for ${entry.name}: ${message}`);
    }
  }

  const byRole = groupByRole(allAssets);

  if (!byRole.body?.length && allAssets.length > 0) {
    const fallbackBody = chooseFallbackBody(allAssets);
    fallbackBody.inferredRole = "body";
    fallbackBody.confidence = Math.max(fallbackBody.confidence, 0.35);
    warnings.push(
      `No explicit body PNG was found. Using largest suitable PNG as body: ${fallbackBody.fileName}`,
    );
  }

  const finalByRole = groupByRole(allAssets);
  const recommendedParts = createRecommendedParts(finalByRole);

  addRoleWarnings(finalByRole, warnings);

  return {
    assetsDir: resolvedAssetsDir,
    allAssets,
    byRole: finalByRole,
    recommendedParts,
    warnings,
  };
}

function inferAssetRole(baseName: string): RoleMatch {
  const normalized = normalizeName(baseName);
  const compact = compactName(baseName);

  for (const rule of ROLE_PATTERNS) {
    for (const pattern of rule.patterns) {
      const normalizedPattern = normalizeName(pattern);
      const compactPattern = compactName(pattern);

      if (normalized === normalizedPattern || compact === compactPattern) {
        return { role: rule.role, confidence: rule.confidence };
      }

      if (
        normalized.includes(normalizedPattern) ||
        compact.includes(compactPattern)
      ) {
        return { role: rule.role, confidence: Math.max(rule.confidence - 0.1, 0.55) };
      }
    }
  }

  return { role: "unknown", confidence: 0 };
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function compactName(value: string): string {
  return normalizeName(value).replace(/[\s._-]+/g, "");
}

function groupByRole(
  assets: AnalyzedAsset[],
): Partial<Record<AssetRole, AnalyzedAsset[]>> {
  const byRole: Partial<Record<AssetRole, AnalyzedAsset[]>> = {};

  for (const asset of assets) {
    byRole[asset.inferredRole] ??= [];
    byRole[asset.inferredRole]?.push(asset);
  }

  for (const role of Object.keys(byRole) as AssetRole[]) {
    byRole[role]?.sort((a, b) => {
      const confidenceDiff = b.confidence - a.confidence;
      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      const areaDiff = b.width * b.height - a.width * a.height;
      if (areaDiff !== 0) {
        return areaDiff;
      }

      return a.fileName.localeCompare(b.fileName);
    });
  }

  return byRole;
}

function chooseFallbackBody(assets: AnalyzedAsset[]): AnalyzedAsset {
  const nonBackgroundAssets = assets.filter(
    (asset) => asset.inferredRole !== "background" && asset.inferredRole !== "shadow",
  );
  const candidates = nonBackgroundAssets.length > 0 ? nonBackgroundAssets : assets;

  return [...candidates].sort(
    (a, b) => b.width * b.height - a.width * a.height,
  )[0];
}

function addRoleWarnings(
  byRole: Partial<Record<AssetRole, AnalyzedAsset[]>>,
  warnings: string[],
): void {
  for (const role of Object.keys(byRole) as AssetRole[]) {
    const assets = byRole[role] ?? [];
    if (role !== "unknown" && assets.length > 1) {
      warnings.push(
        `Multiple PNGs matched role "${role}". Using ${assets[0].fileName} first; other candidates are ${assets
          .slice(1)
          .map((asset) => asset.fileName)
          .join(", ")}.`,
      );
    }
  }

  if (byRole.unknown?.length) {
    warnings.push(
      `Some PNGs could not be assigned a semantic role: ${byRole.unknown
        .map((asset) => asset.fileName)
        .join(", ")}.`,
    );
  }
}

async function isDirectory(inputPath: string): Promise<boolean> {
  try {
    const info = await stat(inputPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}
