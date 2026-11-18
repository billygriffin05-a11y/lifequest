// Verifies a stdio MCP server responds: performs initialize + tools/list.
// Usage: node scripts/mcp-probe.mjs <command> [args...]
import { spawn } from "node:child_process";

const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "inherit"], shell: process.platform === "win32" && !cmd.endsWith(".exe") && cmd !== process.execPath });
let buf = "";
const timer = setTimeout(() => {
  console.error("TIMEOUT: no tools/list response");
  child.kill();
  process.exit(1);
}, 60000);
child.stdout.on("data", (d) => {
  buf += d;
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) {
        console.log(`server: ${msg.result?.serverInfo?.name} ${msg.result?.serverInfo?.version ?? ""}`);
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
      }
      if (msg.id === 2) {
        console.log(`tools: ${msg.result.tools.map((t) => t.name).join(", ")}`);
        clearTimeout(timer);
        child.kill();
        process.exit(0);
      }
    } catch {
      /* partial line */
    }
  }
});
child.stdin.write(
  JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "lifequest-probe", version: "0" } },
  }) + "\n",
);
