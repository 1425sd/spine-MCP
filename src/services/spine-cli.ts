import { spawn } from "node:child_process";

export interface RunSpineOptions {
  cwd?: string;
  waitForExit?: boolean;
}

export interface SpineCommandResult {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  success: boolean;
}

export function getSpineExecutable(): string {
  return process.env.SPINE_EXE?.trim() || "Spine";
}

export async function runSpine(
  args: string[],
  options: RunSpineOptions = {},
): Promise<SpineCommandResult> {
  const command = getSpineExecutable();
  const waitForExit = options.waitForExit ?? true;

  return new Promise<SpineCommandResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: SpineCommandResult) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    const child = spawn(command, args, {
      cwd: options.cwd,
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

    child.on("error", (error) => {
      finish({
        command,
        args,
        stdout,
        stderr: stderr ? `${stderr}\n${error.message}` : error.message,
        exitCode: null,
        success: false,
      });
    });

    if (!waitForExit) {
      child.on("spawn", () => {
        finish({
          command,
          args,
          stdout: "",
          stderr: "",
          exitCode: null,
          success: true,
        });
      });

      return;
    }

    child.on("close", (exitCode) => {
      finish({
        command,
        args,
        stdout,
        stderr,
        exitCode,
        success: exitCode === 0,
      });
    });
  });
}
