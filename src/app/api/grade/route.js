import { NextResponse } from "next/server";
import { getAgentCoordinator } from "../../../lib/agent-coordinator.js";

export async function POST(request) {
  try {
    // Parse request body
    const { test, answers, strictness = "standard" } = await request.json();

    console.log(
      "Grade API called with test ID count:",
      test.result?.questions?.length || 0
    );
    console.log("Answers provided:", Object.keys(answers || {}).length);

    if (!test || !test.result || !test.result.questions || !answers) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: test and answers",
        },
        { status: 400 }
      );
    }

    // Get agent coordinator and use specialized web development grading
    const coordinator = getAgentCoordinator();

    try {
      const response = await coordinator.gradeWebDevTest(test, answers, {
        strictness,
      });

      if (response.ok) {
        console.log(
          "Successfully graded web dev test, total score:",
          response.result?.totalScorePercent + "%"
        );

        return NextResponse.json(response);
      } else {
        console.error("Agent grading error:", response.error);
        return NextResponse.json(response);
      }
    } catch (agentError) {
      console.error(
        "MCP Agent failed, falling back to direct OpenAI:",
        agentError
      );

      // Fallback to original grading method if agents fail
      return await fallbackGrading(test, answers);
    }
  } catch (error) {
    console.error("Grade API error:", error);
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
async function fallbackGrading(test, answers) {
  const { chat } = await import("../../../lib/openai.js");

  const systemPrompt = `You are a web development grader specializing in junior-level assessment. RETURN JSON only:
{ "results":[{"id":1,"score":<int>,"max":<int>,"feedback":"short text","correct":true|false,"expected":"...","category":"html|css|javascript|api|framework"}],"totalScorePercent":<float>,"totalPoints":<int>,"earnedPoints":<int> }`;

  const testData = JSON.stringify(test.result);
  const answersData = JSON.stringify(answers);

  const userPrompt = `Grade this junior web developer test with partial credit. Test: ${testData} StudentAnswers: ${answersData} Focus on practical understanding and best practices.`;

  try {
    const output = await chat(systemPrompt, userPrompt, {
      maxTokens: 1200,
      temperature: 0.1,
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
