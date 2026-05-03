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
  exportSettingsPath?: string;
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
