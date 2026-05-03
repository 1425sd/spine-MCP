export interface AnalyzedAsset {
  fileName: string;
  filePath: string;
  baseName: string;
  width: number;
  height: number;
  inferredRole: AssetRole;
  confidence: number;
}

export type AssetRole =
  | "body"
  | "head"
  | "tail"
  | "eye_left"
  | "eye_right"
  | "eye"
  | "paw_left"
  | "paw_right"
  | "paw"
  | "ear_left"
  | "ear_right"
  | "ear"
  | "shadow"
  | "background"
  | "unknown";

export interface AssetAnalysisResult {
  assetsDir: string;
  allAssets: AnalyzedAsset[];
  byRole: Partial<Record<AssetRole, AnalyzedAsset[]>>;
  recommendedParts: RecommendedPart[];
  warnings: string[];
}

export interface RecommendedPart {
  role: AssetRole;
  asset: AnalyzedAsset;
  boneName: string;
  slotName: string;
  attachmentName: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}
