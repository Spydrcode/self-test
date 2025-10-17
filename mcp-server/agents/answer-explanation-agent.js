/**
 * Answer Explanation Agent - Specialized Educational Explanations
 * Dedicated agent for providing detailed, pedagogical explanations when answers are wrong
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AnswerExplanationAgent {
  constructor() {
    this.explanationStrategies = {
      javascript: {
        syntaxError:
          "Break down the syntax rule that was violated and show correct syntax",
        logicError:
          "Walk through the logic step-by-step and identify where reasoning went wrong",
        conceptualError: "Explain the underlying concept and provide analogies",
        bestPractice:
          "Show why the alternative approach is better with examples",
      },
      html: {
        semanticError:
          "Explain semantic meaning and why correct elements matter",
        structureError: "Show proper HTML document structure and hierarchy",
        accessibilityError:
          "Explain accessibility impact and provide inclusive alternatives",
        validationError: "Break down HTML validation rules and requirements",
      },
      css: {
        selectorError: "Explain CSS selector specificity and targeting rules",
        layoutError: "Visualize box model and layout behavior differences",
        responsiveError:
          "Show how design breaks and provide mobile-first solutions",
        performanceError:
          "Explain rendering impact and optimization techniques",
      },
      api: {
        httpError: "Explain HTTP fundamentals and status code meanings",
        asyncError: "Walk through async flow and error handling patterns",
        securityError: "Highlight security implications and safe practices",
        dataError: "Show proper data handling and validation techniques",
      },
      frameworks: {
        reactError:
          "Explain React concepts like components, state, and lifecycle",
        vueError: "Break down Vue reactivity and template syntax",
        angularError:
          "Explain Angular concepts like services and dependency injection",
      },
    };

    this.commonMistakePatterns = {
      javascript: [
        {
          pattern: /==(?!=)/,
          explanation: "Using == instead of === can cause type coercion issues",
        },
        {
          pattern: /var\s+/,
          explanation:
            "Using 'var' instead of 'let'/'const' can cause scoping issues",
        },
        {
          pattern: /function.*\{[\s\S]*\}(?!\s*\()/,
          explanation: "Function declaration vs expression differences",
        },
        {
          pattern: /\.innerHTML\s*=/,
          explanation:
            "innerHTML can be unsafe, consider textContent or safer alternatives",
        },
      ],
      html: [
        {
          pattern: /<div[^>]*>.*<\/div>/,
          explanation:
            "Consider if a semantic element would be more appropriate than div",
        },
        {
          pattern: /<img(?![^>]*alt=)/,
          explanation: "Images need alt attributes for accessibility",
        },
        {
          pattern: /<[^>]*onclick=/,
          explanation:
            "Inline event handlers should be avoided, use addEventListener",
        },
      ],
      css: [
        {
          pattern: /!important/,
          explanation:
            "!important should be avoided, use better specificity instead",
        },
        {
          pattern: /position:\s*absolute/,
          explanation: "Absolute positioning can break responsive design",
        },
        {
          pattern: /float:\s*(left|right)/,
          explanation:
            "Modern layout methods like flexbox/grid are preferred over float",
        },
      ],
    };

    this.learningLevels = {
      beginner: {
        approach: "Start with basics, use simple analogies, avoid jargon",
        exampleDepth: "Show complete examples with step-by-step breakdown",
        conceptLinks: "Connect to familiar real-world concepts",
      },
      junior: {
        approach:
          "Focus on practical application, explain 'why' not just 'how'",
        exampleDepth: "Show working examples with variations and edge cases",
        conceptLinks: "Connect to other programming concepts they might know",
      },
      intermediate: {
        approach:
          "Discuss trade-offs, performance implications, and alternatives",
        exampleDepth: "Show advanced patterns and optimization techniques",
        conceptLinks: "Connect to system design and architecture principles",
      },
    };
  }

  async explainWrongAnswer(args) {
    const {
      question,
      studentAnswer,
      correctAnswer,
      category = "general",
      difficulty = "junior",
      context = {},
    } = args;

    if (!question || !studentAnswer || !correctAnswer) {
      throw new Error("Missing required parameters for answer explanation");
    }

    // Analyze the type of mistake
    const mistakeAnalysis = this.analyzeMistake(
      question,
      studentAnswer,
      correctAnswer,
      category
    );

    // Build specialized explanation prompt
    const systemPrompt = this.buildExplanationSystemPrompt(
      category,
      difficulty,
      mistakeAnalysis
    );
    const userPrompt = this.buildExplanationUserPrompt(
      question,
      studentAnswer,
      correctAnswer,
      mistakeAnalysis,
      context
    );

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3, // Balanced for educational clarity
      });

      const content = response.choices[0]?.message?.content?.trim();

      try {
        const result = JSON.parse(content);
        const enhancedResult = this.enhanceExplanation(
          result,
          mistakeAnalysis,
          category,
          difficulty
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                result: enhancedResult,
              }),
            },
          ],
        };
      } catch (parseError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                error: "ParseError",
                raw: content,
              }),
            },
          ],
        };
      }
    } catch (error) {
      throw new Error(`Answer explanation failed: ${error.message}`);
    }
  }

  analyzeMistake(question, studentAnswer, correctAnswer, category) {
    const analysis = {
      category,
      mistakeType: "conceptual", // default
      severity: "medium",
      patterns: [],
      concepts: [],
    };

    // Detect common mistake patterns
    const patterns = this.commonMistakePatterns[category] || [];
    patterns.forEach(({ pattern, explanation }) => {
      if (pattern.test(studentAnswer)) {
        analysis.patterns.push({ pattern: pattern.toString(), explanation });
      }
    });

    // Analyze mistake severity
    const similarity = this.calculateSimilarity(
      studentAnswer.toLowerCase(),
      correctAnswer.toLowerCase()
    );
    if (similarity > 0.7) {
      analysis.severity = "minor"; // Close to correct
    } else if (similarity < 0.3) {
      analysis.severity = "major"; // Very different
    }

    // Determine mistake type based on question and answer
    if (
      question.type === "code" ||
      studentAnswer.includes("{") ||
      studentAnswer.includes("function")
    ) {
      analysis.mistakeType = "syntaxError";
    } else if (
      question.prompt.toLowerCase().includes("why") ||
      question.prompt.toLowerCase().includes("explain")
    ) {
      analysis.mistakeType = "conceptualError";
    } else if (
      question.prompt.toLowerCase().includes("best") ||
      question.prompt.toLowerCase().includes("should")
    ) {
      analysis.mistakeType = "bestPractice";
    }

    // Extract key concepts from the question
    analysis.concepts = this.extractKeyConcepts(question.prompt, category);

    return analysis;
  }

  buildExplanationSystemPrompt(category, difficulty, mistakeAnalysis) {
    const levelConfig =
      this.learningLevels[difficulty] || this.learningLevels.junior;
    const strategy =
      this.explanationStrategies[category]?.[mistakeAnalysis.mistakeType] ||
      "Provide clear step-by-step explanation";

    return `You are a patient, expert web development educator specializing in helping students understand their mistakes.

STUDENT LEVEL: ${difficulty} (${levelConfig.approach})
CATEGORY: ${category}
MISTAKE TYPE: ${mistakeAnalysis.mistakeType}
SEVERITY: ${mistakeAnalysis.severity}

EXPLANATION STRATEGY: ${strategy}

OUTPUT JSON FORMAT:
{
  "diagnosis": {
    "mistakeType": "${mistakeAnalysis.mistakeType}",
    "severity": "${mistakeAnalysis.severity}",
    "rootCause": "What fundamental misunderstanding caused this mistake"
  },
  "stepByStepExplanation": {
    "whatWentWrong": "Clear description of the specific error",
    "whyItsWrong": "Explain the underlying reason this doesn't work",
    "correctApproach": "Step-by-step walkthrough of the right way",
    "keyInsight": "The main learning point to remember"
  },
  "visualBreakdown": {
    "studentThinking": "What the student was probably thinking",
    "correctThinking": "How to think about this correctly",
    "comparisonTable": [
      {"aspect": "...", "student": "...", "correct": "...", "impact": "..."}
    ]
  },
  "practiceExercises": [
    {
      "description": "Simple exercise to reinforce the concept",
      "example": "Concrete example to try",
      "expectedOutcome": "What they should learn from this"
    }
  ],
  "prevention": {
    "warningSigns": ["How to spot this mistake in the future"],
    "mentalChecklist": ["Questions to ask themselves before submitting"],
    "debuggingTips": ["How to debug similar issues"]
  },
  "connectionsToBiggerPicture": {
    "relatedConcepts": ["How this connects to other topics"],
    "realWorldRelevance": "Why this matters in actual development",
    "nextLearningSteps": "What to study next to build on this"
  }
}

TEACHING PRINCIPLES:
- Start with empathy and validation ("This is a common mistake...")
- Use analogies and real-world examples
- Show, don't just tell (provide code examples)
- Connect to concepts they already understand
- Build confidence while correcting misconceptions
- Focus on understanding, not memorization
- Make it practically relevant to their development goals`;
  }

  buildExplanationUserPrompt(
    question,
    studentAnswer,
    correctAnswer,
    mistakeAnalysis,
    context
  ) {
    return `Help this student understand their mistake in a supportive, educational way.

QUESTION:
${JSON.stringify(question, null, 2)}

STUDENT'S ANSWER:
"${studentAnswer}"

CORRECT ANSWER:
"${correctAnswer}"

MISTAKE ANALYSIS:
- Type: ${mistakeAnalysis.mistakeType}
- Severity: ${mistakeAnalysis.severity}
- Detected patterns: ${mistakeAnalysis.patterns
      .map((p) => p.explanation)
      .join(", ") || "None"}
- Key concepts: ${mistakeAnalysis.concepts.join(", ") || "General"}

CONTEXT:
${JSON.stringify(context, null, 2)}

EXPLANATION REQUIREMENTS:
1. Start by acknowledging what they got right (if anything)
2. Gently explain what went wrong and why
3. Provide a clear, step-by-step explanation of the correct approach
4. Use specific examples relevant to junior web developers
5. Include practical tips to avoid this mistake in the future
6. Connect to real-world development scenarios
7. Suggest concrete next steps for learning

Remember: This student is learning. Be encouraging, clear, and focus on building understanding rather than just providing the right answer.`;
  }

  enhanceExplanation(result, mistakeAnalysis, category, difficulty) {
    // Add category-specific resources
    result.additionalResources = this.getCategoryResources(category);

    // Add interactive elements suggestions
    result.interactiveElements = this.suggestInteractiveElements(
      category,
      mistakeAnalysis.mistakeType
    );

    // Add confidence building elements
    result.encouragement = this.generateEncouragement(
      mistakeAnalysis.severity,
      difficulty
    );

    // Add code examples if applicable
    if (
      category === "javascript" ||
      category === "html" ||
      category === "css"
    ) {
      result.codeExamples = this.generateCodeExamples(
        category,
        mistakeAnalysis.concepts
      );
    }

    // Add metadata for tracking
    result.metadata = {
      category,
      difficulty,
      mistakeType: mistakeAnalysis.mistakeType,
      severity: mistakeAnalysis.severity,
      generatedAt: new Date().toISOString(),
      agent: "AnswerExplanationAgent",
    };

    return result;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  extractKeyConcepts(prompt, category) {
    const conceptKeywords = {
      javascript: [
        "function",
        "variable",
        "array",
        "object",
        "loop",
        "async",
        "promise",
        "event",
        "dom",
      ],
      html: [
        "element",
        "tag",
        "attribute",
        "semantic",
        "form",
        "accessibility",
        "structure",
      ],
      css: [
        "selector",
        "property",
        "layout",
        "flexbox",
        "grid",
        "responsive",
        "media query",
      ],
      api: [
        "http",
        "rest",
        "request",
        "response",
        "status",
        "json",
        "fetch",
        "endpoint",
      ],
    };

    const keywords = conceptKeywords[category] || [];
    return keywords.filter((keyword) => prompt.toLowerCase().includes(keyword));
  }

  getCategoryResources(category) {
    const resources = {
      javascript: [
        "MDN JavaScript Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        "JavaScript.info: https://javascript.info/",
        "Eloquent JavaScript: https://eloquentjavascript.net/",
      ],
      html: [
        "MDN HTML Guide: https://developer.mozilla.org/en-US/docs/Web/HTML",
        "HTML5 Semantic Elements: https://www.w3schools.com/html/html5_semantic_elements.asp",
        "WebAIM Accessibility: https://webaim.org/",
      ],
      css: [
        "CSS-Tricks: https://css-tricks.com/",
        "Flexbox Froggy: https://flexboxfroggy.com/",
        "CSS Grid Garden: https://cssgridgarden.com/",
      ],
      api: [
        "RESTful API Tutorial: https://restfulapi.net/",
        "Fetch API Guide: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API",
        "HTTP Status Codes: https://httpstatuses.com/",
      ],
    };

    return resources[category] || [];
  }

  suggestInteractiveElements(category, mistakeType) {
    const suggestions = {
      javascript: [
        "Try this in browser console",
        "Use debugger to step through code",
        "Create a CodePen to experiment",
      ],
      html: [
        "Validate HTML at validator.w3.org",
        "Use browser DevTools to inspect elements",
        "Test with screen readers",
      ],
      css: [
        "Experiment in browser DevTools",
        "Use CSS Grid/Flexbox playground tools",
        "Test responsive design with device emulation",
      ],
    };

    return suggestions[category] || ["Practice with hands-on coding exercises"];
  }

  generateEncouragement(severity, difficulty) {
    const encouragements = {
      minor: [
        "You're very close! This is a common detail that trips up many developers.",
        "Great thinking! Just a small adjustment needed.",
        "Almost there! This kind of attention to detail comes with practice.",
      ],
      medium: [
        "Good effort! This concept takes time to master.",
        "You're on the right track. Let's clarify this concept step by step.",
        "This is a learning opportunity - many developers struggle with this initially.",
      ],
      major: [
        "Don't worry - this is a complex topic that requires practice.",
        "This is a challenging concept. Let's break it down together.",
        "Every developer goes through this learning curve. You're making progress!",
      ],
    };

    const messages = encouragements[severity] || encouragements.medium;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  generateCodeExamples(category, concepts) {
    // This would generate relevant code examples based on the category and concepts
    // For now, returning a placeholder structure
    return {
      wrongExample: "// Example of the mistake",
      correctExample: "// Example of the correct approach",
      explanation: "// Why the correct example works better",
    };
  }
}
