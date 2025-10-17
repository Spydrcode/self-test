import { NextResponse } from "next/server";
import { getAgentCoordinator } from "../../../lib/agent-coordinator.js";

export async function POST(request) {
  try {
    // Parse request body
    const {
      question,
      studentAnswer,
      expectedAnswer,
      context,
    } = await request.json();

    console.log("Explain API called for question ID:", question?.id);

    if (!question || !studentAnswer || !expectedAnswer) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing required fields: question, studentAnswer, expectedAnswer",
        },
        { status: 400 }
      );
    }

    // Determine context from question category if not provided
    const explanationContext = context || question.category || "general";

    // Get agent coordinator and use specialized explanations
    const coordinator = getAgentCoordinator();

    try {
      // Use the dedicated Answer Explanation Agent for incorrect answers
      // This provides more detailed pedagogical explanations
      const response = await coordinator.explainWrongAnswer(
        question,
        studentAnswer,
        expectedAnswer,
        {
          category: explanationContext,
          difficulty: "junior", // Default to junior level
          context: {
            questionType: question.type,
            points: question.points,
            framework: question.framework || "vanilla",
          },
        }
      );

      if (response.ok) {
        console.log(
          "Successfully generated detailed answer explanation with educational focus"
        );
        return NextResponse.json(response);
      } else {
        console.error("Answer explanation agent error:", response.error);

        // Fallback to general concept explanation
        console.log("Falling back to general concept explanation...");
        const fallbackResponse = await coordinator.explainWebConcept(
          question,
          studentAnswer,
          expectedAnswer,
          explanationContext
        );

        return NextResponse.json(fallbackResponse);
      }
    } catch (agentError) {
      console.error(
        "MCP Agents failed, falling back to direct OpenAI:",
        agentError
      );

      // Fallback to original explanation method if agents fail
      return await fallbackExplanation(question, studentAnswer, expectedAnswer);
    }
  } catch (error) {
    console.error("Explain API error:", error);
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
async function fallbackExplanation(question, studentAnswer, expectedAnswer) {
  const { chat } = await import("../../../lib/openai.js");

  const systemPrompt = `You are a web development mentor for junior developers. RETURN JSON only:
{ "brief":"encouraging assessment", "explanation":"step-by-step breakdown", "commonMistakes":["typical junior dev mistakes"], "correction":"correct approach with examples", "conceptReview":{"keyPoints":["..."],"examples":["..."],"bestPractices":["..."]}, "nextSteps":{"practice":"...","resources":"...","buildsOn":"..."} }`;

  const questionData = JSON.stringify(question);
  const userPrompt = `Help a junior web developer understand their mistake. Question: ${questionData} StudentAnswer: ${studentAnswer} ExpectedAnswer: ${expectedAnswer} Focus on learning and growth.`;

  try {
    const output = await chat(systemPrompt, userPrompt, {
      maxTokens: 1000,
      temperature: 0.3,
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
