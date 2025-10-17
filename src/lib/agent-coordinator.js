/**
 * Agent Coordinator - Manages communication with MCP agents
 * Provides interface between Next.js API routes and specialized AI agents
 */

export class AgentCoordinator {
  constructor() {
    this.mcpProcess = null;
    this.isConnected = false;
    this.messageQueue = [];
    this.responseCallbacks = new Map();
    this.requestId = 0;
  }

  // Helper function to get the correct MCP API URL
  getMcpApiUrl() {
    // In server-side context (API routes), we need an absolute URL
    if (typeof window === "undefined") {
      // For Vercel deployments, try multiple possible environment variables
      const host =
        process.env.VERCEL_URL ||
        process.env.NEXT_PUBLIC_VERCEL_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL;

      if (host && (process.env.VERCEL || process.env.VERCEL_ENV)) {
        return `https://${host}/api/mcp`;
      }

      // Local development fallback
      return "http://localhost:3000/api/mcp";
    }
    // In browser context, use relative URL
    return "/api/mcp";
  }

  async initialize() {
    if (this.isConnected) {
      return true;
    }

    try {
      console.log("🔌 Connecting to MCP server...");

      // In Vercel, use HTTP API instead of child process
      if (process.env.VERCEL || process.env.VERCEL_ENV) {
        this.useHttpApi = true;

        // In server-side context, use direct function call
        if (typeof window === "undefined") {
          const { handleMcpRequest } = await import("./mcp-handler");
          const requestBody = {
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "GPT Test Trainer", version: "1.0.0" },
            },
            id: 1,
          };

          const result = await handleMcpRequest(requestBody);
          if (result.result) {
            this.isConnected = true;
            console.log("🔗 MCP direct connection successful");
            console.log("✅ MCP Agent system connected successfully");
            console.log(
              "🎯 All 5 AI agents ready: Test Generator, Checker, Explainer, Utility, Adaptive Learning"
            );
            return true;
          } else {
            throw new Error("Failed to initialize MCP via direct call");
          }
        }

        // In browser context, test connection to our MCP API endpoint
        const response = await fetch(this.getMcpApiUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "GPT Test Trainer", version: "1.0.0" },
            },
            id: 1,
          }),
        });

        if (response.ok) {
          this.isConnected = true;
          console.log("🔗 MCP HTTP API connection successful");
          console.log("✅ MCP Agent system connected successfully");
          console.log(
            "🎯 All 5 AI agents ready: Test Generator, Checker, Explainer, Utility, Adaptive Learning"
          );
          return true;
        } else {
          throw new Error("Failed to connect to MCP HTTP API");
        }
      }

      // Original child process code for local development
      // Use eval to hide Node.js imports from bundler
      const { spawn } = eval("require")("child_process");
      const path = eval("require")("path");

      // Start MCP server process
      const mcpServerPath = path.join(process.cwd(), "mcp-server", "index.js");

      this.mcpProcess = spawn("node", [mcpServerPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
        cwd: process.cwd(),
      });

      // Set up communication handlers
      this.setupCommunication();

      // Wait for connection
      const connected = await this.waitForConnection(10000);

      if (connected) {
        console.log("✅ MCP Agent system connected successfully");
        console.log(
          "🎯 All 5 AI agents ready: Test Generator, Checker, Explainer, Utility, Adaptive Learning"
        );
        return true;
      } else {
        throw new Error("Failed to connect to MCP server within timeout");
      }
    } catch (error) {
      console.error("❌ MCP connection failed:", error.message);
      throw error; // Don't fall back, throw error to force MCP usage
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
        const trimmedLine = line.trim();
        // Only try to parse lines that look like valid JSON-RPC messages
        // JSON-RPC messages should start with '{' and contain "jsonrpc" or "id"
        if (
          trimmedLine &&
          trimmedLine.startsWith("{") &&
          (trimmedLine.includes('"jsonrpc"') ||
            trimmedLine.includes('"id"') ||
            trimmedLine.includes('"method"'))
        ) {
          try {
            const message = JSON.parse(trimmedLine);
            this.handleResponse(message);
          } catch (error) {
            console.error("Failed to parse MCP response:", error);
          }
        }
        // Ignore non-JSON-RPC lines (like dotenv output, logs, etc.)
      });
    });

    // Handle errors
    this.mcpProcess.stderr.on("data", (data) => {
      const errorMsg = data.toString();
      console.error("MCP Server error:", errorMsg);
    });

    // Send MCP initialization request
    setTimeout(() => {
      this.sendInitializeRequest();
    }, 1000); // Give the server time to start

    this.mcpProcess.on("exit", (code) => {
      console.log(`MCP Server exited with code ${code}`);
      this.isConnected = false;
    });
  }

  sendInitializeRequest() {
    const requestId = ++this.requestId;
    const message = {
      jsonrpc: "2.0",
      id: requestId,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "GPT Test Trainer",
          version: "1.0.0",
        },
      },
    };

    // Store callback for this request
    this.responseCallbacks.set(requestId, {
      resolve: () => {
        this.isConnected = true;
        console.log("🔗 MCP initialization successful");
      },
      reject: (error) => {
        console.error("❌ MCP initialization failed:", error);
      },
    });

    // Send the message
    if (this.mcpProcess && this.mcpProcess.stdin) {
      this.mcpProcess.stdin.write(JSON.stringify(message) + "\n");
    }
  }

  async waitForConnection() {
    let attempts = 0;
    const maxAttempts = 10;

    while (!this.isConnected && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
    }

    return this.isConnected;
  }

  async sendToolCall(toolName, arguments_) {
    if (!this.isConnected) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error("MCP agents not available");
      }
    }

    // Use HTTP API in Vercel environment
    if (this.useHttpApi) {
      // In server-side context, use direct function call to avoid URL issues
      if (typeof window === "undefined") {
        const { handleMcpRequest } = await import("./mcp-handler");
        const requestBody = {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: toolName,
            arguments: arguments_,
          },
          id: ++this.requestId,
        };

        const result = await handleMcpRequest(requestBody);
        if (result.error) {
          throw new Error(result.error.message || "MCP tool call failed");
        }
        return result.result;
      }

      // In browser context, use fetch
      const response = await fetch(this.getMcpApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: toolName,
            arguments: arguments_,
          },
          id: ++this.requestId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message || "MCP tool call failed");
      }

      return result.result;
    }

    // Original child process communication for local development
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

      const parsedResult = this.parseToolResponse(result);
      return { ok: true, result: parsedResult };
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

      const parsedResult = this.parseToolResponse(result);
      return { ok: true, result: parsedResult };
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

      const parsedResult = this.parseToolResponse(result);
      return { ok: true, result: parsedResult };
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

      const parsedResult = this.parseToolResponse(result);
      return { ok: true, result: parsedResult };
    } catch (error) {
      throw new Error(`Wrong answer explanation failed: ${error.message}`);
    }
  }

  // Progress tracking and adaptive learning methods
  async trackLearningProgress(
    testResults,
    currentDifficulty = "junior",
    subject = "general",
    userId = "default"
  ) {
    // Initialize MCP connection if not connected
    if (!this.isConnected) {
      await this.initialize();
    }

    if (!this.isConnected) {
      throw new Error("MCP server required but not connected");
    }

    try {
      const result = await this.sendToolCall("track_learning_progress", {
        userId,
        testResults,
        currentDifficulty,
        subject,
      });

      return { ok: true, result: this.parseToolResponse(result) };
    } catch (error) {
      throw new Error(`Progress tracking failed: ${error.message}`);
    }
  }

  async getProgressStats(userId = "default", timeframe = "week") {
    // Initialize MCP connection if not connected
    if (!this.isConnected) {
      await this.initialize();
    }

    if (!this.isConnected) {
      throw new Error("MCP server required but not connected");
    }

    try {
      const result = await this.sendToolCall("get_progress_stats", {
        userId,
        timeframe,
      });

      return { ok: true, result: this.parseToolResponse(result) };
    } catch (error) {
      throw new Error(`Progress stats failed: ${error.message}`);
    }
  }

  parseToolResponse(result) {
    if (!result || !result.content || !result.content[0]) {
      throw new Error("Invalid tool response format");
    }

    try {
      return JSON.parse(result.content[0].text);
    } catch {
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
