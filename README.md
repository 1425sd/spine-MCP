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

Example for a custom local install path:

```powershell
$env:SPINE_EXE = "E:\BaiduNetdiskDownload\Spine pro 3.8.75+K'D\Spine.com"
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

Custom local path example:

```powershell
claude mcp add --transport stdio --env SPINE_EXE="E:\BaiduNetdiskDownload\Spine pro 3.8.75+K'D\Spine.com" spine-mcp -- node G:\spine-mcp\build\index.js
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

## Spine Corpus Learning Layer

If you have many local Spine source projects, run corpus learning first. This is not large-model training. It is local statistical analysis that extracts patterns from real `.spine` and `.json` projects, then writes markdown and JSON knowledge files that AI tools and MCP tools can read later.

Your source files are not uploaded. The server only reads the corpus directory, exports `.spine` files to local `.cache/corpus-json/` when needed, and writes knowledge files to `knowledge/` or the directory you choose.

The learning layer extracts:

- naming habits for bones, slots, skins, attachments, and animations
- common skeleton sizes and animation counts
- common animation names
- common duration values
- transform ranges for idle, blink, tail_wag, breathing, float, logo_bounce, and related animations
- timeline usage such as translate, rotate, scale, attachment, color, drawOrder, and event

Generated files:

```text
knowledge/learned-spine-guide.md
knowledge/learned-spine-stats.json
knowledge/learned-animation-presets.json
knowledge/learned-naming-rules.json
knowledge/examples-index.json
```

### Step 1: Scan Corpus

```text
使用 spine_scan_corpus:
corpusDir = G:\spine-corpus
maxProjects = 20
```

This only confirms how many `.spine` and `.json` files can be found. It does not parse projects or call Spine CLI.

### Step 2: Learn Corpus

```text
使用 spine_learn_from_corpus:
corpusDir = G:\spine-corpus
outputKnowledgeDir = G:\spine-mcp\knowledge
maxProjects = 819
overwrite = true
```

For `.json` files, MCP parses them directly. For `.spine` files, MCP calls Spine CLI export:

```text
Spine -i "<project.spine>" -o "G:\spine-mcp\.cache\corpus-json\<project>" -e json
```

If a project fails to export or parse, it is recorded in `failedProjects` and the batch continues.

### Step 3: Read Guide

```text
使用 spine_get_generation_guide:
knowledgeDir = G:\spine-mcp\knowledge
```

This returns the markdown guide plus machine-readable presets and naming rules. If the files do not exist, it asks you to run `spine_learn_from_corpus`.

### Step 4: Recommend Parameters

```text
使用 spine_recommend_animation_params:
userGoal = "做一个可爱的小猫加载动画，身体轻轻呼吸，头上下动，尾巴左右摆，眼睛眨一下"
characterType = cat
availableAssetRoles = ["body", "head", "tail", "eye_left", "eye_right"]
knowledgeDir = G:\spine-mcp\knowledge
```

This returns recommended animations, duration, learned preset params, warnings, and a short reasoning summary. If knowledge is missing, it falls back to built-in defaults.

### Step 5: Build With Knowledge

```text
使用 spine_build_basic_animation_with_knowledge:
assetsDir = G:\cat-assets
outputDir = G:\cat-output
projectName = cute_cat_loading
userGoal = "做一个可爱的小猫加载动画，身体轻轻呼吸，头上下动，尾巴左右摆，眼睛眨一下"
characterType = cat
exportMode = json+pack
openAfterBuild = true
overwrite = true
```

This high-level tool reads the knowledge files automatically. It does not depend on the AI remembering to call `spine_get_generation_guide` first. If knowledge files are missing, it returns a warning and continues with second-version defaults.

The generated result is still a basic region-attachment animation. High-quality animation may still need manual adjustment in Spine.

## Existing Project Animation Workflow

Use `spine_build_animation_from_existing_project` when you already have a Photoshop to Spine exported JSON, an `images` folder, or an existing `.spine` project. This workflow keeps the original source files untouched and writes a modified generated copy into `outputDir`.

Supported inputs:

- `sourceJsonPath`: an existing Spine JSON file, including Photoshop to Spine output.
- `imagesDir`: optional image folder referenced by the JSON. When provided, it is copied to `outputDir/images`.
- `spineProjectPath`: an existing `.spine` file. MCP first exports it to JSON with Spine CLI, then adds generated animation keyframes.

The tool reads the learned knowledge files from `knowledgeDir` (default `G:\spine-mcp\knowledge`) and falls back to built-in presets if knowledge files do not exist. It infers existing bones, slots, and default attachments, then adds simple bone transform or slot attachment timelines such as `idle`, `breathing`, `blink`, `tail_wag`, `head_bob`, `float`, `logo_bounce`, and `paw_wave`.

Photoshop to Spine JSON example:

```text
Use spine_build_animation_from_existing_project:
sourceJsonPath = G:\cat-psd-export\cat.json
imagesDir = G:\cat-psd-export\images
outputDir = G:\cat-existing-output
projectName = cute_cat_existing
userGoal = "Make a cute cat loading animation with breathing, head bob, tail wag, and blink."
characterType = cat
exportMode = json+pack
openAfterBuild = true
overwrite = true
```

Existing `.spine` project example:

```text
Use spine_build_animation_from_existing_project:
spineProjectPath = G:\cat-source\cat.spine
outputDir = G:\cat-existing-output
projectName = cute_cat_existing
userGoal = "Add a restrained idle animation with breathing and blinking."
characterType = cat
exportMode = json+pack
openAfterBuild = true
overwrite = true
```

This workflow still only creates basic region/slot/keyframe animation. It does not bind mesh, edit weights, create IK, simulate editor clicks, or modify the original `.spine` binary in place.

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
