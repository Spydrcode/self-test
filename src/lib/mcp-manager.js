/**
 * MCP Manager - Handles MCP server lifecycle outside of Next.js bundling
 * This file uses Node.js APIs that shouldn't be bundled by Next.js
 */

let mcpProcess = null;
let isConnected = false;

// Start MCP server if we're in a Node.js environment
async function startMCPServer() {
  // Only run in Node.js server environment (not browser)
  if (typeof window !== "undefined" || typeof process === "undefined") {
    return false;
  }

  try {
    // Use eval to hide Node.js imports from bundler
    const { spawn, execSync } = eval("require")("child_process");
    const path = eval("require")("path");
    const fs = eval("require")("fs");

    console.log("🚀 Starting MCP server with AI agents...");

    // Get the path to the MCP server
    const mcpServerDir = path.join(process.cwd(), "mcp-server");
    const mcpServerPath = path.join(mcpServerDir, "index.js");

    // Check if MCP server exists
    if (!fs.existsSync(mcpServerPath)) {
      console.log("❌ MCP server files not found");
      console.log("💡 Run 'npm run setup' to initialize MCP server");
      return false;
    }

    // Check if node_modules exists in mcp-server
    const mcpNodeModules = path.join(mcpServerDir, "node_modules");
    if (!fs.existsSync(mcpNodeModules)) {
      console.log("📦 Installing MCP server dependencies...");
      try {
        execSync("npm install", { cwd: mcpServerDir, stdio: "inherit" });
      } catch (error) {
        console.error("❌ Failed to install MCP dependencies:", error.message);
        return false;
      }
    }

    // Start the MCP server process with environment variables
    mcpProcess = spawn("node", [mcpServerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: mcpServerDir,
      env: {
        ...process.env, // Pass all environment variables from the main process
      },
    });

    // Handle server output
    mcpProcess.stderr.on("data", (data) => {
      const message = data.toString();
      if (message.includes("Test Trainer MCP Server running")) {
        console.log("✅ MCP server ready! All 5 AI agents are now active:");
        console.log("  🎯 Test Generator Agent");
        console.log("  ✅ Test Checker Agent");
        console.log("  💡 Answer Explanation Agent");
        console.log("  🔧 Utility Agent");
        console.log("  🧠 Adaptive Learning Agent");
        isConnected = true;
      } else if (message.includes("error") || message.includes("Error")) {
        console.error("🔥 MCP Server error:", message.trim());
      }
    });

    mcpProcess.on("exit", (code) => {
      console.log(`📴 MCP Server exited with code ${code}`);
      isConnected = false;
      mcpProcess = null;
    });

    mcpProcess.on("error", (error) => {
      console.error("💥 MCP Process error:", error.message);
      isConnected = false;
      mcpProcess = null;
    });

    // Wait for connection with timeout
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds

    while (!isConnected && attempts < maxAttempts && mcpProcess) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;

      if (attempts % 6 === 0) {
        console.log(`⏳ Waiting for MCP server... (${attempts * 500}ms)`);
      }
    }

    if (isConnected) {
      console.log("🎉 MCP server fully initialized with all AI agents!");
      return true;
    } else {
      console.log("⏰ MCP server startup timeout - using OpenAI fallback");
      cleanup();
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to start MCP server:", error.message);
    cleanup();
    return false;
  }
}

function cleanup() {
  if (mcpProcess && !mcpProcess.killed) {
    console.log("🧹 Cleaning up MCP process...");
    mcpProcess.kill("SIGTERM");
    setTimeout(() => {
      if (mcpProcess && !mcpProcess.killed) {
        mcpProcess.kill("SIGKILL");
      }
    }, 5000);
  }
  isConnected = false;
  mcpProcess = null;
}

function getMCPProcess() {
  return mcpProcess;
}

function isMCPConnected() {
  return isConnected;
}

// Auto-start MCP server when this module is loaded in development
if (process.env.NODE_ENV === "development" && typeof window === "undefined") {
  // Add a delay to let Next.js finish starting up before starting MCP server
  setTimeout(() => {
    console.log("🎯 Initializing MCP server for AI agents...");
    startMCPServer().catch((error) => {
      console.error("Failed to auto-start MCP server:", error.message);
      console.log("🔄 Will fall back to enhanced OpenAI when needed");
    });
  }, 3000);
}

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);
}

module.exports = {
  startMCPServer,
  cleanup,
  getMCPProcess,
  isMCPConnected,
};
