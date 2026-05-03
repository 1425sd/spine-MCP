import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

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

export async function createExportOutputDir(outputDir: string): Promise<string> {
  const exportOutputDir = path.join(path.resolve(outputDir), "dist");
  await mkdir(exportOutputDir, { recursive: true });
  return exportOutputDir;
}

async function pathExists(inputPath: string): Promise<boolean> {
  try {
    await stat(inputPath);
    return true;
  } catch {
    return false;
  }
}
