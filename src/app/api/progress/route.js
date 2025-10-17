import { getAgentCoordinator } from "@/lib/agent-coordinator";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default";
    const timeframe = searchParams.get("timeframe") || "week";

    console.log("Progress stats API called with:", { userId, timeframe });

    // Get agent coordinator and get progress stats
    const coordinator = getAgentCoordinator();

    const response = await coordinator.getProgressStats(userId, timeframe);

    if (response.ok) {
      console.log("✅ Progress stats retrieved successfully");
      return NextResponse.json(response);
    } else {
      console.error("❌ Progress stats failed:", response.error);
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("Progress stats API error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const {
      testResults,
      currentDifficulty = "junior",
      subject = "general",
      userId = "default",
    } = await request.json();

    console.log("Progress tracking API called with:", {
      resultCount: testResults?.length || 0,
      currentDifficulty,
      subject,
      userId,
    });

    if (!testResults || !Array.isArray(testResults)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Test results are required",
        },
        { status: 400 }
      );
    }

    // Get agent coordinator and track progress
    const coordinator = getAgentCoordinator();

    const response = await coordinator.trackLearningProgress(
      testResults,
      currentDifficulty,
      subject,
      userId
    );

    if (response.ok) {
      console.log("✅ Progress tracking successful");
      return NextResponse.json(response);
    } else {
      console.error("❌ Progress tracking failed:", response.error);
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("Progress API error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
