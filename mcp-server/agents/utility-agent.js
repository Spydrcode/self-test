/**
 * Utility Agent - Support Functions for Test Trainer
 * Handles explanations, focus topic derivation, code validation, and other utilities
 */

import OpenAI from "openai";

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export class UtilityAgent {
  constructor() {
    this.contextualExplanations = {
      javascript: {
        beginnerConcepts: [
          "Variables store data values",
          "Functions are reusable blocks of code",
          "Objects contain key-value pairs",
          "Arrays store ordered lists",
          "Loops repeat code execution",
        ],
        commonPatterns: [
          "Event handling with addEventListener",
          "DOM manipulation with querySelector",
          "Async operations with fetch",
          "Error handling with try/catch",
          "Array methods like map, filter, reduce",
        ],
      },
      html: {
        semanticElements: [
          "header",
          "nav",
          "main",
          "section",
          "article",
          "aside",
          "footer",
        ],
        formElements: [
          "input",
          "select",
          "textarea",
          "button",
          "fieldset",
          "legend",
        ],
        accessibility: [
          "alt attributes",
          "semantic markup",
          "ARIA labels",
          "keyboard navigation",
        ],
      },
      css: {
        layoutMethods: ["Flexbox", "CSS Grid", "Positioning", "Float (legacy)"],
        responsiveDesign: [
          "Media queries",
          "Mobile-first approach",
          "Flexible units",
          "Viewport meta tag",
        ],
        bestPractices: [
          "BEM methodology",
          "CSS custom properties",
          "Avoid !important",
          "Efficient selectors",
        ],
      },
      api: {
        httpMethods: [
          "GET (retrieve)",
          "POST (create)",
          "PUT (update)",
          "DELETE (remove)",
        ],
        statusCodes: [
          "200 OK",
          "201 Created",
          "400 Bad Request",
          "401 Unauthorized",
          "404 Not Found",
          "500 Server Error",
        ],
        concepts: [
          "REST principles",
          "JSON format",
          "Authentication",
          "CORS",
          "Rate limiting",
        ],
      },
    };

    this.learningResources = {
      javascript: [
        "MDN JavaScript Guide",
        "JavaScript.info tutorial",
        "Eloquent JavaScript book",
        "freeCodeCamp JavaScript course",
      ],
      html: [
        "MDN HTML documentation",
        "W3C HTML specifications",
        "WebAIM accessibility guidelines",
        "HTML5 semantic elements guide",
      ],
      css: [
        "CSS-Tricks flexbox guide",
        "MDN CSS Grid documentation",
        "A Complete Guide to CSS Grid",
        "Responsive design fundamentals",
      ],
      frameworks: {
        react: [
          "Official React documentation",
          "React Tutorial for Beginners",
          "Create React App",
          "React Hooks guide",
        ],
        vue: [
          "Vue.js Guide",
          "Vue CLI documentation",
          "Vue 3 Composition API",
          "Vue Router basics",
        ],
        angular: [
          "Angular Tutorial",
          "Angular CLI",
          "Angular Components guide",
          "Angular Services",
        ],
      },
    };
  }

  async explainConcept(args) {
    const {
      question,
      studentAnswer,
      expectedAnswer,
      context = "general",
    } = args;

    if (!question || !studentAnswer || !expectedAnswer) {
      throw new Error("Missing required explanation parameters");
    }

    const systemPrompt = this.buildExplanationPrompt(context);
    const userPrompt = this.buildExplanationRequest(
      question,
      studentAnswer,
      expectedAnswer,
      context
    );

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3, // Slightly higher for more natural explanations
      });

      const content = response.choices[0]?.message?.content?.trim();

      try {
        const result = JSON.parse(content);
        const enhancedResult = this.enhanceExplanation(
          result,
          context,
          question
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
      throw new Error(`Explanation generation failed: ${error.message}`);
    }
  }

  async deriveFocusTopics(args) {
    const { missedQuestions, gradeResults } = args;

    if (!missedQuestions || !gradeResults) {
      throw new Error("Missing required parameters for focus topic derivation");
    }

    // Analyze missed questions and derive intelligent focus topics
    const topicAnalysis = this.analyzeMissedConcepts(
      missedQuestions,
      gradeResults
    );
    const prioritizedTopics = this.prioritizeTopics(topicAnalysis);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            result: {
              focusTopics: prioritizedTopics.slice(0, 3), // Top 3 priority topics
              detailedAnalysis: topicAnalysis,
              recommendations: this.generateRecommendations(topicAnalysis),
              studyPlan: this.createStudyPlan(prioritizedTopics),
            },
          }),
        },
      ],
    };
  }

  async validateCode(args) {
    const { code, language, context = "" } = args;

    if (!code || !language) {
      throw new Error("Missing required parameters for code validation");
    }

    const validation = await this.performCodeValidation(
      code,
      language,
      context
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            result: validation,
          }),
        },
      ],
    };
  }

  buildExplanationPrompt(context) {
    return `You are a patient, expert web development mentor specializing in helping junior developers understand concepts.

CONTEXT: ${context} development for junior developers (6 months - 2 years experience)

EXPLANATION STYLE:
- Clear, encouraging, and educational
- Start with what they did right
- Explain the concept step-by-step
- Use practical examples
- Connect to real-world scenarios
- Provide actionable next steps

OUTPUT FORMAT - JSON only:
{
  "brief": "One-line encouraging assessment",
  "explanation": "Step-by-step breakdown of the concept and what went wrong/right",
  "commonMistakes": [
    "Typical mistakes junior developers make in this area",
    "Why these mistakes happen",
    "How to avoid them"
  ],
  "correction": "Clear, correct solution with explanation",
  "conceptReview": {
    "keyPoints": ["Important concepts to remember"],
    "examples": ["Practical code examples if relevant"],
    "bestPractices": ["Industry best practices for this topic"]
  },
  "nextSteps": {
    "practice": "Specific practice exercises",
    "resources": "Recommended learning materials", 
    "buildsOn": "How this connects to other concepts"
  }
}

GUIDELINES:
- Be encouraging and supportive
- Focus on learning and growth
- Provide practical, actionable advice
- Use code examples when helpful
- Connect concepts to bigger picture
- Suggest concrete next steps`;
  }

  buildExplanationRequest(question, studentAnswer, expectedAnswer, context) {
    return `Explain this web development concept to a junior developer who got it partially wrong.

QUESTION DETAILS:
${JSON.stringify(question, null, 2)}

STUDENT'S ANSWER:
"${studentAnswer}"

EXPECTED ANSWER:
"${expectedAnswer}"

CONTEXT: ${context}

ANALYSIS NEEDED:
1. What did the student understand correctly?
2. Where did their understanding break down?
3. What concept needs clarification?
4. How can they improve their approach?
5. What should they practice next?

Make the explanation educational and encouraging, focusing on helping them understand the underlying concept rather than just getting the "right" answer.`;
  }

  enhanceExplanation(result, context, question) {
    // Add contextual learning resources
    result.learningResources = this.getLearningResources(context);

    // Add related concepts
    result.relatedConcepts = this.getRelatedConcepts(context, question);

    // Add difficulty progression
    result.progressionPath = this.getProgressionPath(context);

    return result;
  }

  analyzeMissedConcepts(missedQuestions, gradeResults) {
    const conceptMap = {};
    const categoryScores = {};

    missedQuestions.forEach((question, index) => {
      const gradeResult = gradeResults[index];
      if (gradeResult && gradeResult.score < gradeResult.max * 0.7) {
        const category = question.category || "general";
        const topics = this.extractTopicsFromQuestion(question);

        if (!conceptMap[category]) {
          conceptMap[category] = { topics: [], totalMissed: 0, questions: [] };
        }

        conceptMap[category].topics.push(...topics);
        conceptMap[category].totalMissed++;
        conceptMap[category].questions.push({
          id: question.id,
          prompt: question.prompt.substring(0, 100) + "...",
          scorePercent: (gradeResult.score / gradeResult.max) * 100,
        });

        categoryScores[category] =
          (categoryScores[category] || 0) + gradeResult.score / gradeResult.max;
      }
    });

    // Calculate averages and prioritize
    Object.keys(categoryScores).forEach((category) => {
      categoryScores[category] =
        categoryScores[category] / conceptMap[category].totalMissed;
    });

    return { conceptMap, categoryScores };
  }

  extractTopicsFromQuestion(question) {
    const topics = [];
    const prompt = question.prompt.toLowerCase();

    // Extract topics based on keywords in the question
    const topicKeywords = {
      function: "functions",
      variable: "variables",
      array: "arrays",
      object: "objects",
      dom: "DOM manipulation",
      event: "event handling",
      async: "asynchronous programming",
      fetch: "API calls",
      html: "HTML structure",
      css: "CSS styling",
      semantic: "semantic HTML",
      responsive: "responsive design",
    };

    Object.entries(topicKeywords).forEach(([keyword, topic]) => {
      if (prompt.includes(keyword)) {
        topics.push(topic);
      }
    });

    return topics.length > 0
      ? topics
      : [question.category || "general concept"];
  }

  prioritizeTopics(analysis) {
    const { conceptMap, categoryScores } = analysis;

    // Create priority score based on frequency and severity
    const priorityMap = [];

    Object.entries(conceptMap).forEach(([category, data]) => {
      const frequency = data.totalMissed;
      const avgScore = categoryScores[category] || 0;
      const severity = 1 - avgScore; // Lower scores = higher severity

      const priorityScore = frequency * severity;

      data.topics.forEach((topic) => {
        priorityMap.push({
          topic,
          category,
          priority: priorityScore,
          frequency,
          avgScore: avgScore * 100,
        });
      });
    });

    // Sort by priority and remove duplicates
    const uniqueTopics = new Map();
    priorityMap.sort((a, b) => b.priority - a.priority).forEach((item) => {
      if (!uniqueTopics.has(item.topic)) {
        uniqueTopics.set(item.topic, item);
      }
    });

    return Array.from(uniqueTopics.values()).map((item) => item.topic);
  }

  generateRecommendations(analysis) {
    const { conceptMap } = analysis;
    const recommendations = [];

    Object.entries(conceptMap).forEach(([category, data]) => {
      if (data.totalMissed > 0) {
        recommendations.push({
          category,
          suggestion: `Focus on ${category} fundamentals`,
          specificAreas: data.topics.slice(0, 3),
          studyTime: `${Math.min(data.totalMissed * 15, 60)} minutes`,
          resources: this.learningResources[category] || [],
        });
      }
    });

    return recommendations;
  }

  createStudyPlan(prioritizedTopics) {
    return prioritizedTopics.slice(0, 5).map((topic, index) => ({
      day: index + 1,
      topic,
      activities: [
        `Review ${topic} documentation`,
        `Complete 3-5 practice exercises`,
        `Build a small project using ${topic}`,
        `Take a short quiz on ${topic}`,
      ],
      estimatedTime: "30-45 minutes",
    }));
  }

  async performCodeValidation(code, language, context) {
    // Basic syntax and style validation
    const validation = {
      syntax: { valid: true, issues: [] },
      style: { score: 100, suggestions: [] },
      security: { safe: true, warnings: [] },
      performance: { efficient: true, optimizations: [] },
    };

    // Language-specific validation
    switch (language.toLowerCase()) {
      case "javascript":
        this.validateJavaScript(code, validation);
        break;
      case "html":
        this.validateHTML(code, validation);
        break;
      case "css":
        this.validateCSS(code, validation);
        break;
      case "json":
        this.validateJSON(code, validation);
        break;
    }

    // Calculate overall score
    const overallScore = Math.round(
      (validation.style.score +
        (validation.syntax.valid ? 100 : 50) +
        (validation.security.safe ? 100 : 70) +
        (validation.performance.efficient ? 100 : 80)) /
        4
    );

    return {
      overallScore,
      language,
      validation,
      recommendations: this.generateCodeRecommendations(validation, language),
    };
  }

  validateJavaScript(code, validation) {
    // Check for common issues
    if (code.includes("==") && !code.includes("===")) {
      validation.style.suggestions.push(
        "Use === for strict equality comparison"
      );
      validation.style.score -= 10;
    }

    if (code.includes("var ")) {
      validation.style.suggestions.push(
        "Consider using 'let' or 'const' instead of 'var'"
      );
      validation.style.score -= 5;
    }

    if (
      !code.includes("try") &&
      (code.includes("fetch") || code.includes("await"))
    ) {
      validation.security.warnings.push(
        "Consider adding error handling for async operations"
      );
      validation.security.safe = false;
    }

    // Check for performance issues
    if (
      code.includes("document.getElementById") &&
      code.split("document.getElementById").length > 3
    ) {
      validation.performance.optimizations.push("Consider caching DOM queries");
      validation.performance.efficient = false;
    }
  }

  validateHTML(code, validation) {
    if (!code.includes("<!DOCTYPE")) {
      validation.syntax.issues.push("Missing DOCTYPE declaration");
      validation.syntax.valid = false;
    }

    if (code.includes("<img") && !code.includes("alt=")) {
      validation.style.suggestions.push(
        "Add alt attributes to images for accessibility"
      );
      validation.style.score -= 15;
    }

    if (!code.includes("lang=")) {
      validation.style.suggestions.push("Add lang attribute to html element");
      validation.style.score -= 5;
    }
  }

  validateCSS(code, validation) {
    if (code.includes("!important")) {
      validation.style.suggestions.push("Avoid using !important when possible");
      validation.style.score -= 10;
    }

    if (!code.includes("box-sizing: border-box")) {
      validation.performance.optimizations.push(
        "Consider using box-sizing: border-box"
      );
    }
  }

  validateJSON(code, validation) {
    try {
      JSON.parse(code);
    } catch (error) {
      validation.syntax.valid = false;
      validation.syntax.issues.push(`JSON syntax error: ${error.message}`);
    }
  }

  generateCodeRecommendations(validation, language) {
    const recommendations = [];

    if (!validation.syntax.valid) {
      recommendations.push({
        type: "syntax",
        priority: "high",
        message: "Fix syntax errors before proceeding",
        details: validation.syntax.issues,
      });
    }

    if (validation.style.score < 80) {
      recommendations.push({
        type: "style",
        priority: "medium",
        message: "Improve code style and best practices",
        details: validation.style.suggestions,
      });
    }

    if (!validation.security.safe) {
      recommendations.push({
        type: "security",
        priority: "high",
        message: "Address security concerns",
        details: validation.security.warnings,
      });
    }

    return recommendations;
  }

  getLearningResources(context) {
    return this.learningResources[context] || this.learningResources.javascript;
  }

  getRelatedConcepts(context, question) {
    const related = this.contextualExplanations[context];
    if (!related) return [];

    // Return relevant concepts based on question category
    if (question.category) {
      return related.beginnerConcepts || related.commonPatterns || [];
    }

    return [];
  }

  getProgressionPath(context) {
    const paths = {
      javascript: [
        "Variables → Functions → Objects → DOM → Events → Async/Await",
      ],
      html: ["Basic tags → Semantic elements → Forms → Accessibility"],
      css: ["Selectors → Box model → Layout → Responsive design"],
      api: ["HTTP basics → Fetch API → Error handling → Authentication"],
    };

    return paths[context] || paths.javascript;
  }
}
