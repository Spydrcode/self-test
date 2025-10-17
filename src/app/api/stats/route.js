import { getAgentCoordinator } from "@/lib/agent-coordinator";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default";
    const timeframe = searchParams.get("timeframe") || "week";

    console.log("Stats API called with:", { userId, timeframe });

    // Get agent coordinator and fetch stats
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
    console.error("Stats API error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
