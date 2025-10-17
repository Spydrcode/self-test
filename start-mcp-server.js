#!/usr/bin/env node

/**
 * MCP Server Launcher for Test Trainer
 * Handles initialization and graceful shutdown of AI agents
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPServerManager {
  constructor() {
    this.serverProcess = null;
    this.isShuttingDown = false;
  }

  async start() {
    console.log("🚀 Starting Test Trainer MCP Server...");

    const serverScript = path.join(__dirname, "mcp-server", "index.js");

    // Load environment variables from .env.local
    const envPath = path.join(__dirname, ".env.local");
    let additionalEnv = {};

    try {
      const fs = await import("fs");
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

    try {
      this.serverProcess = spawn("node", [serverScript], {
        stdio: "inherit",
        env: {
          ...process.env,
          ...additionalEnv,
          NODE_ENV: "development", // Changed from production
        },
      });

      this.serverProcess.on("error", (error) => {
        console.error("❌ MCP Server failed to start:", error);
      });

      this.serverProcess.on("exit", (code, signal) => {
        if (!this.isShuttingDown) {
          console.log(
            `⚠️  MCP Server exited with code ${code} (signal: ${signal})`
          );
          if (code !== 0) {
            console.log("🔄 Attempting to restart...");
            setTimeout(() => this.start(), 5000);
          }
        }
      });

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      console.log("✅ MCP Server started successfully");
      console.log("🤖 AI Agents available:");
      console.log("   • Test Generator (Junior Web Dev Focus)");
      console.log("   • Test Checker (Advanced Grading)");
      console.log("   • Utility Agent (Explanations & Validation)");
    } catch (error) {
      console.error("❌ Failed to start MCP Server:", error);
      process.exit(1);
    }
  }

  setupShutdownHandlers() {
    const shutdown = (signal) => {
      if (this.isShuttingDown) return;

      console.log(`\n⏹️  Received ${signal}, shutting down MCP Server...`);
      this.isShuttingDown = true;

      if (this.serverProcess) {
        this.serverProcess.kill("SIGTERM");

        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            console.log("🔥 Force killing MCP Server...");
            this.serverProcess.kill("SIGKILL");
          }
          process.exit(0);
        }, 5000);
      } else {
        process.exit(0);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGUSR1", () => shutdown("SIGUSR1"));
    process.on("SIGUSR2", () => shutdown("SIGUSR2"));
  }
}

// Start the manager
const manager = new MCPServerManager();
manager.start().catch(console.error);
