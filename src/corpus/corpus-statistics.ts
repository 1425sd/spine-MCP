import type {
  CountEntry,
  CorpusAnimationType,
  ExampleIndexEntry,
  FailedCorpusProject,
  LearnedAnimationPresets,
  LearnedNamingRules,
  LearnedSpineStats,
  NamingConventionStats,
  NumericStats,
  SpineProjectFeatures,
} from "../types/corpus-learning.js";

type Counter = Map<string, number>;

interface MutableStats {
  projectCount: number;
  failedProjects: FailedCorpusProject[];
  versions: Counter;
  boneNames: Counter;
  slotNames: Counter;
  skinNames: Counter;
  attachmentNames: Counter;
  animationNames: Counter;
  timelineUsage: Counter;
  bodyPartNames: Counter;
  leftRightPrefixes: Counter;
  bonesCounts: number[];
  slotsCounts: number[];
  animationCounts: number[];
  durationByType: Map<CorpusAnimationType, number[]>;
  rotateAbsMaxByType: Map<CorpusAnimationType, number[]>;
  translateXAbsMaxByType: Map<CorpusAnimationType, number[]>;
  translateYAbsMaxByType: Map<CorpusAnimationType, number[]>;
  scaleDeltaMaxByType: Map<CorpusAnimationType, number[]>;
  keyframesByType: Map<CorpusAnimationType, number[]>;
  examples: ExampleIndexEntry[];
}

const BODY_PART_TOKENS = [
  "root",
  "body",
  "head",
  "tail",
  "arm",
  "leg",
  "eye",
  "mouth",
  "ear",
  "wing",
  "hand",
  "foot",
];

export function createCorpusStatisticsAccumulator(): MutableStats {
  return {
    projectCount: 0,
    failedProjects: [],
    versions: new Map(),
    boneNames: new Map(),
    slotNames: new Map(),
    skinNames: new Map(),
    attachmentNames: new Map(),
    animationNames: new Map(),
    timelineUsage: new Map(),
    bodyPartNames: new Map(),
    leftRightPrefixes: new Map(),
    bonesCounts: [],
    slotsCounts: [],
    animationCounts: [],
    durationByType: new Map(),
    rotateAbsMaxByType: new Map(),
    translateXAbsMaxByType: new Map(),
    translateYAbsMaxByType: new Map(),
    scaleDeltaMaxByType: new Map(),
    keyframesByType: new Map(),
    examples: [],
  };
}

export function addProjectFeatures(
  accumulator: MutableStats,
  features: SpineProjectFeatures,
): void {
  accumulator.projectCount += 1;

  increment(accumulator.versions, features.spineVersion ?? "unknown");
  addNames(accumulator.boneNames, features.boneNames);
  addNames(accumulator.slotNames, features.slotNames);
  addNames(accumulator.skinNames, features.skinNames);
  addNames(accumulator.attachmentNames, features.attachmentNames);
  addNames(accumulator.animationNames, features.animationNames);
  collectNamingSignals(accumulator, [
    ...features.boneNames,
    ...features.slotNames,
    ...features.attachmentNames,
  ]);

  accumulator.bonesCounts.push(features.bonesCount);
  accumulator.slotsCounts.push(features.slotsCount);
  accumulator.animationCounts.push(features.animationsCount);

  for (const animation of features.animations) {
    for (const timelineName of animation.timelinesUsed) {
      increment(accumulator.timelineUsage, timelineName);
    }

    pushByType(accumulator.durationByType, animation.animationType, animation.duration);
    pushByType(accumulator.keyframesByType, animation.animationType, animation.keyframeCount);
    pushRangeAbsMax(
      accumulator.rotateAbsMaxByType,
      animation.animationType,
      animation.rotateRange.min,
      animation.rotateRange.max,
    );
    pushRangeAbsMax(
      accumulator.translateXAbsMaxByType,
      animation.animationType,
      animation.translateXRange.min,
      animation.translateXRange.max,
    );
    pushRangeAbsMax(
      accumulator.translateYAbsMaxByType,
      animation.animationType,
      animation.translateYRange.min,
      animation.translateYRange.max,
    );
    pushScaleDelta(
      accumulator.scaleDeltaMaxByType,
      animation.animationType,
      animation.scaleRange.min,
      animation.scaleRange.max,
    );

    accumulator.examples.push({
      animationType: animation.animationType,
      projectPath: features.projectPath,
      animationName: animation.animationName,
      duration: round(animation.duration),
      notes: buildExampleNotes(animation),
      score: scoreAnimationExample(animation),
    });
  }
}

export function addFailedProject(
  accumulator: MutableStats,
  failedProject: FailedCorpusProject,
): void {
  accumulator.failedProjects.push(failedProject);
}

export function finalizeCorpusStatistics(accumulator: MutableStats): {
  stats: LearnedSpineStats;
  presets: LearnedAnimationPresets;
  namingRules: LearnedNamingRules;
  examples: ExampleIndexEntry[];
} {
  const namingConventionStats = buildNamingConventionStats(accumulator);
  const stats: LearnedSpineStats = {
    projectCount: accumulator.projectCount,
    failedProjectCount: accumulator.failedProjects.length,
    commonSpineVersions: topEntries(accumulator.versions, 10),
    averageBones: average(accumulator.bonesCounts),
    averageSlots: average(accumulator.slotsCounts),
    averageAnimations: average(accumulator.animationCounts),
    commonBoneNames: topEntries(accumulator.boneNames, 50),
    commonSlotNames: topEntries(accumulator.slotNames, 50),
    commonAnimationNames: topEntries(accumulator.animationNames, 50),
    durationStatsByAnimationType: buildStatsByType(accumulator.durationByType),
    transformRangeStatsByAnimationType: buildTransformStats(accumulator),
    timelineUsageStats: topEntries(accumulator.timelineUsage, 30),
    namingConventionStats,
    failedProjects: accumulator.failedProjects,
  };

  const presets = buildLearnedPresets(stats);
  const namingRules: LearnedNamingRules = {
    preferredBoneNames: topEntries(accumulator.boneNames, 30).map((entry) => entry.name),
    preferredSlotNames: topEntries(accumulator.slotNames, 30).map((entry) => entry.name),
    leftRightConvention: namingConventionStats.leftRightConvention,
    attachmentNaming: namingConventionStats.attachmentNaming,
    imagePathNaming: namingConventionStats.imagePathNaming,
  };
  const examples = [...accumulator.examples]
    .sort((a, b) => b.score - a.score)
    .slice(0, 200);

  return { stats, presets, namingRules, examples };
}

function buildLearnedPresets(stats: LearnedSpineStats): LearnedAnimationPresets {
  const idleDuration = durationMedian(stats, "idle", 1.2);
  const breathingDuration = durationMedian(stats, "breathing", 1.6);
  const blinkDuration = durationMedian(stats, "blink", 2);
  const tailDuration = durationMedian(stats, "tail_wag", 1);
  const headBobY = transformMedian(stats, "idle", "translateYAbsMax", 6);
  const tailRotate = transformMedian(stats, "tail_wag", "rotateAbsMax", 12);
  const floatY = transformMedian(stats, "float", "translateYAbsMax", 6);
  const bounceY = transformMedian(stats, "logo_bounce", "translateYAbsMax", 18);
  const scaleDelta = transformMedian(stats, "breathing", "scaleDeltaMax", 0.03);
  const logoScaleDelta = transformMedian(stats, "logo_bounce", "scaleDeltaMax", 0.05);

  return {
    idle: {
      duration: clamp(round(idleDuration), 0.6, 3),
      bodyTranslateY: clamp(round(headBobY * 0.7), 2, 10),
      headTranslateY: clamp(round(headBobY), 3, 14),
    },
    breathing: {
      duration: clamp(round(breathingDuration), 0.8, 4),
      minScale: 1,
      maxScale: clamp(round(1 + scaleDelta), 1.01, 1.08),
    },
    blink: {
      interval: clamp(round(blinkDuration), 1, 5),
      closedDuration: 0.12,
    },
    tail_wag: {
      duration: clamp(round(tailDuration), 0.4, 2),
      minRotation: -clamp(round(tailRotate), 5, 30),
      maxRotation: clamp(round(tailRotate), 5, 30),
    },
    head_bob: {
      duration: clamp(round(idleDuration), 0.6, 3),
      translateY: clamp(round(headBobY), 3, 14),
    },
    float: {
      duration: clamp(round(durationMedian(stats, "float", 2)), 1, 4),
      translateY: clamp(round(floatY), 4, 18),
    },
    logo_bounce: {
      duration: clamp(round(durationMedian(stats, "logo_bounce", 1.2)), 0.6, 3),
      translateY: clamp(round(bounceY), 8, 32),
      minScale: clamp(round(1 - logoScaleDelta), 0.9, 0.99),
      maxScale: clamp(round(1 + logoScaleDelta), 1.02, 1.15),
    },
    paw_wave: {
      duration: 1.2,
      minRotation: -15,
      maxRotation: 15,
    },
  };
}

function buildStatsByType(
  valuesByType: Map<CorpusAnimationType, number[]>,
): LearnedSpineStats["durationStatsByAnimationType"] {
  const result: LearnedSpineStats["durationStatsByAnimationType"] = {};

  for (const [type, values] of valuesByType.entries()) {
    const stats = numericStats(values.filter((value) => value > 0));
    if (stats) {
      result[type] = stats;
    }
  }

  return result;
}

function buildTransformStats(
  accumulator: MutableStats,
): LearnedSpineStats["transformRangeStatsByAnimationType"] {
  const result: LearnedSpineStats["transformRangeStatsByAnimationType"] = {};
  const allTypes = new Set<CorpusAnimationType>([
    ...accumulator.rotateAbsMaxByType.keys(),
    ...accumulator.translateXAbsMaxByType.keys(),
    ...accumulator.translateYAbsMaxByType.keys(),
    ...accumulator.scaleDeltaMaxByType.keys(),
    ...accumulator.keyframesByType.keys(),
  ]);

  for (const type of allTypes) {
    const entry: NonNullable<
      LearnedSpineStats["transformRangeStatsByAnimationType"][CorpusAnimationType]
    > = {};
    const rotateAbsMax = numericStats(accumulator.rotateAbsMaxByType.get(type) ?? []);
    const translateXAbsMax = numericStats(accumulator.translateXAbsMaxByType.get(type) ?? []);
    const translateYAbsMax = numericStats(accumulator.translateYAbsMaxByType.get(type) ?? []);
    const scaleDeltaMax = numericStats(accumulator.scaleDeltaMaxByType.get(type) ?? []);
    const keyframeCount = numericStats(accumulator.keyframesByType.get(type) ?? []);

    if (rotateAbsMax) entry.rotateAbsMax = rotateAbsMax;
    if (translateXAbsMax) entry.translateXAbsMax = translateXAbsMax;
    if (translateYAbsMax) entry.translateYAbsMax = translateYAbsMax;
    if (scaleDeltaMax) entry.scaleDeltaMax = scaleDeltaMax;
    if (keyframeCount) entry.keyframeCount = keyframeCount;

    result[type] = entry;
  }

  return result;
}

function buildNamingConventionStats(accumulator: MutableStats): NamingConventionStats {
  const leftRightPrefixes = topEntries(accumulator.leftRightPrefixes, 20);
  const commonBodyPartNames = topEntries(accumulator.bodyPartNames, 20);
  const leftRightConvention = leftRightPrefixes[0]?.name ?? "left/right";

  return {
    leftRightPrefixes,
    commonBodyPartNames,
    leftRightConvention,
    attachmentNaming: "Use short semantic attachment names without .png extension.",
    imagePathNaming: "Use image paths matching attachment names without file extensions.",
  };
}

function collectNamingSignals(accumulator: MutableStats, names: string[]): void {
  for (const name of names) {
    const normalized = name.toLowerCase();

    for (const token of BODY_PART_TOKENS) {
      if (normalized.includes(token)) {
        increment(accumulator.bodyPartNames, token);
      }
    }

    if (/^left[\s._-]/.test(normalized) || normalized.includes("left_")) {
      increment(accumulator.leftRightPrefixes, "left/right");
    }
    if (/^right[\s._-]/.test(normalized) || normalized.includes("right_")) {
      increment(accumulator.leftRightPrefixes, "left/right");
    }
    if (/(^|[\s._-])l($|[\s._-])/.test(normalized) || /[_-]l$/.test(normalized)) {
      increment(accumulator.leftRightPrefixes, "l/r");
    }
    if (/(^|[\s._-])r($|[\s._-])/.test(normalized) || /[_-]r$/.test(normalized)) {
      increment(accumulator.leftRightPrefixes, "l/r");
    }
    if (/_l($|[\s._-])/.test(normalized) || /_r($|[\s._-])/.test(normalized)) {
      increment(accumulator.leftRightPrefixes, "_l/_r");
    }
    if (/-l($|[\s._-])/.test(normalized) || /-r($|[\s._-])/.test(normalized)) {
      increment(accumulator.leftRightPrefixes, "-l/-r");
    }
  }
}

function buildExampleNotes(animation: {
  timelinesUsed: string[];
  loopFriendly: boolean;
  keyframeCount: number;
}): string {
  return [
    `timelines: ${animation.timelinesUsed.join(", ") || "none"}`,
    animation.loopFriendly ? "loop-friendly" : "not loop-friendly",
    `${animation.keyframeCount} keyframes`,
  ].join("; ");
}

function scoreAnimationExample(animation: {
  animationType: CorpusAnimationType;
  duration: number;
  timelinesUsed: string[];
  loopFriendly: boolean;
  keyframeCount: number;
}): number {
  let score = 0;
  if (animation.animationType !== "unknown") score += 30;
  if (animation.duration > 0) score += 15;
  if (animation.loopFriendly) score += 20;
  score += Math.min(animation.timelinesUsed.length * 5, 20);
  score += Math.min(animation.keyframeCount / 3, 15);
  return round(score);
}

function addNames(counter: Counter, names: string[]): void {
  for (const name of names) {
    increment(counter, name);
  }
}

function increment(counter: Counter, key: string, amount = 1): void {
  counter.set(key, (counter.get(key) ?? 0) + amount);
}

function pushByType(
  map: Map<CorpusAnimationType, number[]>,
  type: CorpusAnimationType,
  value: number,
): void {
  if (!Number.isFinite(value)) {
    return;
  }

  map.set(type, [...(map.get(type) ?? []), value]);
}

function pushRangeAbsMax(
  map: Map<CorpusAnimationType, number[]>,
  type: CorpusAnimationType,
  min: number | null,
  max: number | null,
): void {
  if (min === null || max === null) {
    return;
  }

  pushByType(map, type, Math.max(Math.abs(min), Math.abs(max)));
}

function pushScaleDelta(
  map: Map<CorpusAnimationType, number[]>,
  type: CorpusAnimationType,
  min: number | null,
  max: number | null,
): void {
  if (min === null || max === null) {
    return;
  }

  pushByType(map, type, Math.max(Math.abs(1 - min), Math.abs(max - 1)));
}

function topEntries(counter: Counter, limit: number): CountEntry[] {
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function numericStats(values: number[]): NumericStats | undefined {
  const cleanValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (cleanValues.length === 0) {
    return undefined;
  }

  return {
    count: cleanValues.length,
    min: round(cleanValues[0]),
    max: round(cleanValues[cleanValues.length - 1]),
    average: round(average(cleanValues)),
    median: round(percentile(cleanValues, 0.5)),
    p25: round(percentile(cleanValues, 0.25)),
    p75: round(percentile(cleanValues, 0.75)),
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(sortedValues: number[], percent: number): number {
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = (sortedValues.length - 1) * percent;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function durationMedian(
  stats: LearnedSpineStats,
  type: CorpusAnimationType,
  fallback: number,
): number {
  return stats.durationStatsByAnimationType[type]?.median ?? fallback;
}

function transformMedian(
  stats: LearnedSpineStats,
  type: CorpusAnimationType,
  key: "rotateAbsMax" | "translateXAbsMax" | "translateYAbsMax" | "scaleDeltaMax",
  fallback: number,
): number {
  return stats.transformRangeStatsByAnimationType[type]?.[key]?.median ?? fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
