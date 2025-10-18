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

// Helper function for safe JSON parsing
function safeJsonParse(
  content: string,
  fallback: Record<string, unknown> = {}
) {
  try {
    // Clean the content to extract JSON
    let jsonContent = content.trim();

    // Remove any markdown code block markers
    jsonContent = jsonContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");

    // Find the first { and last } to extract just the JSON object
    const firstBrace = jsonContent.indexOf("{");
    const lastBrace = jsonContent.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(jsonContent);
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    console.error("Content that failed to parse:", content);
    return fallback;
  }
}

// Agent implementations
class TestGeneratorAgent {
  async generateJrWebTest(params: TestParams) {
    const openai = getOpenAI();

    const {
      topics = ["javascript", "html"],
      numQuestions = 20,
      difficulty = "junior",
      focusAreas = [],
    } = params;

    const systemPrompt = `Generate a JSON formatted web development test for junior developers.

KEY REQUIREMENTS:
- Generate EXACTLY ${numQuestions} questions (no more, no less)
- Real-world junior developer scenarios  
- Practical workplace questions, NOT academic theory
- Mix of multiple choice (4 options), short answer, and code questions
- Test SPECIFIC techniques junior devs use daily
- Points should sum to exactly 100 (distribute evenly across questions)

SAMPLE FRAMEWORKS:
HTML: Forms, semantic tags, accessibility, meta tags
CSS: Flexbox, Grid, responsive design, selectors, animations  
JavaScript: DOM, events, async/await, fetch, array methods, ES6+
APIs: REST calls, JSON handling, error handling, authentication
Frameworks: Basic React/Vue components, state, props, lifecycle

JSON STRUCTURE:
{ "questions":[{"id":1,"type":"mcq"|"short"|"code","prompt":"...","choices":[...],"answer":"...","rubric":["..."],"points":<int>,"category":"html|css|javascript|api|framework"}],"totalPoints":100 }

CRITICAL: You MUST generate exactly ${numQuestions} questions. Each question should have approximately ${Math.round(
      100 / numQuestions
    )} points.

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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.6,
    });

    const content = response.choices[0].message.content || "{}";

    // Use safe JSON parsing with fallback
    const fallbackTest = {
      questions: Array.from({ length: numQuestions }, (_, i) => ({
        id: i + 1,
        type: i % 2 === 0 ? "mcq" : "short",
        prompt:
          i % 2 === 0
            ? `Which JavaScript method is used to add an element to the end of an array? (Question ${i +
                1})`
            : `Explain the difference between let and var in JavaScript. (Question ${i +
                1})`,
        choices:
          i % 2 === 0 ? ["push()", "pop()", "shift()", "unshift()"] : undefined,
        answer:
          i % 2 === 0
            ? "push()"
            : "let has block scope while var has function scope",
        rubric:
          i % 2 === 0
            ? ["Correct method for adding to array end"]
            : ["Mentions scope difference", "Block vs function scope"],
        points: Math.round(100 / numQuestions),
        category: "javascript",
      })),
      totalPoints: 100,
    };

    // Parse model output, falling back to deterministic test when necessary
    const parsed = safeJsonParse(content, fallbackTest) as Record<
      string,
      unknown
    >;

    // Ensure questions array exists
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      parsed.questions = fallbackTest.questions.slice();
    }

    // Normalize length: fill or trim to requested numQuestions
    const questions = parsed.questions as Array<Record<string, unknown>>;
    const currentLen = questions.length;
    if (currentLen < numQuestions) {
      const extra = Array.from(
        { length: numQuestions - currentLen },
        (_, i) => {
          const idx = currentLen + i;
          return {
            id: idx + 1,
            type: idx % 2 === 0 ? "mcq" : "short",
            prompt:
              idx % 2 === 0
                ? `Which JavaScript method is used to add an element to the end of an array? (Question ${idx +
                    1})`
                : `Explain the difference between let and var in JavaScript. (Question ${idx +
                    1})`,
            choices:
              idx % 2 === 0
                ? ["push()", "pop()", "shift()", "unshift()"]
                : undefined,
            answer:
              idx % 2 === 0
                ? "push()"
                : "let has block scope while var has function scope",
            rubric:
              idx % 2 === 0
                ? ["Correct method for adding to array end"]
                : ["Mentions scope difference"],
            points: Math.round(100 / numQuestions),
            category: "javascript",
          };
        }
      );

      questions.push(...extra);
      parsed.questions = questions;
    } else if (currentLen > numQuestions) {
      parsed.questions = questions.slice(0, numQuestions);
    }

    // Normalize points and ids, ensure totalPoints
    const pointsPer = Math.round(100 / numQuestions);
    const finalQuestions = parsed.questions as Array<Record<string, unknown>>;
    parsed.questions = finalQuestions.map(
      (q: Record<string, unknown>, idx: number) => ({
        ...q,
        id: idx + 1,
        points: q.points || pointsPer,
      })
    );
    parsed.totalPoints = 100;

    return parsed;
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 3000,
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || "{}";
    const fallbackGrade = {
      results: [],
      overallScore: 0,
      totalPoints: 100,
      summary: "Grading failed - please try again",
    };

    const gradeData = safeJsonParse(content, fallbackGrade) as Record<string, unknown>;

    const rawResults = Array.isArray((gradeData as { results?: unknown }).results)
      ? ((gradeData as { results: Array<Record<string, unknown>> }).results)
      : [];

    const questions = Array.isArray(test?.result?.questions)
      ? (test.result.questions as Array<TestQuestion>)
      : [];

    const normalizedResults: Array<Record<string, unknown>> = [];
    const answerMap = answers || {};
    const defaultPoints = questions.length > 0 ? Math.round(100 / questions.length) : 0;

    questions.forEach((question, index) => {
      const questionId = question?.id ?? index + 1;
      const key = String(questionId);

      const existing = rawResults.find((result) => {
        const candidateId = (result.id ?? result.questionId) as unknown;
        if (typeof candidateId === "number" || typeof candidateId === "string") {
          return String(candidateId) === key;
        }
        return false;
      });

      const normalized: Record<string, unknown> = existing ? { ...existing } : {};

      normalized.id = questionId;

      const maxPoints = typeof question?.points === "number" ? question.points : defaultPoints;
      if (typeof normalized.max !== "number") {
        normalized.max = maxPoints;
      }

      const expectedAnswer = question?.answer ?? "";
      if (typeof normalized.expected !== "string" || normalized.expected.length === 0) {
        normalized.expected = expectedAnswer;
      }

      const studentAnswerRaw = answerMap[key];
      const studentAnswer = typeof studentAnswerRaw === "string" ? studentAnswerRaw.trim() : "";
      normalized.studentAnswer = studentAnswer;

      const hasAnswer = studentAnswer.length > 0;

      if (!hasAnswer) {
        normalized.correct = false;
        normalized.score = 0;
        normalized.feedback = "No answer provided.";
      } else {
        if (typeof normalized.score !== "number") {
          const isExactMatch = studentAnswer.toLowerCase() === expectedAnswer.toLowerCase();
          normalized.score = isExactMatch ? maxPoints : 0;
        }

        if (typeof normalized.correct !== "boolean") {
          const numericScore = typeof normalized.score === "number" ? normalized.score : 0;
          normalized.correct = numericScore > 0;
        }
      }

      normalizedResults.push(normalized);
    });

    const usedIds = new Set<string>(normalizedResults.map((result, idx) => {
      const value = result.id;
      if (typeof value === "number" || typeof value === "string") {
        return String(value);
      }
      return String(idx + 1);
    }));

    rawResults.forEach((result) => {
      const candidateId = (result.id ?? result.questionId) as unknown;
      const key =
        typeof candidateId === "number" || typeof candidateId === "string"
          ? String(candidateId)
          : String(usedIds.size + 1);

      if (!usedIds.has(key)) {
        usedIds.add(key);
        const numericId = Number(key);
        normalizedResults.push({
          ...result,
          id: Number.isNaN(numericId) ? key : numericId,
        });
      }
    });

    const totalMax = normalizedResults.reduce((sum, result) => {
      if (typeof result.max === "number") {
        return sum + result.max;
      }
      return sum;
    }, 0);

    const totalScore = normalizedResults.reduce((sum, result) => {
      if (typeof result.score === "number") {
        return sum + result.score;
      }
      return sum;
    }, 0);

    const overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 10000) / 100 : 0;
    const existingTotalPoints =
      typeof (gradeData as { totalPoints?: unknown }).totalPoints === "number"
        ? (gradeData as { totalPoints: number }).totalPoints
        : undefined;

    const finalGrade: Record<string, unknown> = {
      ...gradeData,
      results: normalizedResults,
      totalPoints: totalMax || existingTotalPoints || 100,
      overallScore,
    };

    return finalGrade;
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

    const isBlankAnswer = !studentAnswer || studentAnswer.trim().length === 0;
    const userPrompt = isBlankAnswer 
      ? `Provide a helpful explanation for a question that was left blank:

QUESTION: ${JSON.stringify(question)}
EXPECTED ANSWER: ${expectedAnswer}
CONTEXT: ${context}

Explain what the correct answer should be and why it's important to know this concept.`
      : `Explain why this answer is wrong:

QUESTION: ${JSON.stringify(question)}
STUDENT ANSWER: ${studentAnswer}
EXPECTED ANSWER: ${expectedAnswer}
CONTEXT: ${context}

Be helpful and educational, not just corrective.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || "{}";
    const fallbackExplanation = {
      isCorrect: false,
      explanation: "Unable to generate explanation - please try again",
      correctApproach: "Please refer to documentation",
      commonMistake: "Various factors can cause errors",
      practiceExercise: "Try practicing similar problems",
      resources: ["MDN Web Docs", "W3Schools"],
    };

    return safeJsonParse(content, fallbackExplanation);
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.6,
    });

    const content = response.choices[0].message.content || "{}";
    const fallbackConcept = {
      concept: "Web Development Concept",
      explanation: "Unable to generate explanation - please try again",
      examples: ["Please refer to documentation"],
      useCase: "Various use cases apply",
      commonPitfalls: ["Check documentation for best practices"],
      nextSteps: "Continue learning and practicing",
    };

    return safeJsonParse(content, fallbackConcept);
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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    });

    const content = response.choices[0].message.content || "{}";
    const fallbackProgress = {
      performance: {
        accuracy: 50.0,
        totalQuestions: 0,
        correctAnswers: 0,
        improvementTrend: "stable",
        learningVelocity: 1.0,
      },
      difficulty: {
        current: "junior",
        recommended: "junior",
        reason: "Unable to analyze progress - please try again",
      },
      weakAreas: [],
      strongAreas: [],
      recommendations: {
        immediate: ["Try taking more tests"],
        shortTerm: ["Focus on fundamentals"],
        longTerm: ["Continue practicing"],
      },
    };

    return safeJsonParse(content, fallbackProgress);
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
      performance: {
        accuracy: 76.0,
        totalQuestions: 25,
        correctAnswers: 19,
        improvementTrend: "improving",
        learningVelocity: 1.3,
      },
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

// Direct MCP handler for internal use (avoids HTTP requests)
export async function handleMcpRequest(requestBody: Record<string, unknown>) {
  try {
    const { method, params, id } = requestBody;

    // Handle MCP initialization
    if (method === "initialize") {
      return {
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
      };
    }

    // Handle tool calls
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params as Record<
        string,
        unknown
      >;

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

      return {
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
      };
    }

    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: errorMessage,
      },
    };
  }
}
