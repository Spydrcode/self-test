import { NextResponse } from "next/server";
import { getAgentCoordinator } from "../../../lib/agent-coordinator.js";

export async function POST(request) {
  try {
    // Parse request body
    const {
      topics = ["javascript", "html"],
      numQuestions = 5,
      difficulty = "junior",
      focusTopics = [],
      framework = "vanilla",
    } = await request.json();

    console.log("Generate API called with:", {
      topics,
      numQuestions,
      difficulty,
      focusTopics,
      framework,
    });

    // Get agent coordinator and generate specialized web development test
    const coordinator = getAgentCoordinator();

    try {
      const response = await coordinator.generateWebDevTest({
        topics,
        numQuestions,
        difficulty,
        focusTopics,
        framework,
      });

      if (response.ok) {
        console.log(
          "Successfully generated web dev test with",
          response.result?.questions?.length || 0,
          "questions"
        );

        return NextResponse.json(response);
      } else {
        console.error("Agent generation error:", response.error);
        return NextResponse.json(response);
      }
    } catch (agentError) {
      console.error(
        "MCP Agent failed, falling back to direct OpenAI:",
        agentError
      );

      // Fallback to original OpenAI method if agents fail
      return await fallbackGeneration(
        topics,
        numQuestions,
        difficulty,
        focusTopics
      );
    }
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Fallback function using original OpenAI approach
async function fallbackGeneration(
  topics,
  numQuestions,
  difficulty,
  focusTopics
) {
  const { chat } = await import("../../../lib/openai.js");

  const systemPrompt = `You are a web development test writer specializing in junior-level content. Create UNIQUE, VARIED questions each time.

OUTPUT JSON only:
{ "questions":[{"id":1,"type":"mcq"|"short"|"code","prompt":"...","choices":[...],"answer":"...","rubric":["..."],"points":<int>,"category":"html|css|javascript|api|framework"}],"totalPoints":100 }

VARIETY RULES:
- Use different real-world scenarios each time
- Vary question complexity and formats
- Include workplace-relevant contexts
- Test different aspects of each topic
- Avoid generic/textbook examples`;

  const topicsText = topics.length > 0 ? topics.join(", ") : "javascript, html";
  const focusText =
    focusTopics.length > 0 ? ` Focus on: ${focusTopics.join(", ")}.` : "";

  // Add randomness to ensure variety
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

  try {
    const output = await chat(systemPrompt, userPrompt, {
      maxTokens: 2000,
      temperature: 0.6, // Increased for more variety
    });

    const result = JSON.parse(output);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: "ParseError",
      raw: output,
    });
  }
}
