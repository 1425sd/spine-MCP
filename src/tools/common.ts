import type { SpineCommandResult } from "../services/spine-cli.js";

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatSpineResult(result: SpineCommandResult): string {
  return formatJson(result);
}

export function formatToolError(error: unknown, failedAt?: string): string {
  if (error instanceof Error) {
    return formatJson({
      success: false,
      failedAt,
      error: error.message,
      stack: error.stack,
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
