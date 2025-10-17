/**
 * Test Checker Agent - Specialized Web Development Grader
 * Advanced grading for HTML, JavaScript, UI frameworks, and API knowledge
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

export class TestCheckerAgent {
  constructor() {
    this.gradingCriteria = {
      javascript: {
        syntax: 0.3, // 30% for correct syntax
        logic: 0.4, // 40% for logical correctness
        bestPractices: 0.2, // 20% for following best practices
        efficiency: 0.1, // 10% for code efficiency
      },
      html: {
        semantics: 0.4, // 40% for semantic correctness
        structure: 0.3, // 30% for proper structure
        accessibility: 0.2, // 20% for accessibility considerations
        validation: 0.1, // 10% for HTML validation
      },
      css: {
        correctness: 0.4, // 40% for achieving desired result
        bestPractices: 0.3, // 30% for CSS best practices
        responsiveness: 0.2, // 20% for responsive considerations
        efficiency: 0.1, // 10% for code efficiency
      },
      api: {
        understanding: 0.4, // 40% for conceptual understanding
        implementation: 0.3, // 30% for correct implementation
        errorHandling: 0.2, // 20% for proper error handling
        security: 0.1, // 10% for security awareness
      },
    };

    this.commonMistakes = {
      javascript: [
        "Not handling null/undefined values",
        "Incorrect use of == vs ===",
        "Missing error handling for async operations",
        "Improper variable scoping",
        "Not using modern ES6+ features appropriately",
        "Forgetting to bind 'this' context",
      ],
      html: [
        "Missing semantic elements",
        "Improper form structure",
        "Missing alt attributes for images",
        "Incorrect heading hierarchy",
        "Missing required attributes",
        "Poor accessibility structure",
      ],
      css: [
        "Not using box-sizing: border-box",
        "Overusing !important",
        "Not considering mobile-first design",
        "Poor selector specificity",
        "Not using CSS custom properties",
        "Inefficient layout methods",
      ],
      api: [
        "Not checking response status",
        "Poor error handling",
        "Not handling network failures",
        "Exposing sensitive information",
        "Incorrect HTTP methods",
        "Not validating API responses",
      ],
    };
  }

  async gradeTest(args) {
    const { test, answers, strictness = "standard" } = args;

    if (!test || !test.result || !answers) {
      throw new Error("Missing required grading parameters");
    }

    const systemPrompt = this.buildGradingPrompt(strictness);
    const userPrompt = this.buildGradingRequest(test, answers);

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.1, // Very low for consistent grading
      });

      const content = response.choices[0]?.message?.content?.trim();

      try {
        const result = JSON.parse(content);
        const enhancedResult = await this.enhanceGradingResult(
          result,
          test,
          answers
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
      throw new Error(`Grading failed: ${error.message}`);
    }
  }

  buildGradingPrompt(strictness) {
    const strictnessMultipliers = {
      lenient: 1.2, // 20% more generous
      standard: 1.0, // Normal grading
      strict: 0.8, // 20% more demanding
    };

    return `You are an expert web development grader specializing in junior-level assessment.

GRADING CONTEXT:
- Target level: Junior developers (6 months - 2 years experience)
- Strictness: ${strictness} (${strictnessMultipliers[strictness]}x multiplier)
- Focus: Practical understanding over perfect syntax
- Emphasize: Problem-solving approach and best practices awareness

GRADING CRITERIA by Category:
JavaScript: Syntax (30%), Logic (40%), Best Practices (20%), Efficiency (10%)
HTML: Semantics (40%), Structure (30%), Accessibility (20%), Validation (10%)
CSS: Correctness (40%), Best Practices (30%), Responsiveness (20%), Efficiency (10%)
APIs: Understanding (40%), Implementation (30%), Error Handling (20%), Security (10%)

OUTPUT FORMAT - JSON only:
{
  "results": [
    {
      "id": 1,
      "score": 16,
      "max": 20,
      "feedback": "Concise, constructive feedback",
      "correct": false,
      "expected": "What the correct answer should include",
      "category": "javascript|html|css|api|general",
      "breakdown": {
        "strengths": ["What they did well"],
        "weaknesses": ["Areas for improvement"], 
        "suggestions": ["Specific next steps"]
      },
      "partialCredit": {
        "reasoning": "Why partial credit was awarded",
        "criteria": ["Which criteria were met/missed"]
      }
    }
  ],
  "totalScorePercent": 84.0,
  "totalPoints": 100,
  "earnedPoints": 84,
  "overview": {
    "strongAreas": ["Categories where student excelled"],
    "improvementAreas": ["Categories needing work"],
    "recommendedFocus": ["Specific topics to study next"]
  }
}

PARTIAL CREDIT GUIDELINES:
- Award partial credit for correct approach even with syntax errors
- Recognize good problem-solving steps
- Consider junior-level expectations
- Be encouraging while maintaining standards
- Focus on learning progression

FEEDBACK STYLE:
- Constructive and encouraging
- Specific and actionable
- Appropriate for junior developer level
- Include examples when helpful`;
  }

  buildGradingRequest(test, answers) {
    const testData = JSON.stringify(test.result, null, 2);
    const answersData = JSON.stringify(answers, null, 2);

    return `Grade this web development test for a junior developer.

TEST:
${testData}

STUDENT ANSWERS:
${answersData}

GRADING INSTRUCTIONS:
1. Apply rubric criteria carefully with partial credit
2. Consider the junior developer context - be fair but not overly lenient
3. Provide specific, actionable feedback
4. Identify patterns in mistakes for targeted improvement
5. Recognize good approaches even if execution isn't perfect
6. Award points for demonstrating understanding of concepts

Focus on assessing:
- Conceptual understanding
- Problem-solving approach
- Code quality awareness
- Best practices knowledge
- Practical application skills

Calculate total score percentage accurately and provide meaningful feedback for growth.`;
  }

  async enhanceGradingResult(result, test, answers) {
    // Add detailed analysis based on question categories
    if (result.results) {
      for (let i = 0; i < result.results.length; i++) {
        const gradingResult = result.results[i];
        const question = test.result.questions.find(
          (q) => q.id === gradingResult.id
        );

        if (question && question.category) {
          gradingResult.category = question.category;
          gradingResult.commonMistakes = this.getCommonMistakes(
            question.category
          );
          gradingResult.framework = question.framework || "vanilla";
        }
      }
    }

    // Add performance analytics
    result.analytics = this.calculateAnalytics(
      result.results,
      test.result.questions
    );

    // Add learning recommendations
    result.learningPath = this.generateLearningPath(
      result.results,
      test.result.questions
    );

    return result;
  }

  getCommonMistakes(category) {
    return this.commonMistakes[category] || [];
  }

  calculateAnalytics(results, questions) {
    const categoryScores = {};
    const categoryTotals = {};

    results.forEach((result) => {
      const question = questions.find((q) => q.id === result.id);
      if (question && question.category) {
        const category = question.category;
        if (!categoryScores[category]) {
          categoryScores[category] = 0;
          categoryTotals[category] = 0;
        }
        categoryScores[category] += result.score;
        categoryTotals[category] += result.max;
      }
    });

    const categoryPercentages = {};
    Object.keys(categoryScores).forEach((category) => {
      categoryPercentages[category] =
        (categoryScores[category] / categoryTotals[category]) * 100;
    });

    return {
      categoryScores: categoryPercentages,
      strengths: Object.entries(categoryPercentages)
        .filter(([_, score]) => score >= 80)
        .map(([category, _]) => category),
      weaknesses: Object.entries(categoryPercentages)
        .filter(([_, score]) => score < 60)
        .map(([category, _]) => category),
    };
  }

  generateLearningPath(results, questions) {
    const missedConcepts = [];
    const practiceAreas = [];

    results.forEach((result) => {
      if (result.score < result.max * 0.7) {
        // Less than 70%
        const question = questions.find((q) => q.id === result.id);
        if (question) {
          missedConcepts.push(question.category);
          if (question.codeExample) {
            practiceAreas.push(
              `Practice ${question.category} coding exercises`
            );
          }
        }
      }
    });

    return {
      focusTopics: [...new Set(missedConcepts)],
      practiceRecommendations: [...new Set(practiceAreas)],
      nextSkillLevel: this.suggestNextSkillLevel(results),
    };
  }

  suggestNextSkillLevel(results) {
    const averageScore =
      results.reduce((sum, r) => sum + r.score / r.max, 0) / results.length;

    if (averageScore >= 0.9) return "intermediate";
    if (averageScore >= 0.7) return "junior-advanced";
    return "junior";
  }

  // Validate code snippets for technical accuracy
  async validateCode(code, language) {
    // Basic validation logic for common web languages
    const validators = {
      javascript: this.validateJavaScript,
      html: this.validateHTML,
      css: this.validateCSS,
    };

    const validator = validators[language.toLowerCase()];
    if (validator) {
      return validator(code);
    }

    return { valid: true, warnings: ["No specific validation available"] };
  }

  validateJavaScript(code) {
    const issues = [];

    // Check for common issues
    if (code.includes("==") && !code.includes("===")) {
      issues.push("Consider using === for strict equality");
    }

    if (
      code.includes("var ") &&
      !code.includes("let ") &&
      !code.includes("const ")
    ) {
      issues.push("Consider using let/const instead of var");
    }

    return {
      valid: issues.length === 0,
      warnings: issues,
    };
  }

  validateHTML(code) {
    const issues = [];

    // Basic HTML validation
    if (!code.includes("<!DOCTYPE")) {
      issues.push("Missing DOCTYPE declaration");
    }

    if (code.includes("<img") && !code.includes("alt=")) {
      issues.push("Images should have alt attributes");
    }

    return {
      valid: issues.length === 0,
      warnings: issues,
    };
  }

  validateCSS(code) {
    const issues = [];

    // Basic CSS validation
    if (code.includes("!important")) {
      issues.push("Avoid using !important when possible");
    }

    return {
      valid: issues.length === 0,
      warnings: issues,
    };
  }
}
