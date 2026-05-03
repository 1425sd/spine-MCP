# spine-mcp

[English](README.md) | 简体中文

这是一个运行在 Windows 本地的 Spine 自动化 MCP 服务器。它只调用官方 Spine CLI，并通过 stdio 与 Claude Code、Codex、Cursor 等 AI 工具通信。

这个项目不做 UI 自动化，不使用 AutoHotkey，不模拟鼠标键盘，不拖动时间轴，不做网格绑定、骨骼权重编辑，也不直接修改 `.spine` 内部结构。涉及 `.spine` 项目的操作都通过官方 Spine CLI 完成。

## 重要说明

本项目不包含 Spine，也不会自动安装 Spine。使用前必须在本机安装 Spine，并配置可用的 Spine CLI。

GitHub 默认展示英文版文档：[README.md](README.md)。本文件是中文版说明。

## 环境要求

- Windows
- Node.js 20+
- 本地已安装 Spine
- 可用的 Spine CLI，可通过以下任一方式提供：
  - 设置 `SPINE_EXE`，推荐指向 `Spine.com`
  - 或者让 `Spine` 命令存在于 `PATH`

## Spine 版本兼容性

当前 MCP 包版本是 `0.1.0`。

本项目里的 Spine CLI 命令构造已按本地 Spine Pro / Spine Launcher `3.8.75` 检查。尤其是 Spine `3.8.75` 的导出命令必须使用导出设置 JSON 文件：

```text
Spine -i "<project.spine>" -o "<outputDir>" -e "<export-settings.json>"
```

如果输入路径正确但命令仍然报错，优先检查本机 Spine 版本是否和本项目验证版本不同。运行：

```powershell
& "$env:SPINE_EXE" --help
```

然后把输出里的 CLI 用法和 MCP 返回结果里的 `command`、`args` 对照。不同 Spine 版本可能会有不同的 CLI 参数、不同的导出设置 JSON 格式，或者拒绝在 `3.8.75` 中可用的命令。

## 安装

```powershell
cd G:\spine-mcp
npm.cmd install
```

## 配置 Spine

推荐把 `SPINE_EXE` 指向本机的 `Spine.com`。下面是常见安装路径示例，请按你的实际安装路径修改：

```powershell
$env:SPINE_EXE = "C:\Program Files\Spine\Spine.com"
```

自定义安装路径示例：

```powershell
$env:SPINE_EXE = "E:\BaiduNetdiskDownload\Spine pro 3.8.75+K'D\Spine.com"
```

确认 CLI 可用并查看版本：

```powershell
& "$env:SPINE_EXE" --help
```

如果希望以后每次 PowerShell 都生效：

```powershell
[Environment]::SetEnvironmentVariable("SPINE_EXE", "C:\Program Files\Spine\Spine.com", "User")
```

如果没有设置 `SPINE_EXE`，服务器会直接运行 `Spine` 命令。

## 构建

```powershell
npm.cmd run build
npm.cmd run typecheck
```

## 启动

```powershell
node G:\spine-mcp\build\index.js
```

服务器使用 stdio。不要期待 stdout 输出普通日志，因为 stdout 保留给 MCP 协议使用。诊断日志会写到 stderr。

## 添加到 Claude Code

基础配置：

```powershell
claude mcp add --transport stdio spine-mcp -- node G:\spine-mcp\build\index.js
```

指定 Spine CLI 路径：

```powershell
claude mcp add --transport stdio --env SPINE_EXE="C:\Program Files\Spine\Spine.com" spine-mcp -- node G:\spine-mcp\build\index.js
```

## 工具列表

当前 MCP 注册 15 个工具：

- `spine_info`
- `spine_export`
- `spine_import_json`
- `spine_clean`
- `spine_open_project`
- `spine_analyze_json`
- `spine_generate_animation_json`
- `spine_add_simple_animation`
- `spine_scan_corpus`
- `spine_learn_from_corpus`
- `spine_get_generation_guide`
- `spine_recommend_animation_params`
- `spine_build_animation_from_existing_project`
- `spine_build_animation_from_json`
- `spine_create_loading_animation_preset`

## CLI 类工具

### `spine_info`

检查 `.spine`、`.json`、`.skel` 文件或图片目录：

```text
Spine -i "<inputPath>"
```

### `spine_export`

导出 Spine 项目：

```text
Spine -i "G:\cat\cat.spine" -o "G:\cat\dist" -e "G:\cat\export-settings.json"
```

`exportSettingsPath` 是必填项，必须是已存在的 Spine 导出设置 JSON 文件。`json`、`json+pack` 这类字符串不是 Spine `3.8.75` 的合法 `-e` 参数。

可选：

- `clean=true` 时添加 `-m`

### `spine_import_json`

把 JSON、二进制骨架数据或其他支持的输入导入到 `.spine` 项目：

```text
Spine -i "G:\cat\cat.json" -o "G:\cat\cat.spine" -r
```

可选：

- `skeletonName` 会放在 `-r` 后面
- `scale` 会以 `-s <scale>` 形式放在 `-o` 前面

### `spine_clean`

执行 Spine 动画清理：

```text
Spine -i "G:\cat\cat.spine" -m
```

### `spine_open_project`

打开 `.spine` 项目，并且不等待 Spine 退出：

```text
Spine "G:\cat\cat.spine"
```

## 动画工作流

这个 MCP 面向已有 `.spine` 项目或 Spine JSON 文件。所有动画生成都会写到副本或指定输出目录，不会直接覆盖原始源文件。

推荐流程：

1. 准备已有 `.spine` 项目或 Spine JSON。
2. 使用 `spine_analyze_json` 检查骨架结构。
3. 使用 `spine_build_animation_from_json` 或 `spine_build_animation_from_existing_project` 添加基础动画。
4. 使用 `spine_export` 导出最终结果。

### `spine_analyze_json`

只读分析 Spine JSON：

```text
Use spine_analyze_json:
jsonPath = G:\cat\cat.json
```

返回骨架信息、骨骼、插槽、皮肤、附件、动画，以及推断出的 body、head、tail、eye 等角色。

### `spine_generate_animation_json`

只生成带动画的 JSON 副本：

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

支持的基础动画包括 breathing、head_float、tail_swing、blink、paw_wave、logo_bounce、floating。

### `spine_add_simple_animation`

低层调试工具，用于给指定骨骼添加一个 rotate、translate 或 scale 时间线：

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

### `spine_create_loading_animation_preset`

创建加载动画预设：

```text
Use spine_create_loading_animation_preset:
sourceJsonPath = G:\cat\cat.json
outputJsonPath = G:\cat-output\cat.loading.json
preset = cute_cat_loading
duration = 2
intensity = normal
overwrite = true
```

支持的预设：

- `cute_cat_loading`
- `logo_bounce`
- `breathing_idle`
- `floating_character`
- `blink_loop`

### `spine_build_animation_from_json`

一站式 JSON 工作流：

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

流程：

```text
analyze JSON -> generate animated JSON -> import .spine -> pack textures -> export -> optionally open project
```

如果没有提供 `exportSettingsPath`，工具仍会生成 JSON、导入 `.spine`，也可以打开项目，但会跳过最终导出，因为 Spine `3.8.75` 的导出必须使用 `-e <settings.json>`。

### `spine_build_animation_from_existing_project`

对已有 `.spine` 项目或 Spine JSON 添加基础动画。原文件保持不变，结果写入 `outputDir`。

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

如果使用 `spineProjectPath` 而不是 `sourceJsonPath`，需要提供 `sourceExportSettingsPath` 用于把源 `.spine` 临时导出为 JSON。未提供时，工具会尝试复用 `exportSettingsPath` 或旧参数 `exportMode`。

这个工作流只创建基础骨骼/插槽关键帧动画，不做网格绑定、权重、IK，也不直接修改原始 `.spine` 二进制文件。

## 语料学习层

如果你有大量本地 Spine 项目，可以先运行语料学习。它不是大模型训练，只是在本地扫描 `.spine` 和 `.json` 项目，提取命名、动画、时间线和变换范围等统计信息，然后写入 `knowledge/`。

源文件不会上传。MCP 只读取本地目录，并把 `.spine` 文件导出到本地 `.cache/corpus-json/` 供分析。

### 第 1 步：扫描语料

```text
Use spine_scan_corpus:
corpusDir = G:\spine-corpus
maxProjects = 20
```

### 第 2 步：学习语料

```text
Use spine_learn_from_corpus:
corpusDir = G:\spine-corpus
outputKnowledgeDir = G:\spine-mcp\knowledge
exportSettingsPath = G:\spine-corpus\json-export-settings.json
maxProjects = 819
overwrite = true
```

对于 `.json` 文件，MCP 会直接解析。对于 `.spine` 文件，MCP 会调用 Spine CLI：

```text
Spine -i "<project.spine>" -o "G:\spine-mcp\.cache\corpus-json\<project>" -e "G:\spine-corpus\json-export-settings.json"
```

如果没有提供 `exportSettingsPath`，`.json` 语料仍可分析，但 `.spine` 语料无法导出，会被记录到 `failedProjects`。

### 第 3 步：读取指南

```text
Use spine_get_generation_guide:
knowledgeDir = G:\spine-mcp\knowledge
```

### 第 4 步：推荐参数

```text
Use spine_recommend_animation_params:
userGoal = "做一个可爱的小猫加载动画，身体轻轻呼吸，头上下动，尾巴左右摆，眼睛眨一下"
characterType = cat
availableAssetRoles = ["body", "head", "tail", "eye_left", "eye_right"]
knowledgeDir = G:\spine-mcp\knowledge
```

## 开发

```powershell
npm.cmd run dev
```

生产环境使用前先构建，然后运行 `build/index.js`。

## 返回格式

CLI 类工具会返回 JSON 文本，通常包含：

- `command`
- `args`
- `stdout`
- `stderr`
- `exitCode`
- `success`

这样调用方可以看到 Spine CLI 错误，而不会让 MCP 服务器崩溃。
