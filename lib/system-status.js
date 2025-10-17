/**
 * System Status Checker for MCP Agents
 * Validates that all components are properly configured
 */

export async function checkSystemStatus() {
  const status = {
    nextjs: false,
    openaiKey: false,
    mcpAgents: false,
    dependencies: false,
    overall: false,
  };

  try {
    // Check Next.js environment
    status.nextjs =
      typeof window !== "undefined" || process.env.NODE_ENV !== undefined;

    // Check OpenAI API key
    status.openaiKey =
      !!process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== "your_openai_api_key_here";

    // Check MCP dependencies
    try {
      await import("@modelcontextprotocol/sdk");
      status.dependencies = true;
    } catch {
      status.dependencies = false;
    }

    // Check if MCP server can be reached (this would need to be implemented)
    status.mcpAgents = status.dependencies; // Simplified for now

    status.overall = status.nextjs && status.openaiKey && status.dependencies;

    return status;
  } catch (error) {
    console.error("System status check failed:", error);
    return status;
  }
}

export function getSystemInfo() {
  return {
    features: [
      "🎯 Junior Web Developer Focus (6 months - 2 years experience)",
      "🤖 Specialized AI Agents for Test Generation, Grading & Explanations",
      "💻 HTML, CSS, JavaScript, React, Vue, Angular Support",
      "🔍 Advanced Code Analysis & Best Practice Assessment",
      "📚 Contextual Learning Resources & Study Plans",
      "🚀 Automatic Focus Topic Detection & Regeneration",
      "🏆 Detailed Performance Analytics by Category",
      "♿ Accessibility & Security Awareness Testing",
    ],
    agents: {
      testGenerator: {
        name: "Test Generator Agent",
        specialization: "Junior-level web development question creation",
        capabilities: [
          "Framework-specific questions",
          "Code debugging scenarios",
          "Real-world problems",
        ],
      },
      testChecker: {
        name: "Test Checker Agent",
        specialization: "Advanced grading with partial credit",
        capabilities: [
          "Code quality assessment",
          "Best practices evaluation",
          "Learning analytics",
        ],
      },
      utility: {
        name: "Utility Agent",
        specialization: "Learning support and explanations",
        capabilities: [
          "Contextual explanations",
          "Code validation",
          "Study plan generation",
        ],
      },
    },
    techStack: [
      "Next.js 15 with App Router & TypeScript",
      "OpenAI GPT-4 for AI capabilities",
      "Model Context Protocol (MCP) for agent coordination",
      "Tailwind CSS for responsive UI",
      "Local storage for session persistence",
      "Node.js MCP server with specialized agents",
    ],
  };
}
