export interface SpineJsonValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

type JsonObject = Record<string, unknown>;

export function validateGeneratedSpineJson(value: unknown): SpineJsonValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(value)) {
    return {
      isValid: false,
      errors: ["Spine JSON root must be an object."],
      warnings,
    };
  }

  const root = value;
  const bones = root.bones;
  const slots = root.slots;
  const skins = root.skins;
  const animations = root.animations;

  if (!isObject(root.skeleton)) {
    errors.push("Missing required skeleton object.");
  }

  if (!Array.isArray(bones)) {
    errors.push("Missing required bones array.");
  }

  if (!Array.isArray(slots)) {
    errors.push("Missing required slots array.");
  }

  if (!Array.isArray(skins)) {
    errors.push("Missing required skins array.");
  }

  if (!isObject(animations)) {
    errors.push("Missing required animations object.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  const boneNames = new Set<string>();
  for (const bone of bones as unknown[]) {
    if (!isObject(bone) || typeof bone.name !== "string") {
      errors.push("Every bone must be an object with a string name.");
      continue;
    }

    boneNames.add(bone.name);
  }

  const slotNames = new Set<string>();
  const slotAttachmentPairs: Array<{ slotName: string; attachmentName: string }> = [];

  for (const slot of slots as unknown[]) {
    if (!isObject(slot) || typeof slot.name !== "string") {
      errors.push("Every slot must be an object with a string name.");
      continue;
    }

    slotNames.add(slot.name);

    if (typeof slot.bone !== "string") {
      errors.push(`Slot "${slot.name}" must reference a bone.`);
    } else if (!boneNames.has(slot.bone)) {
      errors.push(`Slot "${slot.name}" references missing bone "${slot.bone}".`);
    }

    if (typeof slot.attachment === "string") {
      slotAttachmentPairs.push({
        slotName: slot.name,
        attachmentName: slot.attachment,
      });
    } else {
      warnings.push(`Slot "${slot.name}" has no default attachment.`);
    }
  }

  for (const pair of slotAttachmentPairs) {
    if (!skinHasAttachment(skins as unknown[], pair.slotName, pair.attachmentName)) {
      errors.push(
        `Slot "${pair.slotName}" default attachment "${pair.attachmentName}" was not found in skins.`,
      );
    }
  }

  validateAnimationReferences(
    animations as JsonObject,
    boneNames,
    slotNames,
    skins as unknown[],
    errors,
    warnings,
  );

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateAnimationReferences(
  animations: JsonObject,
  boneNames: Set<string>,
  slotNames: Set<string>,
  skins: unknown[],
  errors: string[],
  warnings: string[],
): void {
  for (const [animationName, animationValue] of Object.entries(animations)) {
    if (!isObject(animationValue)) {
      warnings.push(`Animation "${animationName}" is not an object.`);
      continue;
    }

    if (isObject(animationValue.bones)) {
      for (const boneName of Object.keys(animationValue.bones)) {
        if (!boneNames.has(boneName)) {
          errors.push(
            `Animation "${animationName}" references missing bone "${boneName}".`,
          );
        }
      }
    }

    if (isObject(animationValue.slots)) {
      for (const [slotName, slotTimeline] of Object.entries(animationValue.slots)) {
        if (!slotNames.has(slotName)) {
          warnings.push(
            `Animation "${animationName}" references missing slot "${slotName}".`,
          );
          continue;
        }

        if (!isObject(slotTimeline) || !Array.isArray(slotTimeline.attachment)) {
          continue;
        }

        for (const key of slotTimeline.attachment) {
          if (!isObject(key) || typeof key.name !== "string") {
            continue;
          }

          if (!skinHasAttachment(skins, slotName, key.name)) {
            warnings.push(
              `Animation "${animationName}" switches slot "${slotName}" to attachment "${key.name}", which was not found in skins.`,
            );
          }
        }
      }
    }
  }
}

function skinHasAttachment(
  skins: unknown[],
  slotName: string,
  attachmentName: string,
): boolean {
  return skins.some((skin) => {
    if (!isObject(skin) || !isObject(skin.attachments)) {
      return false;
    }

    const slotAttachments = skin.attachments[slotName];
    return isObject(slotAttachments) && isObject(slotAttachments[attachmentName]);
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
