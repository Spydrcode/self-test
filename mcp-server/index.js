#!/usr/bin/env node

/**
 * MCP Server for GPT Test Trainer AI Agents
 * Provides specialized agents for junior-level web development testing
 */

// Set silent mode to prevent dotenv debug output
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Load environment variables
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from this directory or parent directory
// Completely disable dotenv verbose output that interferes with JSON-RPC
process.env.DOTENV_CONFIG_VERBOSE = "";
process.env.DEBUG = "";

// Temporarily redirect stdout during dotenv loading
const originalStdoutWrite = process.stdout.write;
process.stdout.write = function() {
  return true;
};

try {
  dotenv.config({ path: path.join(__dirname, ".env") });
  if (!process.env.OPENAI_API_KEY) {
    dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
  }
} catch (error) {
  // Use stderr to avoid interfering with JSON-RPC on stdout
  console.error("Failed to load environment variables:", error);
}

// Restore stdout after dotenv loading
process.stdout.write = originalStdoutWrite;

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import our specialized agents
import { AdaptiveLearningAgent } from "./agents/adaptive-learning-agent.js";
import { AnswerExplanationAgent } from "./agents/answer-explanation-agent.js";
import { TestCheckerAgent } from "./agents/test-checker.js";
import { TestGeneratorAgent } from "./agents/test-generator.js";
import { UtilityAgent } from "./agents/utility-agent.js";

class TestTrainerMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "test-trainer-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize agents
    this.testGenerator = new TestGeneratorAgent();
    this.testChecker = new TestCheckerAgent();
    this.utility = new UtilityAgent();
    this.answerExplainer = new AnswerExplanationAgent();
    this.adaptiveLearning = new AdaptiveLearningAgent();

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Test Generation Tools
          {
            name: "generate_jr_web_test",
            description:
              "Generate a test focused on junior-level HTML, JavaScript, UI frameworks, and APIs",
            inputSchema: {
              type: "object",
              properties: {
                topics: {
                  type: "array",
                  items: { type: "string" },
                  description: "Specific web development topics to focus on",
                },
                numQuestions: {
                  type: "number",
                  description: "Number of questions to generate (1-20)",
                  minimum: 1,
                  maximum: 20,
                },
                difficulty: {
                  type: "string",
                  enum: ["beginner", "junior", "intermediate"],
                  description:
                    "Difficulty level appropriate for junior developers",
                },
                focusAreas: {
                  type: "array",
                  items: { type: "string" },
                  description: "Areas to emphasize based on previous mistakes",
                },
                framework: {
                  type: "string",
                  enum: ["vanilla", "react", "vue", "angular", "mixed"],
                  description: "UI framework focus",
                },
              },
              required: ["numQuestions"],
            },
          },

          // Test Checking Tools
          {
            name: "grade_web_test",
            description:
              "Grade web development test answers with specialized junior-level criteria",
            inputSchema: {
              type: "object",
              properties: {
                test: {
                  type: "object",
                  description: "The test object with questions and rubrics",
                },
                answers: {
                  type: "object",
                  description: "Student answers keyed by question ID",
                },
                strictness: {
                  type: "string",
                  enum: ["lenient", "standard", "strict"],
                  description:
                    "Grading strictness for junior-level expectations",
                },
              },
              required: ["test", "answers"],
            },
          },

          // Utility Tools
          {
            name: "explain_web_concept",
            description:
              "Provide detailed explanations for web development concepts and mistakes",
            inputSchema: {
              type: "object",
              properties: {
                question: {
                  type: "object",
                  description: "The question that was answered incorrectly",
                },
                studentAnswer: {
                  type: "string",
                  description: "The student's response",
                },
                expectedAnswer: {
                  type: "string",
                  description: "The correct answer",
                },
                context: {
                  type: "string",
                  enum: [
                    "html",
                    "css",
                    "javascript",
                    "api",
                    "framework",
                    "general",
                  ],
                  description:
                    "Web development context for targeted explanations",
                },
              },
              required: ["question", "studentAnswer", "expectedAnswer"],
            },
          },

          {
            name: "explain_wrong_answer",
            description:
              "Provide specialized pedagogical explanations when student answers are incorrect",
            inputSchema: {
              type: "object",
              properties: {
                question: {
                  type: "object",
                  description: "The question that was answered incorrectly",
                },
                studentAnswer: {
                  type: "string",
                  description: "The student's incorrect response",
                },
                correctAnswer: {
                  type: "string",
                  description: "The correct answer",
                },
                category: {
                  type: "string",
                  enum: [
                    "html",
                    "css",
                    "javascript",
                    "api",
                    "framework",
                    "general",
                  ],
                  description: "Subject category for targeted explanation",
                },
                difficulty: {
                  type: "string",
                  enum: ["beginner", "junior", "intermediate"],
                  description:
                    "Student's skill level for appropriate explanation depth",
                },
                context: {
                  type: "object",
                  description:
                    "Additional context about the test or learning session",
                },
              },
              required: ["question", "studentAnswer", "correctAnswer"],
            },
          },

          {
            name: "derive_focus_topics",
            description:
              "Analyze missed questions to derive focus topics for next test",
            inputSchema: {
              type: "object",
              properties: {
                missedQuestions: {
                  type: "array",
                  items: { type: "object" },
                  description: "Questions that were answered incorrectly",
                },
                gradeResults: {
                  type: "array",
                  items: { type: "object" },
                  description: "Detailed grading results with scores",
                },
              },
              required: ["missedQuestions", "gradeResults"],
            },
          },

          {
            name: "validate_web_code",
            description:
              "Validate HTML, CSS, or JavaScript code snippets for correctness",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Code to validate",
                },
                language: {
                  type: "string",
                  enum: ["html", "css", "javascript", "json"],
                  description: "Programming language",
                },
                context: {
                  type: "string",
                  description: "Context or expected functionality",
                },
              },
              required: ["code", "language"],
            },
          },

          // Adaptive Learning Tools
          {
            name: "track_learning_progress",
            description:
              "Track student progress and adjust difficulty based on performance",
            inputSchema: {
              type: "object",
              properties: {
                userId: {
                  type: "string",
                  description:
                    "Student identifier (optional, defaults to 'default')",
                },
                testResults: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      questionId: { type: "string" },
                      correct: { type: "boolean" },
                      category: { type: "string" },
                      difficulty: { type: "string" },
                      type: { type: "string" },
                      timeSpent: { type: "number" },
                    },
                    required: ["correct", "category"],
                  },
                  description: "Array of test result objects",
                },
                currentDifficulty: {
                  type: "string",
                  enum: ["beginner", "junior", "intermediate", "advanced"],
                  description: "Current difficulty level",
                },
                subject: {
                  type: "string",
                  enum: [
                    "html",
                    "css",
                    "javascript",
                    "react",
                    "vue",
                    "angular",
                    "apis",
                    "general",
                  ],
                  description: "Subject area being tested",
                },
              },
              required: ["testResults"],
            },
          },

          {
            name: "get_progress_stats",
            description:
              "Get comprehensive progress statistics and learning analytics",
            inputSchema: {
              type: "object",
              properties: {
                userId: {
                  type: "string",
                  description:
                    "Student identifier (optional, defaults to 'default')",
                },
                timeframe: {
                  type: "string",
                  enum: ["day", "week", "month", "all"],
                  description: "Time period for statistics",
                },
              },
              required: [],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "generate_jr_web_test":
            return await this.testGenerator.generateTest(args);

          case "grade_web_test":
            return await this.testChecker.gradeTest(args);

          case "explain_web_concept":
            return await this.utility.explainConcept(args);

          case "explain_wrong_answer":
            return await this.answerExplainer.explainWrongAnswer(args);

          case "derive_focus_topics":
            return await this.utility.deriveFocusTopics(args);

          case "validate_web_code":
            return await this.utility.validateCode(args);

          case "track_learning_progress":
            return await this.adaptiveLearning.trackProgress(args);

          case "get_progress_stats":
            return await this.adaptiveLearning.getProgressStats(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // Note: Startup message commented out to prevent JSON parsing interference
    // console.error("Test Trainer MCP Server running on stdio");
  }
}

// Start the server
const server = new TestTrainerMCPServer();
server.run().catch((error) => {
  console.error("MCP Server Error:", error);
  process.exit(1);
});
