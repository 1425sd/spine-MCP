export type SpineJsonObject = Record<string, unknown>;

export type InferredRoleName =
  | "root"
  | "body"
  | "head"
  | "tail"
  | "eye_left"
  | "eye_right"
  | "eye"
  | "paw_left"
  | "paw_right"
  | "paw"
  | "logo";

export interface SpineBoneSummary {
  name: string;
  parent?: string;
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface SpineSlotSummary {
  name: string;
  bone: string;
  attachment?: string;
  color?: string;
}

export interface SpineSkinSummary {
  name: string;
  slotCount: number;
  attachmentCount: number;
}

export interface SpineAttachmentSummary {
  skinName: string;
  slotName: string;
  attachmentName: string;
  type: string;
  path?: string;
  width?: number;
  height?: number;
}

export interface SpineAnimationSummary {
  name: string;
  duration: number;
  boneTimelines: Record<string, string[]>;
  slotTimelines: Record<string, string[]>;
  timelineTypes: string[];
}

export interface InferredRoleTarget {
  role: InferredRoleName;
  boneName?: string;
  slotName?: string;
  attachmentName?: string;
  confidence: number;
  source: "bone" | "slot" | "attachment" | "fallback";
}

export interface SpineJsonAnalysis {
  jsonPath?: string;
  skeleton: {
    spine?: string;
    hash?: string;
    name?: string;
    images?: string;
    width?: number;
    height?: number;
  };
  bones: SpineBoneSummary[];
  slots: SpineSlotSummary[];
  skins: SpineSkinSummary[];
  attachments: SpineAttachmentSummary[];
  animations: SpineAnimationSummary[];
  inferredRoles: Partial<Record<InferredRoleName, InferredRoleTarget>>;
  warnings: string[];
}

export type JsonAnimationKind =
  | "breathing"
  | "head_float"
  | "tail_swing"
  | "blink"
  | "paw_wave"
  | "logo_bounce"
  | "floating";

export interface GenerateAnimationJsonRequest {
  sourceJsonPath: string;
  outputJsonPath: string;
  userGoal: string;
  animationName?: string;
  duration?: number;
  loop?: boolean;
  characterType?: string;
  overwrite?: boolean;
  imagesPath?: string;
  selectedKinds?: JsonAnimationKind[];
  intensity?: "soft" | "normal" | "strong";
}

export interface JsonAnimationModification {
  kind: JsonAnimationKind | "custom";
  target: string;
  timeline: "rotate" | "translate" | "scale" | "attachment";
  keyframeCount: number;
  note?: string;
}

export interface GenerateAnimationJsonResult {
  sourceJsonPath: string;
  outputJsonPath: string;
  manifestPath: string;
  animationName: string;
  duration: number;
  loop: boolean;
  selectedKinds: JsonAnimationKind[];
  analysis: SpineJsonAnalysis;
  modifications: JsonAnimationModification[];
  warnings: string[];
}

export type SimpleBoneAnimationType = "rotate" | "translate" | "scale";

export interface SimpleBoneKeyframe {
  time: number;
  angle?: number;
  value?: number;
  x?: number;
  y?: number;
}

export interface AddSimpleAnimationRequest {
  sourceJsonPath: string;
  outputJsonPath: string;
  animationName: string;
  targetBone: string;
  animationType: SimpleBoneAnimationType;
  keyframes: SimpleBoneKeyframe[];
  overwrite?: boolean;
}

export interface JsonAnimationManifest {
  tool: string;
  request: unknown;
  sourceJsonPath: string;
  outputJsonPath: string;
  animationName: string;
  modifications: JsonAnimationModification[];
  warnings: string[];
  createdAt: string;
}
