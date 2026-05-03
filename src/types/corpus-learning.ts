import type { BasicAnimationPresetName } from "./generated-spine.js";

export type CorpusAnimationType =
  | BasicAnimationPresetName
  | "walk"
  | "run"
  | "jump"
  | "attack"
  | "hit"
  | "die"
  | "wave"
  | "unknown";

export interface CorpusProjectFile {
  filePath: string;
  relativePath: string;
  fileName: string;
  extension: ".json" | ".spine";
  sizeBytes: number;
  mtimeMs: number;
}

export interface CorpusScanResult {
  corpusDir: string;
  totalFiles: number;
  spineFileCount: number;
  jsonFileCount: number;
  projects: CorpusProjectFile[];
  warnings: string[];
}

export interface CorpusLearnRequest {
  corpusDir: string;
  outputKnowledgeDir?: string;
  maxProjects?: number;
  overwrite?: boolean;
}

export interface FailedCorpusProject {
  projectPath: string;
  failedAt: "export_spine" | "read_json" | "parse_json" | "extract_features";
  error: string;
  command?: string;
  args?: string[];
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
}

export interface SpineProjectFeatures {
  projectPath: string;
  jsonPath: string;
  sourceType: ".json" | ".spine";
  spineVersion?: string;
  skeletonName?: string;
  bonesCount: number;
  slotsCount: number;
  skinsCount: number;
  animationsCount: number;
  attachmentsCount: number;
  hasMesh: boolean;
  hasConstraints: boolean;
  hasEvents: boolean;
  boneNames: string[];
  slotNames: string[];
  skinNames: string[];
  attachmentNames: string[];
  animationNames: string[];
  animations: ExtractedAnimationFeatures[];
}

export interface ExtractedAnimationFeatures {
  animationName: string;
  animationType: CorpusAnimationType;
  duration: number;
  bonesAffected: string[];
  slotsAffected: string[];
  timelinesUsed: string[];
  rotateRange: NumericRange;
  translateXRange: NumericRange;
  translateYRange: NumericRange;
  scaleRange: NumericRange;
  loopFriendly: boolean;
  keyframeCount: number;
}

export interface NumericRange {
  min: number | null;
  max: number | null;
}

export interface NumericStats {
  count: number;
  min: number;
  max: number;
  average: number;
  median: number;
  p25: number;
  p75: number;
}

export interface LearnedSpineStats {
  projectCount: number;
  failedProjectCount: number;
  commonSpineVersions: CountEntry[];
  averageBones: number;
  averageSlots: number;
  averageAnimations: number;
  commonBoneNames: CountEntry[];
  commonSlotNames: CountEntry[];
  commonAnimationNames: CountEntry[];
  durationStatsByAnimationType: Partial<Record<CorpusAnimationType, NumericStats>>;
  transformRangeStatsByAnimationType: Partial<
    Record<
      CorpusAnimationType,
      {
        rotateAbsMax?: NumericStats;
        translateXAbsMax?: NumericStats;
        translateYAbsMax?: NumericStats;
        scaleDeltaMax?: NumericStats;
        keyframeCount?: NumericStats;
      }
    >
  >;
  timelineUsageStats: CountEntry[];
  namingConventionStats: NamingConventionStats;
  failedProjects: FailedCorpusProject[];
}

export interface CountEntry {
  name: string;
  count: number;
}

export interface NamingConventionStats {
  leftRightPrefixes: CountEntry[];
  commonBodyPartNames: CountEntry[];
  leftRightConvention: string;
  attachmentNaming: string;
  imagePathNaming: string;
}

export interface LearnedAnimationPresets {
  idle: {
    duration: number;
    bodyTranslateY: number;
    headTranslateY: number;
  };
  breathing: {
    duration: number;
    minScale: number;
    maxScale: number;
  };
  blink: {
    interval: number;
    closedDuration: number;
  };
  tail_wag: {
    duration: number;
    minRotation: number;
    maxRotation: number;
  };
  head_bob: {
    duration: number;
    translateY: number;
  };
  float: {
    duration: number;
    translateY: number;
  };
  logo_bounce: {
    duration: number;
    translateY: number;
    minScale: number;
    maxScale: number;
  };
  paw_wave: {
    duration: number;
    minRotation: number;
    maxRotation: number;
  };
}

export interface LearnedNamingRules {
  preferredBoneNames: string[];
  preferredSlotNames: string[];
  leftRightConvention: string;
  attachmentNaming: string;
  imagePathNaming: string;
}

export interface ExampleIndexEntry {
  animationType: CorpusAnimationType;
  projectPath: string;
  animationName: string;
  duration: number;
  notes: string;
  score: number;
}

export interface CorpusLearningOutput {
  analyzedProjectCount: number;
  failedProjectCount: number;
  knowledgeFiles: string[];
  warnings: string[];
  failedProjects: FailedCorpusProject[];
}

export interface LoadedKnowledge {
  exists: boolean;
  knowledgeDir: string;
  guideMarkdown?: string;
  stats?: LearnedSpineStats;
  presets?: LearnedAnimationPresets;
  namingRules?: LearnedNamingRules;
  warnings: string[];
}

export interface AnimationRecommendation {
  recommendedAnimations: BasicAnimationPresetName[];
  recommendedDuration: number;
  recommendedPresetParams: Partial<Record<BasicAnimationPresetName, Record<string, number>>>;
  warnings: string[];
  reasoningSummary: string;
  requestPatch: {
    animations?: string[];
    duration?: number;
    presetParams?: Partial<Record<BasicAnimationPresetName, Record<string, number>>>;
  };
}
