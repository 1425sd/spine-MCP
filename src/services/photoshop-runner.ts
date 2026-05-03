import { spawn } from "node:child_process";
import path from "node:path";

export interface PhotoshopRunOptions {
  cwd?: string;
  timeoutMs?: number;
}

export interface PhotoshopRunResult {
  command: string;
  args: string[];
  exitCode: number | null;
  success: boolean;
  killed: boolean;
  stdout: string;
  stderr: string;
  cwd?: string;
  durationMs: number;
}

export function getPhotoshopExecutable(): string {
  const envPath = process.env.PHOTOSHOP_EXE_PATH?.trim();
  if (envPath) return envPath;
  return "photoshop";
}

export function getPhotoshopToSpineJsxPath(): string {
  const envPath = process.env.PHOTOSHOP_TO_SPINE_JSX?.trim();
  if (envPath) return envPath;
  return path.resolve(process.cwd(), "vendor", "PhotoshopToSpine.jsx");
}

export async function runPhotoshop(
  args: string[],
  options: PhotoshopRunOptions = {},
): Promise<PhotoshopRunResult> {
  const command = getPhotoshopExecutable();
  const { cwd = process.cwd(), timeoutMs = 300_000 } = options;

  const startTime = Date.now();

  return new Promise<PhotoshopRunResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let killed = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (result: PhotoshopRunResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", () => {
      finish({
        command,
        args,
        exitCode: null,
        success: false,
        killed,
        stdout,
        stderr,
        cwd,
        durationMs: Date.now() - startTime,
      });
    });

    child.on("close", (exitCode) => {
      finish({
        command,
        args,
        exitCode,
        success: exitCode === 0,
        killed,
        stdout,
        stderr,
        cwd,
        durationMs: Date.now() - startTime,
      });
    });

    timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeoutMs);
  });
}

export interface ExportPsdOptions {
  psdPath: string;
  outputDir: string;
  imagesDir?: string;
  jsonFileName?: string;
  scale?: number;
  padding?: number;
  trimWhitespace?: boolean;
  ignoreHiddenLayers?: boolean;
  ignoreBackground?: boolean;
  writeTemplate?: boolean;
  photoshopExePath?: string;
  photoshopToSpineJsxPath?: string;
  cwd?: string;
}

export async function exportPsdToSpine(
  options: ExportPsdOptions,
): Promise<PhotoshopRunResult> {
  const {
    psdPath,
    outputDir,
    imagesDir = "./images/",
    jsonFileName,
    scale = 1,
    padding = 1,
    trimWhitespace = true,
    ignoreHiddenLayers = false,
    ignoreBackground = true,
    writeTemplate = false,
    photoshopExePath,
    photoshopToSpineJsxPath,
    cwd,
  } = options;

  const jsxPath = photoshopToSpineJsxPath ?? getPhotoshopToSpineJsxPath();
  const resolvedCwd = cwd ?? outputDir;

  const scriptArgs: string[] = [
    jsxPath,
    psdPath,
    outputDir,
    imagesDir,
    jsonFileName ?? "",
    String(scale),
    String(padding),
    trimWhitespace ? "true" : "false",
    ignoreHiddenLayers ? "true" : "false",
    ignoreBackground ? "true" : "false",
    writeTemplate ? "true" : "false",
  ];

  const command = photoshopExePath ?? getPhotoshopExecutable();
  const args = ["-custom", ...scriptArgs];
  const startTime = Date.now();

  return new Promise<PhotoshopRunResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let killed = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (result: PhotoshopRunResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(command, args, {
      shell: false,
      cwd: resolvedCwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", () => {
      finish({
        command,
        args,
        exitCode: null,
        success: false,
        killed,
        stdout,
        stderr,
        cwd: resolvedCwd,
        durationMs: Date.now() - startTime,
      });
    });

    child.on("close", (exitCode) => {
      finish({
        command,
        args,
        exitCode,
        success: exitCode === 0,
        killed,
        stdout,
        stderr,
        cwd: resolvedCwd,
        durationMs: Date.now() - startTime,
      });
    });

    timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, 600_000);
  });
}
