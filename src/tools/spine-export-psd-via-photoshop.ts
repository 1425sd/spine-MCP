import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import {
  exportPsdToSpine,
  getPhotoshopToSpineJsxPath,
} from "../services/photoshop-runner.js";
import { formatToolError, textContent } from "./common.js";

const schema = {
  psdPath: z
    .string()
    .min(1)
    .describe("Path to the source PSD file to export."),
  outputDir: z
    .string()
    .min(1)
    .describe("Directory where the Spine JSON and images/ folder will be written."),
  imagesDir: z
    .string()
    .optional()
    .describe("Relative path for the images folder inside outputDir. Defaults to './images/'."),
  jsonFileName: z
    .string()
    .optional()
    .describe("Output JSON file name. If omitted, defaults to the PSD file name."),
  scale: z
    .number()
    .positive()
    .optional()
    .default(1)
    .describe("Scale factor for PNG output. Defaults to 1."),
  padding: z
    .number()
    .int()
    .min(0)
    .max(4)
    .optional()
    .default(1)
    .describe("Pixel padding around each exported image. Defaults to 1."),
  trimWhitespace: z
    .boolean()
    .optional()
    .default(true)
    .describe("Trim blank pixels from around each exported image. Defaults to true."),
  ignoreHiddenLayers: z
    .boolean()
    .optional()
    .default(false)
    .describe("Skip hidden layers during export. Defaults to false."),
  ignoreBackground: z
    .boolean()
    .optional()
    .default(true)
    .describe("Skip the background layer during export. Defaults to true."),
  writeTemplate: z
    .boolean()
    .optional()
    .default(false)
    .describe("Also write a full canvas PNG with all visible layers. Defaults to false."),
  photoshopExePath: z
    .string()
    .optional()
    .describe(
      "Path to the Photoshop executable. Defaults to the PHOTOSHOP_EXE_PATH environment variable, or 'photoshop' on PATH.",
    ),
  photoshopToSpineJsxPath: z
    .string()
    .optional()
    .describe(
      "Path to the PhotoshopToSpine.jsx script. Defaults to the PHOTOSHOP_TO_SPINE_JSX environment variable, or 'vendor/PhotoshopToSpine.jsx' relative to the project root.",
    ),
};

async function validateInput(
  psdPath: string,
  outputDir: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const psdStat = await stat(psdPath);
    if (!psdStat.isFile()) {
      return { valid: false, error: `psdPath is not a file: ${psdPath}` };
    }
    if (!psdPath.toLowerCase().endsWith(".psd")) {
      return { valid: false, error: `psdPath must be a .psd file: ${psdPath}` };
    }
  } catch {
    return { valid: false, error: `PSD file not found: ${psdPath}` };
  }

  try {
    const outStat = await stat(outputDir);
    if (!outStat.isDirectory()) {
      return { valid: false, error: `outputDir is not a directory: ${outputDir}` };
    }
  } catch {
    return { valid: false, error: `outputDir does not exist: ${outputDir}` };
  }

  return { valid: true };
}

export function registerSpineExportPsdViaPhotoshopTool(server: McpServer): void {
  server.tool(
    "spine_export_psd_via_photoshop",
    "Export a PSD file to Spine JSON + PNG images using the official PhotoshopToSpine.jsx script. This calls the local Adobe Photoshop application to run the script, exporting each Photoshop layer as a PNG and producing a Spine-compatible JSON skeleton file. After this tool finishes, pass the output JSON path to spine_import_json to create a .spine project. Do not use this for PNG folder input, texture packing, or animation.",
    schema,
    async ({
      psdPath,
      outputDir,
      imagesDir,
      jsonFileName,
      scale,
      padding,
      trimWhitespace,
      ignoreHiddenLayers,
      ignoreBackground,
      writeTemplate,
      photoshopExePath,
      photoshopToSpineJsxPath,
    }) => {
      const validation = await validateInput(psdPath, outputDir);
      if (!validation.valid) {
        return textContent(formatToolError(new Error(validation.error), "input validation"));
      }

      const jsxPath =
        photoshopToSpineJsxPath ??
        process.env.PHOTOSHOP_TO_SPINE_JSX ??
        getPhotoshopToSpineJsxPath();

      try {
        const jsxStat = await stat(jsxPath);
        if (!jsxStat.isFile()) {
          return textContent(
            formatToolError(new Error(`PhotoshopToSpine.jsx not found: ${jsxPath}`), "jsx validation"),
          );
        }
      } catch {
        return textContent(
          formatToolError(
            new Error(`PhotoshopToSpine.jsx not found: ${jsxPath}. Set PHOTOSHOP_TO_SPINE_JSX or pass photoshopToSpineJsxPath.`),
            "jsx validation",
          ),
        );
      }

      const absOutputDir = path.resolve(outputDir);
      const normalizedImagesDir = (imagesDir ?? "images").replace(/^\.\//, "").replace(/\/$/, "");
      const resolvedJsonFileName =
        jsonFileName ??
        path.basename(psdPath, ".psd") + ".json";

      try {
        const result = await exportPsdToSpine({
          psdPath: path.resolve(psdPath),
          outputDir: absOutputDir,
          imagesDir: normalizedImagesDir,
          jsonFileName: resolvedJsonFileName,
          scale,
          padding,
          trimWhitespace,
          ignoreHiddenLayers,
          ignoreBackground,
          writeTemplate,
          photoshopExePath,
          photoshopToSpineJsxPath: jsxPath,
          cwd: absOutputDir,
        });

        const jsonPath = path.join(absOutputDir, resolvedJsonFileName);
        const imagesPath = path.join(absOutputDir, normalizedImagesDir);

        if (result.success) {
          // Verify output files actually exist
          try {
            await stat(jsonPath);
          } catch {
            return textContent(
              formatToolError(
                new Error(
                  `Photoshop exited successfully but did not produce the expected JSON file: ${jsonPath}\n` +
                  `stdout: ${result.stdout || "(empty)"}\nstderr: ${result.stderr || "(empty)"}`,
                ),
                "output verification",
              ),
            );
          }

          let pngCount = 0;
          try {
            const entries = await readdir(imagesPath);
            pngCount = entries.filter((e) => e.toLowerCase().endsWith(".png")).length;
          } catch {
            // imagesDir may not exist
          }

          if (pngCount === 0) {
            return textContent(
              formatToolError(
                new Error(
                  `Photoshop exited successfully but no PNG files were found in: ${imagesPath}\n` +
                  `stdout: ${result.stdout || "(empty)"}\nstderr: ${result.stderr || "(empty)"}`,
                ),
                "output verification",
              ),
            );
          }

          return textContent(
            JSON.stringify({
              success: true,
              command: result.command,
              args: result.args,
              exitCode: result.exitCode,
              durationMs: result.durationMs,
              psdPath: path.resolve(psdPath),
              outputDir: absOutputDir,
              jsonPath,
              imagesDir: imagesPath,
              pngCount,
              message: `PSD exported successfully. Import the JSON with: spine_import_json(inputPath="${jsonPath}", outputProjectPath="<your-project.spine>")`,
            }, null, 2),
          );
        }

        return textContent(
          formatToolError(
            new Error(
              `Photoshop exited with code ${result.exitCode}.\n` +
              `command: ${result.command}\nargs: ${JSON.stringify(result.args)}\ncwd: ${result.cwd}\n` +
              `stdout: ${result.stdout || "(empty)"}\nstderr: ${result.stderr || "(empty)"}`,
            ),
            "photoshop export",
          ),
        );
      } catch (error) {
        return textContent(formatToolError(error, "photoshop export"));
      }
    },
  );
}
