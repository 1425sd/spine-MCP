# spine-mcp

Local MCP server for Spine automation on Windows. It only calls the official Spine CLI and communicates over stdio, so AI tools like Claude Code, Codex, and Cursor can start it locally.

This server does not do UI automation, AutoHotkey, mouse or keyboard simulation, timeline operations, mesh binding, bone weight editing, or direct `.spine` internals modification. It only modifies `.spine` files through the official Spine CLI.

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
Spine -i "G:\cat\cat.spine" -o "G:\cat\dist" -e export-settings.json
```

Optional flags:

- `-m` when `clean=true`

The `exportSettingsPath` parameter is required and must be a path to an existing Spine export settings JSON file. `exportModeOrSettings` is kept only as a deprecated compatibility alias. Mode strings like `json` or `json+pack` are not accepted by the Spine CLI `-e` flag.

Use this for official CLI exports. Do not use it for texture-only packing, JSON import, UI automation, or internal project edits.

### `spine_import_json`

Import JSON, binary skeleton data, or another supported input into a `.spine` project:

```text
Spine -i "G:\cat\cat.json" -o "G:\cat\cat.spine" -r
```

Optional:

- `skeletonName` is added after `-r`
- `scale` is added with `-s <scale>` before `-o`

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

## Animation Workflow

This server works with existing `.spine` projects and Spine JSON files. All animation generation is applied to a copy of the source files, leaving the originals untouched.

### Recommended workflow

1. Have an existing `.spine` project or Spine JSON file ready.
2. Use `spine_analyze_json` to inspect the skeleton structure.
3. Use `spine_build_animation_from_json` or `spine_build_animation_from_existing_project` to add animations.
4. Use `spine_export` to export the final output.

### `spine_analyze_json`

Read-only inspection of a Spine JSON file:

```text
Use spine_analyze_json:
jsonPath = G:\cat\cat.json
```

Returns skeleton metadata, bones, slots, skins, attachments, animations, and inferred roles.

### `spine_add_simple_animation`

Low-level debug tool when you know the exact bone:

```text
Use spine_add_simple_animation:
sourceJsonPath = G:\psd-spine\cat.json
outputJsonPath = G:\cat-output\cat.tail-test.json
animationName = tail_test
targetBone = tail
animationType = rotate
keyframes = [
  { "time": 0, "angle": -10 },
  { "time": 0.5, "angle": 10 },
  { "time": 1, "angle": -10 }
]
overwrite = true
```

It supports only `rotate`, `translate`, and `scale` timelines on one bone.

### `spine_generate_animation_json`

Generate an animated JSON copy only:

```text
Use spine_generate_animation_json:
sourceJsonPath = G:\cat\cat.json
outputJsonPath = G:\cat-output\cat.animated.json
userGoal = "cute cat loading animation with breathing, head float, tail swing, and blink"
animationName = generated_loop
duration = 2
characterType = cat
overwrite = true
```

Supported basic animation kinds include:

- breathing: body/root scale
- head_float: head translate
- tail_swing: tail rotate
- blink: eye slot attachment switch, or eye bone scale fallback
- paw_wave: paw/hand/arm rotate
- logo_bounce: root/logo translate and scale
- floating: root/body translate

### `spine_create_loading_animation_preset`

Focused loading presets:

```text
Use spine_create_loading_animation_preset:
sourceJsonPath = G:\cat\cat.json
outputJsonPath = G:\cat-output\cat.loading.json
preset = cute_cat_loading
duration = 2
intensity = normal
overwrite = true
```

Supported presets:

- `cute_cat_loading`
- `logo_bounce`
- `breathing_idle`
- `floating_character`
- `blink_loop`

Use `soft` intensity for subtle UI loading loops and `strong` only when you want visibly larger motion.

### `spine_build_animation_from_json`

One-step JSON pipeline:

```text
Use spine_build_animation_from_json:
sourceJsonPath = G:\cat\cat.json
imagesDir = G:\cat\images
outputDir = G:\cat-output
projectName = cute_cat_loading
userGoal = "Make a cute cat loading animation. Body breathes, head floats, tail swings, eyes blink."
animationName = loading_loop
characterType = cat
exportSettingsPath = G:\cat\export-settings.json
openAfterBuild = true
overwrite = true
knowledgeDir = G:\spine-mcp\knowledge
```

It runs:

```text
analyze JSON -> generate animated JSON -> import .spine -> pack textures -> export -> optionally open project
```

If `exportSettingsPath` is omitted, the tool still imports the generated `.spine` project and can open it, but it skips the final export step because Spine 3.8.75 requires `-e <settings.json>` for exports.

### `spine_build_animation_from_existing_project`

Build animations on an existing `.spine` project or Spine JSON. Keeps original files untouched and writes a modified copy to `outputDir`.

```text
Use spine_build_animation_from_existing_project:
spineProjectPath = G:\cat-source\cat.spine
outputDir = G:\cat-output
projectName = cute_cat_existing
userGoal = "Add a restrained idle animation with breathing and blinking."
characterType = cat
exportSettingsPath = G:\cat\export-settings.json
openAfterBuild = true
overwrite = true
```

When `spineProjectPath` is used without `sourceJsonPath`, provide `sourceExportSettingsPath` for the temporary project-to-JSON export. If it is omitted, the tool falls back to `exportSettingsPath`/`exportMode` when present.

This workflow only creates basic region/slot/keyframe animation. It does not bind mesh, edit weights, create IK, or modify the original `.spine` binary.

## Corpus Learning Layer

If you have many local Spine source projects, run corpus learning first. This is not large-model training. It is local statistical analysis that extracts patterns from real `.spine` and `.json` projects, then writes markdown and JSON knowledge files that AI tools and MCP tools can read later.

Your source files are not uploaded. The server only reads the corpus directory, exports `.spine` files to local `.cache/corpus-json/` when needed, and writes knowledge files to `knowledge/` or the directory you choose.

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
exportSettingsPath = G:\spine-corpus\json-export-settings.json
maxProjects = 819
overwrite = true
```

For `.json` files, MCP parses them directly. For `.spine` files, MCP calls Spine CLI export:

```text
Spine -i "<project.spine>" -o "G:\spine-mcp\.cache\corpus-json\<project>" -e "G:\spine-corpus\json-export-settings.json"
```

If `exportSettingsPath` is omitted, `.json` corpus files can still be analyzed directly, but `.spine` corpus files cannot be exported and are recorded as failed projects.

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
