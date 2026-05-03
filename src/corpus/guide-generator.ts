import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ExampleIndexEntry,
  LearnedAnimationPresets,
  LearnedNamingRules,
  LearnedSpineStats,
} from "../types/corpus-learning.js";

export const KNOWLEDGE_FILE_NAMES = {
  guide: "learned-spine-guide.md",
  stats: "learned-spine-stats.json",
  presets: "learned-animation-presets.json",
  namingRules: "learned-naming-rules.json",
  examples: "examples-index.json",
} as const;

export async function writeKnowledgeFiles(params: {
  outputKnowledgeDir: string;
  overwrite?: boolean;
  stats: LearnedSpineStats;
  presets: LearnedAnimationPresets;
  namingRules: LearnedNamingRules;
  examples: ExampleIndexEntry[];
}): Promise<string[]> {
  const outputKnowledgeDir = path.resolve(params.outputKnowledgeDir);
  await mkdir(outputKnowledgeDir, { recursive: true });

  const filePaths = {
    guide: path.join(outputKnowledgeDir, KNOWLEDGE_FILE_NAMES.guide),
    stats: path.join(outputKnowledgeDir, KNOWLEDGE_FILE_NAMES.stats),
    presets: path.join(outputKnowledgeDir, KNOWLEDGE_FILE_NAMES.presets),
    namingRules: path.join(outputKnowledgeDir, KNOWLEDGE_FILE_NAMES.namingRules),
    examples: path.join(outputKnowledgeDir, KNOWLEDGE_FILE_NAMES.examples),
  };

  if (!params.overwrite) {
    for (const filePath of Object.values(filePaths)) {
      if (await pathExists(filePath)) {
        throw new Error(`Knowledge file already exists and overwrite=false: ${filePath}`);
      }
    }
  }

  const guide = generateLearnedSpineGuide({
    stats: params.stats,
    presets: params.presets,
    namingRules: params.namingRules,
  });

  await writeFile(filePaths.guide, guide, "utf8");
  await writeJson(filePaths.stats, params.stats);
  await writeJson(filePaths.presets, params.presets);
  await writeJson(filePaths.namingRules, params.namingRules);
  await writeJson(filePaths.examples, params.examples);

  return Object.values(filePaths);
}

export function generateLearnedSpineGuide(params: {
  stats: LearnedSpineStats;
  presets: LearnedAnimationPresets;
  namingRules: LearnedNamingRules;
}): string {
  const { stats, presets, namingRules } = params;

  return `# Learned Spine Generation Guide

## Corpus Summary
- analyzed project count: ${stats.projectCount}
- failed project count: ${stats.failedProjectCount}
- common Spine versions: ${formatCountEntries(stats.commonSpineVersions)}
- average bones: ${stats.averageBones}
- average slots: ${stats.averageSlots}
- average animations: ${stats.averageAnimations}

## Naming Rules
- recommended bone names: ${namingRules.preferredBoneNames.slice(0, 20).join(", ") || "root, body, head"}
- recommended slot names: ${namingRules.preferredSlotNames.slice(0, 20).join(", ") || "body, head"}
- left/right naming conventions: ${namingRules.leftRightConvention}
- attachment path recommendations: ${namingRules.attachmentNaming} ${namingRules.imagePathNaming}

## Common Animation Presets

### idle
- recommended duration: ${presets.idle.duration}s
- common affected bones: body, head, root
- common transform ranges: body translate Y ${presets.idle.bodyTranslateY}, head translate Y ${presets.idle.headTranslateY}

### breathing
- recommended duration: ${presets.breathing.duration}s
- scale range: ${presets.breathing.minScale} to ${presets.breathing.maxScale}

### blink
- recommended interval: ${presets.blink.interval}s
- closed duration: ${presets.blink.closedDuration}s
- preferred implementation: slot attachment switch. Slot visibility/color is acceptable when attachment switching is unavailable.

### tail_wag
- recommended rotation range: ${presets.tail_wag.minRotation} to ${presets.tail_wag.maxRotation} degrees
- recommended duration: ${presets.tail_wag.duration}s

### head_bob
- recommended y translation: ${presets.head_bob.translateY}
- recommended duration: ${presets.head_bob.duration}s

### float
- recommended y translation: ${presets.float.translateY}
- recommended duration: ${presets.float.duration}s

### logo_bounce
- recommended scale/translate pattern: translate Y ${presets.logo_bounce.translateY}, scale ${presets.logo_bounce.minScale} to ${presets.logo_bounce.maxScale}
- recommended duration: ${presets.logo_bounce.duration}s

## Parameter Generation Rules
- If the user requests a small cat idle loading animation, prefer idle + breathing + blink + tail_wag.
- If the source assets contain only one image, prefer logo_bounce + float.
- If no tail asset is available, do not generate tail_wag; return a warning instead.
- If no eye asset is available, do not generate blink; return a warning instead.
- Prefer the most common human-readable names from the corpus for bones, slots, and attachments.
- Keep animation amplitude restrained. Avoid exaggerated transforms unless the user explicitly requests them.
- Use corpus recommended duration ranges before falling back to defaults.

## Limitations
- basic generator only supports region attachments
- no mesh
- no IK
- no weights
- no complex constraints
`;
}

function formatCountEntries(entries: Array<{ name: string; count: number }>): string {
  return entries.slice(0, 5).map((entry) => `${entry.name} (${entry.count})`).join(", ") || "unknown";
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await stat(inputPath);
    return true;
  } catch {
    return false;
  }
}
