# spine-mcp

Local MCP server for first-version Spine automation on Windows. It only calls the official Spine CLI and runs over stdio, so tools such as Claude Code, Codex, and Cursor can start it locally.

This server does not do UI automation, AutoHotkey, mouse or keyboard simulation, timeline operations, mesh binding, bone weight editing, or direct `.spine` internals modification.

## Requirements

- Windows
- Node.js 20+
- Spine installed locally
- A Spine CLI executable available as either:
  - `SPINE_EXE`, preferably pointing to `Spine.com`
  - or a `Spine` command available on `PATH`

## Install

```powershell
cd G:\spine-mcp
npm.cmd install
```

## Configure Spine

Recommended: point `SPINE_EXE` to `Spine.com`.

```powershell
$env:SPINE_EXE = "C:\Program Files\Spine\Spine.com"
```

To persist it for future PowerShell sessions:

```powershell
[Environment]::SetEnvironmentVariable("SPINE_EXE", "C:\Program Files\Spine\Spine.com", "User")
```

If `SPINE_EXE` is not set, the server runs `Spine` directly.

## Build

```powershell
npm.cmd run build
npm.cmd run typecheck
```

## Start

```powershell
node G:\spine-mcp\build\index.js
```

The server uses stdio. Do not expect normal terminal output on stdout because stdout is reserved for the MCP protocol. Diagnostic logs go to stderr.

## Add To Claude Code

Basic setup:

```powershell
claude mcp add --transport stdio spine-mcp -- node G:\spine-mcp\build\index.js
```

With an explicit Spine CLI path:

```powershell
claude mcp add --transport stdio --env SPINE_EXE="C:\Program Files\Spine\Spine.com" spine-mcp -- node G:\spine-mcp\build\index.js
```

## Tools

### `spine_info`

Inspect a `.spine`, `.json`, `.skel`, or folder input:

```text
Spine -i "<inputPath>"
```

Use this when you need Spine CLI metadata. Do not use it to export, pack, import, clean, open, or modify files.

### `spine_export`

Export a Spine project:

```text
Spine -i "G:\cat\cat.spine" -o "G:\cat\dist" -e json+pack
```

Optional flags:

- `--update <updateVersion>`
- `-m` when `clean=true`

Use this for official CLI exports. Do not use it for texture-only packing, JSON import, UI automation, or internal project edits.

### `spine_pack_textures`

Pack PNG images into an atlas:

```text
Spine -i "G:\cat\images" -o "G:\cat\dist" -p "default"
```

If `projectPath` is provided:

```text
Spine -i "G:\cat\images" -o "G:\cat\dist" -p "default" -j "G:\cat\cat.spine"
```

Use this for texture packing only. Do not use it to export skeleton data or automate editor UI.

### `spine_import_json`

Import JSON, binary skeleton data, or another supported input into a `.spine` project:

```text
Spine -i "G:\cat\cat.json" -o "G:\cat\cat.spine" -r
```

Optional:

- `skeletonName` is added after `-r`
- `scale` is added with `-s <scale>`

Use this for official CLI imports. Do not use it for packing textures or direct project internals editing.

### `spine_clean`

Run animation clean up:

```text
Spine -i "G:\cat\cat.spine" -m
```

Use this for Spine CLI clean up only. It does not delete user files.

### `spine_open_project`

Open a `.spine` project in the local Spine application without waiting for Spine to exit:

```text
Spine "G:\cat\cat.spine"
```

Use this when you want to continue manual editing. Do not use it for exports or UI automation.

### `spine_validate_assets`

Read-only asset folder validation. Default required files:

```json
[
  "body.png",
  "head.png",
  "tail.png",
  "eye_left.png",
  "eye_right.png"
]
```

Returns:

- `missingFiles`
- `existingRequiredFiles`
- `allPngFiles`
- `isValid`

Use this before CLI work to check whether expected PNG files exist. It only reads the folder.

## Text-to-Spine Basic Generator

Second-version generator for simple PNG region animations. You do not need to prepare a `.spine` template first. Provide a PNG asset folder and an animation description, let the AI convert the description into MCP parameters, then the MCP server:

1. Scans PNG assets.
2. Infers parts such as `body`, `head`, `tail`, `eye`, `paw`, `shadow`, and `background`.
3. Generates a basic Spine skeleton JSON using region attachments and simple bone transform timelines.
4. Imports the generated JSON into a `.spine` project with the Spine CLI.
5. Exports the project with the Spine CLI, usually as `json+pack`.

This generator is for simple loading animations, logo bounce, mascot idle, tail wag, blink, breathing, head bob, float, and paw wave. It does not support mesh, weights, IK, professional rigging, complex skins, UI automation, mouse or keyboard simulation, or direct `.spine` binary editing. For high quality animation, open the generated `.spine` project in Spine and adjust it manually.

Recommended PNG names:

```text
body.png
head.png
tail.png
eye_left.png
eye_right.png
paw_left.png
paw_right.png
```

If names are not standard, MCP tries to infer roles from names such as `torso`, `face`, `left_eye`, `right_paw`, `ear`, Chinese names such as `身体`, `头`, `尾巴`, `左眼`, and similar patterns. Inference may be wrong, so check warnings from `spine_analyze_assets`.

### `spine_analyze_assets`

Read-only analysis of a PNG folder. It returns each PNG file, width, height, inferred role, confidence, recommended parts, and warnings.

Use this when you want to check whether MCP understands your assets before generating JSON. Do not use it to write files or call Spine.

### `spine_generate_simple_skeleton_json`

Generates:

- `outputDir/{projectName}.json`
- `outputDir/images/`
- `outputDir/generation.manifest.json`

It analyzes assets, copies used PNGs, creates a basic Spine JSON, and validates it. It does not call Spine CLI.

Use this to debug generated JSON before import. Do not use it for mesh, weights, IK, or editor automation.

### `spine_validate_generated_json`

Reads a generated JSON file and checks:

- `skeleton`
- `bones`
- `slots`
- `skins`
- `animations`
- slot bone references
- slot default attachments in skins
- animation bone references

It is intentionally not overly strict, so simple generated Spine JSON is not rejected unnecessarily.

### `spine_import_generated_json`

Imports generated JSON into a `.spine` project:

```text
Spine -i "G:\cat-output\cute_cat_loading.json" -o "G:\cat-output\cute_cat_loading.spine" -r cute_cat_loading
```

Use this when JSON already exists and you only want to import it. Do not use it to generate JSON or export.

### `spine_build_basic_animation`

High-level generator. It runs:

```text
analyze assets -> generate json -> validate json -> import .spine -> export json+pack
```

Example structured call in Claude Code:

```text
使用 spine_build_basic_animation:
assetsDir = G:\cat-assets
outputDir = G:\cat-output
projectName = cute_cat_loading
characterType = cat
animations = ["idle", "breathing", "blink", "tail_wag"]
exportMode = json+pack
openAfterBuild = true
```

Natural-language example:

```text
请用 Spine MCP 把 G:\cat-assets 里的小猫 PNG 做成一个加载动画。
身体轻轻呼吸，头上下动，尾巴左右摆，眼睛眨一下。
输出到 G:\cat-output，项目名 cute_cat_loading，并导出 json+pack。
```

AI parameter guidance:

- Small cat idle loading: `characterType="cat"`, `animations=["idle","breathing","blink","tail_wag"]`
- Logo bounce: `characterType="logo"`, `animations=["logo_bounce"]`
- Floating: add `"float"`
- Blink: add `"blink"`
- Tail wag: add `"tail_wag"`
- If animations are omitted:
  - `cat` defaults to `["idle","breathing","blink","tail_wag"]`
  - `logo` defaults to `["logo_bounce","float"]`
  - `generic` defaults to `["idle"]`

`overwrite=false` stops if `outputDir` already exists. `overwrite=true` can overwrite generated files inside `outputDir`, but the server does not delete files outside `outputDir`.

## Development

```powershell
npm.cmd run dev
```

For production MCP usage, build first and run `build/index.js`.

## Result Format

CLI-backed tools return JSON text containing:

- `command`
- `args`
- `stdout`
- `stderr`
- `exitCode`
- `success`

This makes Spine CLI errors visible to the calling AI tool without crashing the MCP server.
