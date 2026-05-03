import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export interface AssetValidationResult {
  assetsDir: string;
  requiredFiles: string[];
  missingFiles: string[];
  existingRequiredFiles: string[];
  allPngFiles: string[];
  isValid: boolean;
}

export const DEFAULT_REQUIRED_ASSET_FILES = [
  "body.png",
  "head.png",
  "tail.png",
  "eye_left.png",
  "eye_right.png",
] as const;

export async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await stat(inputPath);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(inputPath: string): Promise<boolean> {
  try {
    const info = await stat(inputPath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function validateAssetsDir(
  assetsDir: string,
  requiredFiles: string[] = [...DEFAULT_REQUIRED_ASSET_FILES],
): Promise<AssetValidationResult> {
  if (!(await isDirectory(assetsDir))) {
    return {
      assetsDir,
      requiredFiles,
      missingFiles: [...requiredFiles],
      existingRequiredFiles: [],
      allPngFiles: [],
      isValid: false,
    };
  }

  const entries = await readdir(assetsDir, { withFileTypes: true });
  const fileNames = new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );

  const existingRequiredFiles = requiredFiles.filter((fileName) =>
    fileNames.has(fileName),
  );
  const missingFiles = requiredFiles.filter((fileName) => !fileNames.has(fileName));
  const allPngFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => path.join(assetsDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  return {
    assetsDir,
    requiredFiles,
    missingFiles,
    existingRequiredFiles,
    allPngFiles,
    isValid: missingFiles.length === 0,
  };
}
