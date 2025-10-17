import { getAgentCoordinator } from "@/lib/agent-coordinator";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    console.log("Generate API route called");

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
    console.log("Agent coordinator obtained");

    const response = await coordinator.generateWebDevTest({
      topics,
      numQuestions,
      difficulty,
      focusTopics,
      framework,
    });

    console.log("Generate response received:", response);

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
  } catch (error) {
    console.error("Generate API error:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
