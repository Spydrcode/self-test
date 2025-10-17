import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Type definitions
interface TestQuestion {
  id: number;
  type: string;
  prompt: string;
  choices?: string[];
  answer: string;
  rubric?: string[];
  points: number;
  category: string;
}

interface TestResult {
  questions: TestQuestion[];
  totalPoints: number;
}

interface TestParams {
  topics?: string[];
  numQuestions?: number;
  difficulty?: string;
  focusAreas?: string[];
  framework?: string;
}

interface GradeParams {
  test: { result: TestResult };
  answers: Record<string, string>;
  strictness?: string;
}

interface ExplainParams {
  question: TestQuestion;
  studentAnswer: string;
  expectedAnswer: string;
  context?: string;
}

interface ConceptParams {
  concept: string;
  context?: string;
}

interface ProgressParams {
  testResults: Array<{
    correct: boolean;
    category?: string;
    score?: number;
  }>;
  currentDifficulty?: string;
  subject?: string;
  userId?: string;
}

// Initialize OpenAI client
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("OpenAI API Key present:", !!apiKey);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({
    apiKey,
  });
}

// Agent implementations
class TestGeneratorAgent {
  async generateJrWebTest(params: TestParams) {
    const openai = getOpenAI();

    const {
      topics = ["javascript", "html"],
      numQuestions = 5,
      difficulty = "junior",
      focusAreas = [],
    } = params;

    const systemPrompt = `Generate a JSON formatted web development test for junior developers.

KEY REQUIREMENTS:
- Real-world junior developer scenarios  
- Practical workplace questions, NOT academic theory
- Mix of multiple choice (4 options), short answer, and code questions
- Test SPECIFIC techniques junior devs use daily
- Points should sum to exactly 100

SAMPLE FRAMEWORKS:
HTML: Forms, semantic tags, accessibility, meta tags
CSS: Flexbox, Grid, responsive design, selectors, animations  
JavaScript: DOM, events, async/await, fetch, array methods, ES6+
APIs: REST calls, JSON handling, error handling, authentication
Frameworks: Basic React/Vue components, state, props, lifecycle

JSON STRUCTURE:
{ "questions":[{"id":1,"type":"mcq"|"short"|"code","prompt":"...","choices":[...],"answer":"...","rubric":["..."],"points":<int>,"category":"html|css|javascript|api|framework"}],"totalPoints":100 }

VARIETY RULES:
- Use different real-world scenarios each time
- Vary question complexity and formats
- Include workplace-relevant contexts
- Test different aspects of each topic
- Avoid generic/textbook examples`;

    const topicsText = topics.join(", ");
    const focusText =
      focusAreas.length > 0 ? ` Focus on: ${focusAreas.join(", ")}.` : "";

    const contexts = [
      "e-commerce website",
      "blog platform",
      "social media app",
      "task management tool",
      "weather dashboard",
      "portfolio site",
      "news aggregator",
      "fitness tracker",
      "recipe organizer",
    ];
    const randomContext = contexts[Math.floor(Math.random() * contexts.length)];
    const timestamp = new Date().toISOString();

    const userPrompt = `Generate ${numQuestions} FRESH junior web developer questions for a ${randomContext} project.
    
TIMESTAMP: ${timestamp}
Topics: ${topicsText}
${focusText}
Difficulty: ${difficulty}

Create unique, practical scenarios that junior developers encounter in real jobs. 
Avoid repetitive patterns. Points sum to 100.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.6,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }
}

class TestCheckerAgent {
  async gradeWebDevTest(params: GradeParams) {
    const openai = getOpenAI();
    const { test, answers, strictness = "standard" } = params;

    const systemPrompt = `Grade a junior web developer test with detailed feedback.

GRADING CRITERIA:
- Exact match for multiple choice questions
- Partial credit for short answers showing understanding
- Code questions: functionality > syntax perfection
- Focus on practical understanding over memorization

STRICTNESS LEVELS:
- lenient: Accept reasonable interpretations, give partial credit generously
- standard: Standard grading with some flexibility for junior level
- strict: Precise answers required, minimal partial credit

OUTPUT FORMAT:
{
  "results": [
    {
      "id": 1,
      "score": 85,
      "max": 100,
      "feedback": "Good understanding shown...",
      "correct": true,
      "expected": "Expected answer here"
    }
  ],
  "overallScore": 78.5,
  "totalPoints": 100,
  "summary": "Overall performance analysis..."
}`;

    const userPrompt = `Grade this test with ${strictness} strictness:

TEST: ${JSON.stringify(test)}
ANSWERS: ${JSON.stringify(answers)}

Provide detailed feedback for each question and overall performance summary.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }
}

class AnswerExplanationAgent {
  async explainWrongAnswer(params: ExplainParams) {
    const openai = getOpenAI();
    const {
      question,
      studentAnswer,
      expectedAnswer,
      context = "general",
    } = params;

    const systemPrompt = `Explain why a junior developer's answer is incorrect in a helpful, educational way.

EXPLANATION STYLE:
- Encouraging tone, not discouraging
- Focus on learning opportunities
- Provide correct approach step-by-step
- Include practical examples
- Suggest next steps for improvement

OUTPUT FORMAT:
{
  "isCorrect": false,
  "explanation": "Clear explanation of what went wrong...",
  "correctApproach": "Step-by-step correct method...",
  "commonMistake": "Why this mistake is common...",
  "practiceExercise": "Suggested practice to improve...",
  "resources": ["Helpful learning resources"]
}`;

    const userPrompt = `Explain why this answer is wrong:

QUESTION: ${JSON.stringify(question)}
STUDENT ANSWER: ${studentAnswer}
EXPECTED ANSWER: ${expectedAnswer}
CONTEXT: ${context}

Be helpful and educational, not just corrective.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  async explainWebConcept(params: ConceptParams) {
    const openai = getOpenAI();
    const { concept, context = "general" } = params;

    const systemPrompt = `Explain web development concepts to junior developers.

EXPLANATION STYLE:
- Clear, beginner-friendly language
- Practical examples and use cases
- Real-world applications
- Common pitfalls to avoid
- Progressive complexity

OUTPUT FORMAT:
{
  "concept": "Concept name",
  "explanation": "Clear explanation...",
  "examples": ["Practical examples"],
  "useCase": "When to use this...",
  "commonPitfalls": ["What to avoid"],
  "nextSteps": "What to learn next"
}`;

    const userPrompt = `Explain this web development concept: ${concept}
Context: ${context}

Make it practical and actionable for junior developers.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.6,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }
}

class AdaptiveLearningAgent {
  async trackLearningProgress(params: ProgressParams) {
    const openai = getOpenAI();
    const {
      testResults,
      currentDifficulty = "junior",
      subject = "general",
      userId = "default",
    } = params;

    const systemPrompt = `Analyze learning progress and provide adaptive recommendations for junior web developers.

ANALYSIS CRITERIA:
- Accuracy trends and patterns
- Topic-specific performance
- Difficulty progression readiness
- Learning velocity assessment
- Personalized next steps

OUTPUT FORMAT:
{
  "performance": {
    "accuracy": 75.5,
    "totalQuestions": 10,
    "correctAnswers": 8,
    "improvementTrend": "improving|stable|declining",
    "learningVelocity": 1.2
  },
  "difficulty": {
    "current": "junior",
    "recommended": "intermediate", 
    "reason": "Ready for more challenge based on consistent performance"
  },
  "weakAreas": ["CSS Flexbox", "JavaScript Async"],
  "strongAreas": ["HTML Semantics", "DOM Manipulation"],
  "recommendations": {
    "immediate": ["Focus areas for next session"],
    "shortTerm": ["Week-long goals"],
    "longTerm": ["Month-long objectives"]
  }
}`;

    const userPrompt = `Analyze this learning session:

TEST RESULTS: ${JSON.stringify(testResults)}
CURRENT DIFFICULTY: ${currentDifficulty}
SUBJECT: ${subject}
USER ID: ${userId}

Provide adaptive learning recommendations and difficulty adjustments.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.4,
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  }

  async getProgressStats() {
    // For now, return mock data since we don't have persistent storage
    // In a real app, this would query a database
    return {
      totalQuestions: 25,
      totalCorrect: 19,
      overallAccuracy: 76.0,
      categoryStats: {
        HTML: { correct: 8, total: 10, accuracy: 80.0 },
        CSS: { correct: 6, total: 8, accuracy: 75.0 },
        JavaScript: { correct: 5, total: 7, accuracy: 71.4 },
      },
      weakAreas: ["JavaScript Async", "CSS Grid"],
      strongAreas: ["HTML Semantics", "DOM Events"],
      currentDifficulty: "junior",
      recommendedDifficulty: "intermediate",
      streak: 3,
      improvementTrend: "improving",
      learningVelocity: 1.3,
    };
  }
}

// Initialize agents
const agents = {
  "test-generator": new TestGeneratorAgent(),
  "test-checker": new TestCheckerAgent(),
  "answer-explanation": new AnswerExplanationAgent(),
  "adaptive-learning": new AdaptiveLearningAgent(),
};

export async function POST(request: NextRequest) {
  try {
    console.log("MCP API endpoint hit");
    const body = await request.json();
    console.log("MCP request body:", JSON.stringify(body, null, 2));

    const { method, params, id } = body;

    // Handle MCP initialization
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "GPT Test Trainer MCP Server",
            version: "1.0.0",
          },
        },
      });
    }

    // Handle tool calls
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;

      let agent:
        | TestGeneratorAgent
        | TestCheckerAgent
        | AnswerExplanationAgent
        | AdaptiveLearningAgent;

      if (toolName === "generate_jr_web_test") {
        agent = agents["test-generator"];
      } else if (toolName === "grade_web_test") {
        agent = agents["test-checker"];
      } else if (toolName === "explain_wrong_answer") {
        agent = agents["answer-explanation"];
      } else if (toolName === "explain_web_concept") {
        agent = agents["answer-explanation"];
      } else if (toolName === "track_learning_progress") {
        agent = agents["adaptive-learning"];
      } else if (toolName === "get_progress_stats") {
        agent = agents["adaptive-learning"];
      } else {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Execute the tool
      let result;
      switch (toolName) {
        case "generate_jr_web_test":
          result = await (agent as TestGeneratorAgent).generateJrWebTest(
            toolArgs as TestParams
          );
          break;
        case "grade_web_test":
          result = await (agent as TestCheckerAgent).gradeWebDevTest(
            toolArgs as GradeParams
          );
          break;
        case "explain_wrong_answer":
          result = await (agent as AnswerExplanationAgent).explainWrongAnswer(
            toolArgs as ExplainParams
          );
          break;
        case "explain_web_concept":
          result = await (agent as AnswerExplanationAgent).explainWebConcept(
            toolArgs as ConceptParams
          );
          break;
        case "track_learning_progress":
          result = await (agent as AdaptiveLearningAgent).trackLearningProgress(
            toolArgs as ProgressParams
          );
          break;
        case "get_progress_stats":
          result = await (agent as AdaptiveLearningAgent).getProgressStats();
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        },
      });
    }

    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: errorMessage,
        },
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
