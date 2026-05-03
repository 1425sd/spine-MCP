import type { AssetAnalysisResult } from "./asset-analysis.js";

export interface BasicAnimationRequest {
  assetsDir: string;
  outputDir: string;
  projectName: string;
  skeletonName?: string;
  animationDescription?: string;
  characterType?: "cat" | "mascot" | "logo" | "generic";
  canvasWidth?: number;
  canvasHeight?: number;
  fps?: number;
  duration?: number;
  animations?: BasicAnimationPresetName[];
  presetParams?: Partial<Record<BasicAnimationPresetName, Record<string, number>>>;
  exportMode?: string;
  openAfterBuild?: boolean;
  overwrite?: boolean;
}

export type BasicAnimationPresetName =
  | "idle"
  | "breathing"
  | "blink"
  | "tail_wag"
  | "head_bob"
  | "float"
  | "logo_bounce"
  | "paw_wave";

export interface GeneratedSkeletonJsonResult {
  skeletonName: string;
  jsonPath: string;
  imagesDir: string;
  outputDir: string;
  projectPath: string;
  exportOutputDir: string;
  usedAssets: string[];
  warnings: string[];
}

export interface GeneratedProjectManifest {
  request: BasicAnimationRequest;
  assetAnalysis: AssetAnalysisResult;
  generatedJsonPath: string;
  projectPath: string;
  exportOutputDir: string;
  warnings: string[];
  createdAt: string;
}
