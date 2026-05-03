import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  InferredRoleName,
  InferredRoleTarget,
  SpineAnimationSummary,
  SpineAttachmentSummary,
  SpineBoneSummary,
  SpineJsonAnalysis,
  SpineJsonObject,
  SpineSkinSummary,
  SpineSlotSummary,
} from "./types.js";

type SlotAttachmentIndex = Record<string, SpineAttachmentSummary[]>;

export async function readSpineJsonFile(jsonPath: string): Promise<SpineJsonObject> {
  const resolvedPath = path.resolve(jsonPath);
  const parsed = JSON.parse(await readFile(resolvedPath, "utf8")) as unknown;

  if (!isObject(parsed)) {
    throw new Error(`Spine JSON root must be an object: ${resolvedPath}`);
  }

  return parsed;
}

export async function analyzeSpineJsonFile(jsonPath: string): Promise<SpineJsonAnalysis> {
  const resolvedPath = path.resolve(jsonPath);
  const spineJson = await readSpineJsonFile(resolvedPath);
  return analyzeSpineJsonObject(spineJson, resolvedPath);
}

export function analyzeSpineJsonObject(
  spineJson: SpineJsonObject,
  jsonPath?: string,
): SpineJsonAnalysis {
  const warnings: string[] = [];
  const skeleton = readSkeletonSummary(spineJson.skeleton);
  const bones = readBones(spineJson.bones, warnings);
  const slots = readSlots(spineJson.slots, warnings);
  const { skins, attachments } = readSkinsAndAttachments(spineJson.skins, warnings);
  const animations = readAnimations(spineJson.animations);
  const inferredRoles = inferCommonRoles({
    bones,
    slots,
    attachments,
    warnings,
  });

  return {
    jsonPath,
    skeleton,
    bones,
    slots,
    skins,
    attachments,
    animations,
    inferredRoles,
    warnings,
  };
}

function readSkeletonSummary(value: unknown): SpineJsonAnalysis["skeleton"] {
  if (!isObject(value)) {
    return {};
  }

  return {
    spine: readString(value.spine),
    hash: readString(value.hash),
    name: readString(value.name),
    images: readString(value.images),
    width: readNumber(value.width),
    height: readNumber(value.height),
  };
}

function readBones(value: unknown, warnings: string[]): SpineBoneSummary[] {
  if (!Array.isArray(value)) {
    warnings.push("JSON has no bones array.");
    return [];
  }

  return value.flatMap((entry): SpineBoneSummary[] => {
    if (!isObject(entry) || typeof entry.name !== "string") {
      return [];
    }

    return [
      {
        name: entry.name,
        parent: readString(entry.parent),
        x: readNumber(entry.x),
        y: readNumber(entry.y),
        rotation: readNumber(entry.rotation),
        scaleX: readNumber(entry.scaleX),
        scaleY: readNumber(entry.scaleY),
      },
    ];
  });
}

function readSlots(value: unknown, warnings: string[]): SpineSlotSummary[] {
  if (!Array.isArray(value)) {
    warnings.push("JSON has no slots array.");
    return [];
  }

  return value.flatMap((entry): SpineSlotSummary[] => {
    if (!isObject(entry) || typeof entry.name !== "string" || typeof entry.bone !== "string") {
      return [];
    }

    return [
      {
        name: entry.name,
        bone: entry.bone,
        attachment: readString(entry.attachment),
        color: readString(entry.color),
      },
    ];
  });
}

function readSkinsAndAttachments(
  skinsValue: unknown,
  warnings: string[],
): {
  skins: SpineSkinSummary[];
  attachments: SpineAttachmentSummary[];
} {
  const skins: SpineSkinSummary[] = [];
  const attachments: SpineAttachmentSummary[] = [];

  if (Array.isArray(skinsValue)) {
    for (const skin of skinsValue) {
      if (!isObject(skin)) {
        continue;
      }

      const skinName = readString(skin.name) ?? "default";
      const skinAttachments = readSkinAttachments(
        skinName,
        skin.attachments,
        warnings,
      );
      skins.push({
        name: skinName,
        slotCount: new Set(skinAttachments.map((attachment) => attachment.slotName)).size,
        attachmentCount: skinAttachments.length,
      });
      attachments.push(...skinAttachments);
    }

    return { skins, attachments };
  }

  if (isObject(skinsValue)) {
    for (const [skinName, slotMap] of Object.entries(skinsValue)) {
      const skinAttachments = readSkinAttachments(skinName, slotMap, warnings);
      skins.push({
        name: skinName,
        slotCount: new Set(skinAttachments.map((attachment) => attachment.slotName)).size,
        attachmentCount: skinAttachments.length,
      });
      attachments.push(...skinAttachments);
    }

    return { skins, attachments };
  }

  warnings.push("JSON has no skins object or skins array.");
  return { skins, attachments };
}

function readSkinAttachments(
  skinName: string,
  slotMap: unknown,
  _warnings: string[],
): SpineAttachmentSummary[] {
  if (!isObject(slotMap)) {
    return [];
  }

  const attachments: SpineAttachmentSummary[] = [];

  for (const [slotName, attachmentMap] of Object.entries(slotMap)) {
    if (!isObject(attachmentMap)) {
      continue;
    }

    for (const [attachmentName, attachmentValue] of Object.entries(attachmentMap)) {
      const attachmentObject = isObject(attachmentValue) ? attachmentValue : {};
      attachments.push({
        skinName,
        slotName,
        attachmentName,
        type: readString(attachmentObject.type) ?? "region",
        path: readString(attachmentObject.path),
        width: readNumber(attachmentObject.width),
        height: readNumber(attachmentObject.height),
      });
    }
  }

  return attachments;
}

function readAnimations(value: unknown): SpineAnimationSummary[] {
  if (!isObject(value)) {
    return [];
  }

  return Object.entries(value).map(([name, animationValue]) => {
    const animation = isObject(animationValue) ? animationValue : {};
    const boneTimelines = readTimelineMap(animation.bones);
    const slotTimelines = readTimelineMap(animation.slots);
    const timelineTypes = new Set<string>();

    for (const timelines of [...Object.values(boneTimelines), ...Object.values(slotTimelines)]) {
      timelines.forEach((timeline) => timelineTypes.add(timeline));
    }

    if (Array.isArray(animation.drawOrder) || Array.isArray(animation.draworder)) {
      timelineTypes.add("drawOrder");
    }
    if (Array.isArray(animation.events)) {
      timelineTypes.add("event");
    }

    return {
      name,
      duration: getMaxTimelineTime(animation),
      boneTimelines,
      slotTimelines,
      timelineTypes: [...timelineTypes].sort(),
    };
  });
}

function readTimelineMap(value: unknown): Record<string, string[]> {
  if (!isObject(value)) {
    return {};
  }

  const result: Record<string, string[]> = {};

  for (const [targetName, targetTimelines] of Object.entries(value)) {
    if (!isObject(targetTimelines)) {
      continue;
    }

    result[targetName] = Object.entries(targetTimelines)
      .filter(([, timeline]) => Array.isArray(timeline))
      .map(([timelineName]) => timelineName);
  }

  return result;
}

function inferCommonRoles(params: {
  bones: SpineBoneSummary[];
  slots: SpineSlotSummary[];
  attachments: SpineAttachmentSummary[];
  warnings: string[];
}): Partial<Record<InferredRoleName, InferredRoleTarget>> {
  const roles: Partial<Record<InferredRoleName, InferredRoleTarget>> = {};
  const slotAttachmentIndex = buildSlotAttachmentIndex(params.attachments);

  setRole(roles, inferBoneRole("root", params.bones, params.slots, slotAttachmentIndex, ["root"]));
  setRole(roles, inferBoneRole("body", params.bones, params.slots, slotAttachmentIndex, ["body", "torso", "chest", "spine", "hips", "base"]));
  setRole(roles, inferBoneRole("head", params.bones, params.slots, slotAttachmentIndex, ["head", "face", "neck"]));
  setRole(roles, inferBoneRole("tail", params.bones, params.slots, slotAttachmentIndex, ["tail"]));
  setRole(roles, inferBoneRole("paw_left", params.bones, params.slots, slotAttachmentIndex, ["left paw", "paw l", "l paw", "left hand", "hand l", "left arm", "arm l", "left foot", "foot l"]));
  setRole(roles, inferBoneRole("paw_right", params.bones, params.slots, slotAttachmentIndex, ["right paw", "paw r", "r paw", "right hand", "hand r", "right arm", "arm r", "right foot", "foot r"]));
  setRole(roles, inferBoneRole("paw", params.bones, params.slots, slotAttachmentIndex, ["paw", "hand", "foot", "arm", "leg"]));
  setRole(roles, inferBoneRole("logo", params.bones, params.slots, slotAttachmentIndex, ["logo", "mark", "icon"]));
  setRole(roles, inferEyeRole("eye_left", params.bones, params.slots, slotAttachmentIndex, "left"));
  setRole(roles, inferEyeRole("eye_right", params.bones, params.slots, slotAttachmentIndex, "right"));
  setRole(roles, inferEyeRole("eye", params.bones, params.slots, slotAttachmentIndex));

  if (!roles.root && params.bones[0]) {
    roles.root = {
      role: "root",
      boneName: params.bones[0].name,
      confidence: 0.4,
      source: "fallback",
    };
  }

  return roles;
}

function inferBoneRole(
  role: InferredRoleName,
  bones: SpineBoneSummary[],
  slots: SpineSlotSummary[],
  slotAttachmentIndex: SlotAttachmentIndex,
  keywords: string[],
): InferredRoleTarget | undefined {
  const bone = findByName(bones, keywords);
  if (bone) {
    return { role, boneName: bone.name, confidence: 0.9, source: "bone" };
  }

  const slot = findSlotByKeywords(slots, slotAttachmentIndex, keywords);
  if (!slot) {
    return undefined;
  }

  return {
    role,
    boneName: slot.bone,
    slotName: slot.name,
    attachmentName: slot.attachment ?? slotAttachmentIndex[slot.name]?.[0]?.attachmentName,
    confidence: 0.7,
    source: "slot",
  };
}

function inferEyeRole(
  role: InferredRoleName,
  bones: SpineBoneSummary[],
  slots: SpineSlotSummary[],
  slotAttachmentIndex: SlotAttachmentIndex,
  side?: "left" | "right",
): InferredRoleTarget | undefined {
  const keywords = ["eye", "pupil", "eyelid", "blink"];

  const bone = bones.find((candidate) =>
    matchesAll(candidate.name, ["eye"]) &&
    (!side || matchesSide(candidate.name, side)),
  );
  if (bone) {
    return { role, boneName: bone.name, confidence: 0.9, source: "bone" };
  }

  const slot = slots.find((candidate) => {
    const indexedAttachments = slotAttachmentIndex[candidate.name] ?? [];
    const haystack = [
      candidate.name,
      candidate.attachment ?? "",
      candidate.bone,
      ...indexedAttachments.map((attachment) => `${attachment.attachmentName} ${attachment.path ?? ""}`),
    ].join(" ");

    return matchesAny(haystack, keywords) &&
      (!side || matchesSide(haystack, side));
  });

  if (!slot) {
    return undefined;
  }

  return {
    role,
    boneName: slot.bone,
    slotName: slot.name,
    attachmentName: slot.attachment ?? slotAttachmentIndex[slot.name]?.[0]?.attachmentName,
    confidence: 0.75,
    source: "slot",
  };
}

function buildSlotAttachmentIndex(attachments: SpineAttachmentSummary[]): SlotAttachmentIndex {
  const index: SlotAttachmentIndex = {};

  for (const attachment of attachments) {
    index[attachment.slotName] ??= [];
    index[attachment.slotName].push(attachment);
  }

  return index;
}

function setRole(
  roles: Partial<Record<InferredRoleName, InferredRoleTarget>>,
  role: InferredRoleTarget | undefined,
): void {
  if (role && !roles[role.role]) {
    roles[role.role] = role;
  }
}

function findByName<T extends { name: string }>(items: T[], keywords: string[]): T | undefined {
  return items.find((item) => matchesAny(compactName(item.name), keywords));
}

function findSlotByKeywords(
  slots: SpineSlotSummary[],
  slotAttachmentIndex: SlotAttachmentIndex,
  keywords: string[],
): SpineSlotSummary | undefined {
  return slots.find((slot) => {
    const indexedAttachments = slotAttachmentIndex[slot.name] ?? [];
    const haystack = compactName([
      slot.name,
      slot.bone,
      slot.attachment ?? "",
      ...indexedAttachments.map((attachment) => `${attachment.attachmentName} ${attachment.path ?? ""}`),
    ].join(" "));
    return matchesAny(haystack, keywords);
  });
}

function matchesAny(value: string, keywords: string[]): boolean {
  const normalized = compactName(value);
  return keywords.some((keyword) => normalized.includes(compactName(keyword)));
}

function matchesAll(value: string, keywords: string[]): boolean {
  const normalized = compactName(value);
  return keywords.every((keyword) => normalized.includes(compactName(keyword)));
}

function matchesSide(value: string, side: "left" | "right"): boolean {
  const normalized = value.toLowerCase();
  if (side === "left") {
    return /\bleft\b/.test(compactName(normalized)) ||
      /(^|[_\-. ])l($|[_\-. ])/.test(normalized);
  }

  return /\bright\b/.test(compactName(normalized)) ||
    /(^|[_\-. ])r($|[_\-. ])/.test(normalized);
}

function compactName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getMaxTimelineTime(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((max, item) => Math.max(max, getMaxTimelineTime(item)), 0);
  }

  if (!isObject(value)) {
    return 0;
  }

  let max = typeof value.time === "number" ? value.time : 0;
  for (const child of Object.values(value)) {
    max = Math.max(max, getMaxTimelineTime(child));
  }
  return Number(max.toFixed(3));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function isObject(value: unknown): value is SpineJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
