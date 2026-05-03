import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "..", "build", "index.js");

const REQUIRED_TOOLS = [
  "spine_analyze_json",
  "spine_generate_simple_skeleton_json",
  "spine_build_animation_from_json",
  "spine_create_loading_animation_preset",
];

const MIN_TOOL_COUNT = 23;

let nextId = 1;
const pendingRequests = new Map();

function sendRequest(method, params) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(payload + "\n");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
    }, 10000);
    pendingRequests.set(id, { resolve, reject, timer });
  });
}

console.log(`[smoke] Starting MCP server: node ${serverPath}`);

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let buffer = "";

child.stderr.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  if (text.includes("[spine-mcp]")) {
    process.stderr.write(text);
  }
});

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep incomplete line in buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.id != null && pendingRequests.has(parsed.id)) {
        const { resolve, timer } = pendingRequests.get(parsed.id);
        pendingRequests.delete(parsed.id);
        clearTimeout(timer);
        resolve(parsed);
      }
    } catch {
      // not valid JSON, skip
    }
  }
});

child.on("error", (error) => {
  console.error("[smoke] Failed to start server:", error.message);
  process.exit(1);
});

child.on("close", (code) => {
  if (code !== null && code !== 0) {
    console.error(`[smoke] Server exited with code ${code}`);
    process.exit(1);
  }
});

async function run() {
  let failed = false;

  // Test 1: tools/list
  console.log("[smoke] Test 1: tools/list");
  const listResponse = await sendRequest("tools/list");
  const tools = listResponse.result?.tools ?? [];
  const toolNames = tools.map((t) => t.name);

  console.log(`[smoke]   ${tools.length} tools returned`);
  console.log(`[smoke]   Tools: ${toolNames.join(", ")}`);

  if (tools.length < MIN_TOOL_COUNT) {
    console.error(`[smoke]   FAIL: Expected at least ${MIN_TOOL_COUNT} tools, got ${tools.length}`);
    failed = true;
  }

  for (const required of REQUIRED_TOOLS) {
    if (!toolNames.includes(required)) {
      console.error(`[smoke]   FAIL: Missing required tool: ${required}`);
      failed = true;
    }
  }

  if (!failed) {
    console.log("[smoke]   PASS");
  }

  // Test 2: spine_export with "json+pack" mode string should fail
  console.log("[smoke] Test 2: spine_export rejects mode string 'json+pack'");
  const exportResponse1 = await sendRequest("tools/call", {
    name: "spine_export",
    arguments: {
      projectPath: "G:\\fake\\project.spine",
      outputPath: "G:\\fake\\output",
      exportModeOrSettings: "json+pack",
    },
  });
  const text1 = exportResponse1.result?.content?.[0]?.text ?? "";
  const parsed1 = JSON.parse(text1);
  if (parsed1.success !== false) {
    console.error(`[smoke]   FAIL: Expected success=false, got ${parsed1.success}`);
    failed = true;
  } else if (!parsed1.error?.includes("json+pack")) {
    console.error(`[smoke]   FAIL: Error message should mention 'json+pack': ${parsed1.error}`);
    failed = true;
  } else {
    console.log(`[smoke]   PASS: ${parsed1.error}`);
  }

  // Test 3: spine_export with "json" mode string should fail
  console.log("[smoke] Test 3: spine_export rejects mode string 'json'");
  const exportResponse2 = await sendRequest("tools/call", {
    name: "spine_export",
    arguments: {
      projectPath: "G:\\fake\\project.spine",
      outputPath: "G:\\fake\\output",
      exportModeOrSettings: "json",
    },
  });
  const text2 = exportResponse2.result?.content?.[0]?.text ?? "";
  const parsed2 = JSON.parse(text2);
  if (parsed2.success !== false) {
    console.error(`[smoke]   FAIL: Expected success=false, got ${parsed2.success}`);
    failed = true;
  } else if (!parsed2.error?.includes("json")) {
    console.error(`[smoke]   FAIL: Error message should mention 'json': ${parsed2.error}`);
    failed = true;
  } else {
    console.log(`[smoke]   PASS: ${parsed2.error}`);
  }

  // Test 4: spine_export with nonexistent file path should fail
  console.log("[smoke] Test 4: spine_export rejects nonexistent settings file");
  const exportResponse3 = await sendRequest("tools/call", {
    name: "spine_export",
    arguments: {
      projectPath: "G:\\fake\\project.spine",
      outputPath: "G:\\fake\\output",
      exportModeOrSettings: "G:\\nonexistent\\settings.json",
    },
  });
  const text3 = exportResponse3.result?.content?.[0]?.text ?? "";
  const parsed3 = JSON.parse(text3);
  if (parsed3.success !== false) {
    console.error(`[smoke]   FAIL: Expected success=false, got ${parsed3.success}`);
    failed = true;
  } else if (!parsed3.error?.includes("does not exist")) {
    console.error(`[smoke]   FAIL: Error should mention 'does not exist': ${parsed3.error}`);
    failed = true;
  } else {
    console.log(`[smoke]   PASS: ${parsed3.error}`);
  }

  // Summary
  console.log("");
  if (failed) {
    console.error("[smoke] FAILED");
    child.kill();
    process.exit(1);
  }

  console.log(`[smoke] ALL PASSED (${tools.length} tools, mode string rejection verified)`);
  child.kill();
  process.exit(0);
}

run().catch((error) => {
  console.error("[smoke] Unexpected error:", error);
  child.kill();
  process.exit(1);
});
