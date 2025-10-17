import { getAgentCoordinator } from "@/lib/agent-coordinator";
import { NextResponse } from "next/server";

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

    const response = await coordinator.gradeWebDevTest(test, answers, {
      strictness,
    });

    if (response.ok) {
      const totalScore = response.result.overallScore;
      console.log(`Successfully graded web dev test, total score: ${totalScore}%`);

      return NextResponse.json(response);
    } else {
      console.error("Agent grading error:", response.error);
      return NextResponse.json(response);
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