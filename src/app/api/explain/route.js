import { getAgentCoordinator } from "@/lib/agent-coordinator";
import { NextResponse } from "next/server";

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

    // Use the dedicated Answer Explanation Agent for incorrect answers
    // This provides more detailed pedagogical explanations
    const response = await coordinator.explainWrongAnswer(
      question,
      studentAnswer,
      expectedAnswer,
      explanationContext
    );

    if (response.ok) {
      console.log("✅ Answer explanation generated successfully");
      return NextResponse.json(response);
    } else {
      console.error("❌ Answer explanation failed:", response.error);
      
      // Try general concept explanation if specific explanation fails
      const fallbackResponse = await coordinator.explainWebConcept(
        question.prompt,
        explanationContext
      );
      
      if (fallbackResponse.ok) {
        return NextResponse.json(fallbackResponse);
      } else {
        return NextResponse.json(response);
      }
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