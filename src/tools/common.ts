import { stat } from "node:fs/promises";
import path from "node:path";
import type { SpineCommandResult } from "../services/spine-cli.js";

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const JAVA_NOISE_PATTERNS = [
  /^\s*Exception in thread\b/i,
  /^\s*at com\./,
  /^\s*at java\./,
  /^\s*at javax\./,
  /^\s*at sun\./,
  /^\s*Caused by:\s/i,
  /^\s*java\.lang\./,
  /^\s*com\.esotericsoftware\./,
  /^\s*\.\.\. \d+ more$/,
  /^\s*at org\./,
];

const MEANINGFUL_LINE_PATTERNS = [
  /\bERROR[:\s]/i,
  /\bError[:\s]/i,
  /\bExport settings JSON file does not exist\b/i,
  /\bUnable to read\b/i,
  /\bFile does not exist\b/i,
  /\bdoes not exist\b/i,
  /\bnot found\b/i,
  /\binvalid\b/i,
  /\bfailed\b/i,
  /\bmissing\b/i,
];

function isJavaNoiseLine(line: string): boolean {
  return JAVA_NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function isMeaningfulLine(line: string): boolean {
  return MEANINGFUL_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

export function sanitizeSpineOutput(raw: string): string {
  if (!raw) return "";
  const lines = raw.split("\n");
  const meaningful = lines.filter(
    (line) => !isJavaNoiseLine(line) && line.trim().length > 0,
  );
  return meaningful.join("\n").trim();
}

export function extractFriendlySpineError(result: SpineCommandResult): string {
  const allOutput = `${result.stdout}\n${result.stderr}`;
  const lines = allOutput.split("\n");

  const meaningfulLines = lines.filter(
    (line) => isMeaningfulLine(line) && !isJavaNoiseLine(line),
  );

  if (meaningfulLines.length > 0) {
    return meaningfulLines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 5)
      .join("; ");
  }

  const cleaned = sanitizeSpineOutput(allOutput);
  if (cleaned) {
    const cleanedLines = cleaned.split("\n");
    return cleanedLines.slice(0, 3).join("; ");
  }

  return `Spine CLI exited with code ${result.exitCode ?? "unknown"}. Set SPINE_MCP_DEBUG=1 for full output.`;
}

export function formatSpineResult(result: SpineCommandResult): string {
  const debug = process.env.SPINE_MCP_DEBUG === "1";
  if (debug) {
    return formatJson(result);
  }

  if (result.success) {
    return formatJson(result);
  }

  return formatJson({
    command: result.command,
    args: result.args,
    exitCode: result.exitCode,
    success: false,
    error: extractFriendlySpineError(result),
  });
}

export function formatToolError(error: unknown, failedAt?: string): string {
  const debug = process.env.SPINE_MCP_DEBUG === "1";

  if (error instanceof Error) {
    return formatJson({
      success: false,
      failedAt,
      error: error.message,
      ...(debug ? { stack: error.stack } : {}),
    });
  }

  return formatJson({
    success: false,
    failedAt,
    error: String(error),
  });
}

export function textContent(text: string) {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

export async function validateExportSettingsPath(
  exportSettingsPath: string | undefined,
  toolName: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (!exportSettingsPath) {
    return { valid: true };
  }

  const looksLikeModeString =
    !exportSettingsPath.includes(path.sep) &&
    !exportSettingsPath.includes("/") &&
    !exportSettingsPath.endsWith(".json");

  if (looksLikeModeString) {
    return {
      valid: false,
      error: `Spine CLI -e requires an export settings JSON file path. Received mode string: "${exportSettingsPath}". Please provide a real export settings JSON file, or omit exportMode/exportModeOrSettings to use Spine's default export.`,
    };
  }

  try {
    const info = await stat(exportSettingsPath);
    if (!info.isFile()) {
      return {
        valid: false,
        error: `Export settings path is not a file: ${exportSettingsPath}`,
      };
    }
    if (!exportSettingsPath.endsWith(".json")) {
      return {
        valid: false,
        error: `Export settings file must be a .json file: ${exportSettingsPath}`,
      };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: `Export settings JSON file does not exist: ${exportSettingsPath}`,
    };
  }
}
