#!/usr/bin/env node

/**
 * Startup script to run Next.js with MCP server
 * This script starts both the MCP server and Next.js dev server
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env.local");
  const additionalEnv = {};

  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      envContent.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...valueParts] = trimmed.split("=");
          additionalEnv[key.trim()] = valueParts.join("=").trim();
        }
      });
      console.log("✅ Loaded environment variables from .env.local");
    }
  } catch (error) {
    console.log("⚠️  Could not load .env.local:", error.message);
  }

  return additionalEnv;
}

console.log("🚀 Starting Next.js Test Trainer with MCP Agents...\n");

// Load environment variables
const envVars = loadEnvFile();
const fullEnv = { ...process.env, ...envVars };

// Start MCP server
console.log("📡 Starting MCP server...");
const mcpServer = spawn("node", ["index.js"], {
  cwd: path.join(__dirname, "mcp-server"),
  stdio: ["pipe", "pipe", "pipe"],
  env: fullEnv,
});

mcpServer.stdout.on("data", (data) => {
  console.log(`[MCP] ${data.toString().trim()}`);
});

mcpServer.stderr.on("data", (data) => {
  const msg = data.toString().trim();
  if (msg.includes("MCP Server running")) {
    console.log("✅ MCP server ready!");
    startNextJs();
  } else {
    console.log(`[MCP] ${msg}`);
  }
});

mcpServer.on("exit", (code) => {
  console.log(`💥 MCP server exited with code ${code}`);
  process.exit(code);
});

let nextJsStarted = false;

function startNextJs() {
  if (nextJsStarted) return;
  nextJsStarted = true;

  console.log("\n🌐 Starting Next.js dev server...");

  // Use npm.cmd on Windows, npm on Unix
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  const nextServer = spawn(npmCommand, ["run", "dev"], {
    stdio: "inherit",
    env: { ...fullEnv, MCP_AVAILABLE: "true" },
    shell: true, // Enable shell on Windows
  });

  nextServer.on("exit", (code) => {
    console.log(`💥 Next.js server exited with code ${code}`);
    mcpServer.kill("SIGTERM");
    process.exit(code);
  });
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down servers...");
  mcpServer.kill("SIGTERM");
  process.exit(0);
});

// Auto-start Next.js after 3 seconds if MCP doesn't send ready signal
setTimeout(() => {
  if (!nextJsStarted) {
    console.log("⏰ MCP server taking too long, starting Next.js anyway...");
    startNextJs();
  }
}, 3000);
