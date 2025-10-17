/**
 * MCP Startup Script - Starts MCP server automatically for development
 */

const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("🚀 Starting MCP server for AI agents...");

const mcpServerDir = path.join(__dirname, "..", "..", "mcp-server");
const mcpServerPath = path.join(mcpServerDir, "index.js");

// Check if MCP server exists
if (!fs.existsSync(mcpServerPath)) {
  console.error("❌ MCP server not found at:", mcpServerPath);
  process.exit(1);
}

// Start MCP server
const mcpProcess = spawn("node", [mcpServerPath], {
  stdio: "inherit",
  cwd: mcpServerDir,
  env: {
    ...process.env,
  },
});

mcpProcess.on("exit", (code) => {
  console.log(`📴 MCP Server exited with code ${code}`);
});

mcpProcess.on("error", (error) => {
  console.error("💥 MCP Process error:", error.message);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("🧹 Shutting down MCP server...");
  mcpProcess.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGTERM", () => {
  mcpProcess.kill("SIGTERM");
  process.exit(0);
});
