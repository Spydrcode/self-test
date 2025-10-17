/**
 * Agent Coordinator - Manages communication with MCP agents
 * Provides interface between Next.js API routes and specialized AI agents
 */

import { spawn } from "child_process";
import path from "path";

export class AgentCoordinator {
  constructor() {
    this.mcpProcess = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.responseCallbacks = new Map();
    this.requestId = 0;
  }

  async initialize() {
    if (this.isConnected) return;

    try {
      // Start the MCP server process
      const mcpServerPath = path.join(process.cwd(), "mcp-server", "index.js");
      this.mcpProcess = spawn("node", [mcpServerPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      // Set up communication handlers
      this.setupCommunication();

      // Wait for connection
      await this.waitForConnection();

      console.log("MCP Agent system initialized successfully");
    } catch (error) {
      console.error("Failed to initialize MCP agents:", error);
      throw error;
    }
  }

  setupCommunication() {
    let buffer = "";

    // Handle incoming messages from MCP server
    this.mcpProcess.stdout.on("data", (data) => {
      buffer += data.toString();

      // Process complete JSON messages
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      lines.forEach((line) => {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleResponse(message);
          } catch (error) {
            console.error("Failed to parse MCP response:", error);
          }
        }
      });
    });

    // Handle errors
    this.mcpProcess.stderr.on("data", (data) => {
      const errorMsg = data.toString();
      if (errorMsg.includes("MCP Server running")) {
        this.isConnected = true;
      } else {
        console.error("MCP Server error:", errorMsg);
      }
    });

    this.mcpProcess.on("exit", (code) => {
      console.log(`MCP Server exited with code ${code}`);
      this.isConnected = false;
    });
  }

  async waitForConnection() {
    let attempts = 0;
    const maxAttempts = 10;

    while (!this.isConnected && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    if (!this.isConnected) {
      throw new Error("Failed to connect to MCP server");
    }
  }

  async sendToolCall(toolName, arguments_) {
    if (!this.isConnected) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;

      const message = {
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: arguments_,
        },
      };

      // Store callback for this request
      this.responseCallbacks.set(requestId, { resolve, reject });

      // Send message to MCP server
      this.mcpProcess.stdin.write(JSON.stringify(message) + "\n");

      // Set timeout for response
      setTimeout(() => {
        if (this.responseCallbacks.has(requestId)) {
          this.responseCallbacks.delete(requestId);
          reject(new Error("MCP tool call timeout"));
        }
      }, 30000); // 30 second timeout
    });
  }

  handleResponse(message) {
    if (message.id && this.responseCallbacks.has(message.id)) {
      const { resolve, reject } = this.responseCallbacks.get(message.id);
      this.responseCallbacks.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || "MCP tool call failed"));
      } else {
        resolve(message.result);
      }
    }
  }

  // High-level methods for API routes
  async generateWebDevTest(options) {
    try {
      const result = await this.sendToolCall("generate_jr_web_test", {
        topics: options.topics || ["javascript", "html"],
        numQuestions: options.numQuestions || 5,
        difficulty: options.difficulty || "junior",
        focusAreas: options.focusTopics || [],
        framework: options.framework || "vanilla",
      });

      return this.parseToolResponse(result);
    } catch (error) {
      throw new Error(`Test generation failed: ${error.message}`);
    }
  }

  async gradeWebDevTest(test, answers, options = {}) {
    try {
      const result = await this.sendToolCall("grade_web_test", {
        test,
        answers,
        strictness: options.strictness || "standard",
      });

      return this.parseToolResponse(result);
    } catch (error) {
      throw new Error(`Test grading failed: ${error.message}`);
    }
  }

  async explainWebConcept(
    question,
    studentAnswer,
    expectedAnswer,
    context = "general"
  ) {
    try {
      const result = await this.sendToolCall("explain_web_concept", {
        question,
        studentAnswer,
        expectedAnswer,
        context,
      });

      return this.parseToolResponse(result);
    } catch (error) {
      throw new Error(`Concept explanation failed: ${error.message}`);
    }
  }

  async explainWrongAnswer(
    question,
    studentAnswer,
    correctAnswer,
    options = {}
  ) {
    try {
      const result = await this.sendToolCall("explain_wrong_answer", {
        question,
        studentAnswer,
        correctAnswer,
        category: options.category || question.category || "general",
        difficulty: options.difficulty || "junior",
        context: options.context || {},
      });

      return this.parseToolResponse(result);
    } catch (error) {
      throw new Error(`Wrong answer explanation failed: ${error.message}`);
    }
  }

  async deriveFocusTopics(missedQuestions, gradeResults) {
    try {
      const result = await this.sendToolCall("derive_focus_topics", {
        missedQuestions,
        gradeResults,
      });

      return this.parseToolResponse(result);
    } catch (error) {
      throw new Error(`Focus topic derivation failed: ${error.message}`);
    }
  }

  async validateWebCode(code, language, context = "") {
    try {
      const result = await this.sendToolCall("validate_web_code", {
        code,
        language,
        context,
      });

      return this.parseToolResponse(result);
    } catch (error) {
      throw new Error(`Code validation failed: ${error.message}`);
    }
  }

  parseToolResponse(result) {
    if (!result || !result.content || !result.content[0]) {
      throw new Error("Invalid tool response format");
    }

    try {
      return JSON.parse(result.content[0].text);
    } catch (error) {
      throw new Error("Failed to parse tool response JSON");
    }
  }

  async shutdown() {
    if (this.mcpProcess) {
      this.mcpProcess.kill("SIGTERM");
      this.mcpProcess = null;
      this.isConnected = false;
    }
  }

  // Get agent capabilities and status
  async getStatus() {
    return {
      connected: this.isConnected,
      processId: this.mcpProcess?.pid || null,
      availableTools: [
        "generate_jr_web_test",
        "grade_web_test",
        "explain_web_concept",
        "explain_wrong_answer",
        "derive_focus_topics",
        "validate_web_code",
      ],
    };
  }
}

// Singleton instance
let agentCoordinator = null;

export function getAgentCoordinator() {
  if (!agentCoordinator) {
    agentCoordinator = new AgentCoordinator();
  }
  return agentCoordinator;
}

// Graceful shutdown
process.on("SIGTERM", () => {
  if (agentCoordinator) {
    agentCoordinator.shutdown();
  }
});

process.on("SIGINT", () => {
  if (agentCoordinator) {
    agentCoordinator.shutdown();
  }
});
