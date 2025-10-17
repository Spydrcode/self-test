import { NextRequest, NextResponse } from "next/server";
import { handleMcpRequest } from "../../../lib/mcp-handler";

export async function POST(request: NextRequest) {
  try {
    console.log("MCP API endpoint hit");
    const body = await request.json();
    console.log("MCP request body:", JSON.stringify(body, null, 2));

    const result = await handleMcpRequest(body);
    return NextResponse.json(result);
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
