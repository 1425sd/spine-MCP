import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetAnalysisResult, RecommendedPart } from "../types/asset-analysis.js";
import type {
  BasicAnimationRequest,
  GeneratedProjectManifest,
} from "../types/generated-spine.js";

export async function ensureOutputDir(
  outputDir: string,
  overwrite = false,
): Promise<string> {
  const resolvedOutputDir = path.resolve(outputDir);

  if (await pathExists(resolvedOutputDir)) {
    if (!overwrite) {
      throw new Error(
        `outputDir already exists and overwrite=false: ${resolvedOutputDir}`,
      );
    }

    const info = await stat(resolvedOutputDir);
    if (!info.isDirectory()) {
      throw new Error(`outputDir exists but is not a directory: ${resolvedOutputDir}`);
    }
  } else {
    await mkdir(resolvedOutputDir, { recursive: true });
  }

  return resolvedOutputDir;
}

export async function createImagesDir(outputDir: string): Promise<string> {
  const imagesDir = path.join(path.resolve(outputDir), "images");
  await mkdir(imagesDir, { recursive: true });
  return imagesDir;
}

export async function createExportOutputDir(outputDir: string): Promise<string> {
  const exportOutputDir = path.join(path.resolve(outputDir), "dist");
  await mkdir(exportOutputDir, { recursive: true });
  return exportOutputDir;
}

export async function copyUsedAssetsToImagesDir(
  parts: RecommendedPart[],
  imagesDir: string,
): Promise<string[]> {
  const copied: string[] = [];

  for (const part of parts) {
    const destination = path.join(imagesDir, part.asset.fileName);
    await copyFile(part.asset.filePath, destination);
    copied.push(destination);
  }

  return copied;
}

export async function writeSkeletonJson(
  outputDir: string,
  projectName: string,
  skeletonJson: unknown,
): Promise<string> {
  assertSafeProjectName(projectName);
  const jsonPath = path.join(path.resolve(outputDir), `${projectName}.json`);
  await writeFile(jsonPath, `${JSON.stringify(skeletonJson, null, 2)}\n`, "utf8");
  return jsonPath;
}

export async function writeGenerationManifest(params: {
  outputDir: string;
  request: BasicAnimationRequest;
  assetAnalysis: AssetAnalysisResult;
  generatedJsonPath: string;
  projectPath: string;
  exportOutputDir: string;
  warnings: string[];
}): Promise<string> {
  const manifest: GeneratedProjectManifest = {
    request: params.request,
    assetAnalysis: params.assetAnalysis,
    generatedJsonPath: params.generatedJsonPath,
    projectPath: params.projectPath,
    exportOutputDir: params.exportOutputDir,
    warnings: params.warnings,
    createdAt: new Date().toISOString(),
  };
  const manifestPath = path.join(
    path.resolve(params.outputDir),
    "generation.manifest.json",
  );

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifestPath;
}

export function getGeneratedProjectPaths(
  outputDir: string,
  projectName: string,
): {
  outputDir: string;
  jsonPath: string;
  projectPath: string;
  exportOutputDir: string;
  imagesDir: string;
} {
  assertSafeProjectName(projectName);
  const resolvedOutputDir = path.resolve(outputDir);

  return {
    outputDir: resolvedOutputDir,
    jsonPath: path.join(resolvedOutputDir, `${projectName}.json`),
    projectPath: path.join(resolvedOutputDir, `${projectName}.spine`),
    exportOutputDir: path.join(resolvedOutputDir, "dist"),
    imagesDir: path.join(resolvedOutputDir, "images"),
  };
}

function assertSafeProjectName(projectName: string): void {
  if (!projectName.trim()) {
    throw new Error("projectName cannot be empty.");
  }

  if (
    projectName.includes("/") ||
    projectName.includes("\\") ||
    projectName.includes(":") ||
    projectName === "." ||
    projectName === ".."
  ) {
    throw new Error(
      `projectName must be a file name, not a path: ${projectName}`,
    );
  }
}

async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await stat(inputPath);
    return true;
  } catch {
    return false;
  }
}
