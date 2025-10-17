/**
 * Adaptive Learning Agent - Progress Tracking and Dynamic Difficulty
 * Tracks student performance and adjusts question difficulty automatically
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

export class AdaptiveLearningAgent {
  constructor() {
    this.performanceThresholds = {
      increase: 0.8, // 80% correct to increase difficulty
      decrease: 0.4, // 40% correct to decrease difficulty
      minimum: 0.6, // 60% minimum for staying at current level
    };

    this.difficultyLevels = {
      beginner: {
        name: "Beginner",
        description: "Basic concepts and syntax",
        complexity: 1,
        topics: ["basic syntax", "simple concepts", "fundamental principles"],
      },
      junior: {
        name: "Junior",
        description: "Practical application and common patterns",
        complexity: 2,
        topics: [
          "practical application",
          "common patterns",
          "real-world examples",
        ],
      },
      intermediate: {
        name: "Intermediate",
        description: "Advanced concepts and problem-solving",
        complexity: 3,
        topics: [
          "advanced concepts",
          "complex problem-solving",
          "optimization",
        ],
      },
      advanced: {
        name: "Advanced",
        description: "Expert-level challenges and architecture",
        complexity: 4,
        topics: [
          "expert challenges",
          "system architecture",
          "advanced patterns",
        ],
      },
    };

    this.subjectAreas = [
      "html",
      "css",
      "javascript",
      "react",
      "vue",
      "angular",
      "apis",
      "nodejs",
      "performance",
      "accessibility",
      "security",
    ];
  }

  async trackProgress(args) {
    const {
      userId = "default",
      testResults,
      currentDifficulty = "junior",
      subject = "general",
    } = args;

    if (!testResults || !Array.isArray(testResults)) {
      throw new Error("Test results are required for progress tracking");
    }

    try {
      // Analyze current performance
      const analysis = this.analyzePerformance(testResults, subject);

      // Get difficulty recommendation
      const difficultyRecommendation = this.calculateDifficultyAdjustment(
        analysis.accuracy,
        currentDifficulty,
        analysis.weakAreas
      );

      // Generate focus areas for next session
      const focusAreas = this.generateFocusAreas(analysis.mistakes, subject);

      // Create learning recommendations
      const recommendations = await this.generateLearningRecommendations(
        analysis,
        difficultyRecommendation,
        focusAreas
      );

      const result = {
        performance: {
          accuracy: analysis.accuracy,
          totalQuestions: testResults.length,
          correctAnswers: analysis.correctCount,
          incorrectAnswers: analysis.incorrectCount,
          currentStreak: analysis.streak,
          improvementTrend: analysis.trend,
        },
        difficulty: {
          current: currentDifficulty,
          recommended: difficultyRecommendation.level,
          reason: difficultyRecommendation.reason,
          adjustment: difficultyRecommendation.adjustment,
        },
        weakAreas: analysis.weakAreas,
        strongAreas: analysis.strongAreas,
        focusAreas: focusAreas,
        recommendations: recommendations,
        nextSessionConfig: {
          difficulty: difficultyRecommendation.level,
          topics: focusAreas.slice(0, 3),
          questionCount: this.getOptimalQuestionCount(analysis.accuracy),
          emphasis: analysis.weakAreas.slice(0, 2),
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              result: result,
            }),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Progress tracking failed: ${error.message}`);
    }
  }

  analyzePerformance(testResults, subject) {
    const correctCount = testResults.filter((r) => r.correct).length;
    const incorrectCount = testResults.length - correctCount;
    const accuracy =
      testResults.length > 0 ? correctCount / testResults.length : 0;

    // Analyze mistakes by category
    const mistakes = testResults.filter((r) => !r.correct).map((r) => ({
      category: r.category || subject,
      type: r.type || "unknown",
      difficulty: r.difficulty || "junior",
    }));

    // Find weak and strong areas
    const categoryPerformance = this.categorizePerformance(testResults);
    const weakAreas = Object.entries(categoryPerformance)
      .filter(([_, perf]) => perf.accuracy < this.performanceThresholds.minimum)
      .map(([category, _]) => category)
      .slice(0, 3);

    const strongAreas = Object.entries(categoryPerformance)
      .filter(
        ([_, perf]) => perf.accuracy >= this.performanceThresholds.increase
      )
      .map(([category, _]) => category)
      .slice(0, 3);

    // Calculate streak (recent consecutive correct answers)
    const streak = this.calculateStreak(testResults);

    // Determine trend (improving, declining, stable)
    const trend = this.calculateTrend(testResults);

    return {
      accuracy,
      correctCount,
      incorrectCount,
      mistakes,
      weakAreas,
      strongAreas,
      streak,
      trend,
      categoryPerformance,
    };
  }

  categorizePerformance(testResults) {
    const categories = {};

    testResults.forEach((result) => {
      const category = result.category || "general";
      if (!categories[category]) {
        categories[category] = { correct: 0, total: 0 };
      }
      categories[category].total++;
      if (result.correct) {
        categories[category].correct++;
      }
    });

    // Calculate accuracy for each category
    Object.keys(categories).forEach((category) => {
      const cat = categories[category];
      cat.accuracy = cat.total > 0 ? cat.correct / cat.total : 0;
    });

    return categories;
  }

  calculateDifficultyAdjustment(accuracy, currentDifficulty, weakAreas) {
    const levels = Object.keys(this.difficultyLevels);
    const currentIndex = levels.indexOf(currentDifficulty);

    let newLevel = currentDifficulty;
    let adjustment = "maintain";
    let reason = "";

    if (
      accuracy >= this.performanceThresholds.increase &&
      currentIndex < levels.length - 1
    ) {
      // Increase difficulty
      newLevel = levels[currentIndex + 1];
      adjustment = "increase";
      reason = `Excellent performance (${Math.round(
        accuracy * 100
      )}%)! Ready for more challenging questions.`;
    } else if (
      accuracy <= this.performanceThresholds.decrease &&
      currentIndex > 0
    ) {
      // Decrease difficulty
      newLevel = levels[currentIndex - 1];
      adjustment = "decrease";
      reason = `Performance below target (${Math.round(
        accuracy * 100
      )}%). Reducing difficulty to build confidence.`;
    } else if (accuracy < this.performanceThresholds.minimum) {
      // Stay at current level but focus on weak areas
      reason = `Performance needs improvement (${Math.round(
        accuracy * 100
      )}%). Focus on: ${weakAreas.join(", ")}`;
    } else {
      reason = `Good performance (${Math.round(
        accuracy * 100
      )}%). Maintaining current difficulty level.`;
    }

    return {
      level: newLevel,
      adjustment,
      reason,
      previousLevel: currentDifficulty,
    };
  }

  generateFocusAreas(mistakes, subject) {
    const mistakeCategories = mistakes.reduce((acc, mistake) => {
      acc[mistake.category] = (acc[mistake.category] || 0) + 1;
      return acc;
    }, {});

    // Sort by frequency of mistakes
    const focusAreas = Object.entries(mistakeCategories)
      .sort(([, a], [, b]) => b - a)
      .map(([category, count]) => category);

    // Add general improvement areas if not enough specific mistakes
    if (focusAreas.length < 3) {
      const generalAreas = this.getGeneralImprovementAreas(subject);
      focusAreas.push(...generalAreas.slice(0, 3 - focusAreas.length));
    }

    return focusAreas.slice(0, 5);
  }

  getGeneralImprovementAreas(subject) {
    const improvements = {
      html: ["semantic elements", "accessibility", "forms", "validation"],
      css: ["flexbox", "grid", "responsive design", "animations"],
      javascript: [
        "async/await",
        "array methods",
        "object manipulation",
        "error handling",
      ],
      general: [
        "debugging",
        "best practices",
        "performance",
        "code organization",
      ],
    };

    return improvements[subject] || improvements.general;
  }

  calculateStreak(testResults) {
    let streak = 0;
    for (let i = testResults.length - 1; i >= 0; i--) {
      if (testResults[i].correct) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  calculateTrend(testResults) {
    if (testResults.length < 6) return "insufficient_data";

    const recent = testResults.slice(-5);
    const previous = testResults.slice(-10, -5);

    const recentAccuracy =
      recent.filter((r) => r.correct).length / recent.length;
    const previousAccuracy =
      previous.filter((r) => r.correct).length / previous.length;

    if (recentAccuracy > previousAccuracy + 0.1) return "improving";
    if (recentAccuracy < previousAccuracy - 0.1) return "declining";
    return "stable";
  }

  getOptimalQuestionCount(accuracy) {
    if (accuracy >= 0.9) return 10; // High performers get more questions
    if (accuracy >= 0.7) return 8; // Good performers get standard count
    if (accuracy >= 0.5) return 6; // Struggling learners get fewer questions
    return 5; // Very low performers get minimal questions to avoid frustration
  }

  async generateLearningRecommendations(analysis, difficultyRec, focusAreas) {
    const systemPrompt = `You are an adaptive learning coach for web development. Provide personalized learning recommendations based on performance data.

STUDENT PERFORMANCE:
- Accuracy: ${Math.round(analysis.accuracy * 100)}%
- Weak Areas: ${analysis.weakAreas.join(", ") || "None identified"}
- Strong Areas: ${analysis.strongAreas.join(", ") || "None identified"}
- Current Streak: ${analysis.streak} correct
- Trend: ${analysis.trend}

DIFFICULTY ADJUSTMENT: ${difficultyRec.adjustment} (${difficultyRec.reason})

Provide specific, actionable recommendations in JSON format:
{
  "immediate": ["2-3 specific actions for next study session"],
  "shortTerm": ["2-3 goals for this week"],
  "longTerm": ["1-2 goals for this month"],
  "resources": ["3-4 specific learning resources or exercises"],
  "motivational": "encouraging message based on their progress"
}`;

    const userPrompt = `Generate learning recommendations for a student with the above performance data. Focus on areas that need improvement while acknowledging strengths. Keep recommendations specific and achievable.`;

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content?.trim();
      return JSON.parse(content);
    } catch (error) {
      // Fallback recommendations
      return {
        immediate: [
          `Focus on ${analysis.weakAreas[0] || "fundamentals"}`,
          "Take smaller practice quizzes",
          "Review incorrect answers",
        ],
        shortTerm: [
          "Complete daily practice sessions",
          "Work through tutorial exercises",
          "Join coding community",
        ],
        longTerm: [
          "Build a portfolio project",
          "Master core concepts completely",
        ],
        resources: [
          "MDN Web Docs",
          "Practice coding challenges",
          "Interactive tutorials",
          "Code review sessions",
        ],
        motivational: this.getMotivationalMessage(
          analysis.accuracy,
          analysis.trend
        ),
      };
    }
  }

  getMotivationalMessage(accuracy, trend) {
    if (accuracy >= 0.8) {
      return "Excellent work! You're mastering these concepts. Ready for the next challenge?";
    } else if (accuracy >= 0.6) {
      return "Good progress! You're on the right track. Keep practicing and you'll see improvement.";
    } else if (trend === "improving") {
      return "Great improvement! Your hard work is paying off. Keep up the momentum!";
    } else {
      return "Learning takes time - you're building important skills. Every mistake is a step toward mastery!";
    }
  }

  async getProgressStats(args) {
    const { userId = "default", timeframe = "week" } = args;

    // This would typically fetch from a database
    // For now, return sample structure
    const stats = {
      overall: {
        testsCompleted: 15,
        averageAccuracy: 0.73,
        totalQuestions: 120,
        correctAnswers: 88,
        currentStreak: 5,
        longestStreak: 8,
      },
      byCategory: {
        html: { accuracy: 0.85, count: 20, trend: "improving" },
        css: { accuracy: 0.65, count: 25, trend: "stable" },
        javascript: { accuracy: 0.7, count: 30, trend: "improving" },
        api: { accuracy: 0.6, count: 15, trend: "declining" },
      },
      achievements: [
        {
          name: "HTML Master",
          description: "90%+ accuracy in HTML",
          unlocked: true,
        },
        {
          name: "Consistency",
          description: "5 tests in a row",
          unlocked: true,
        },
        {
          name: "Improver",
          description: "20% improvement over time",
          unlocked: false,
        },
      ],
      recommendedNextSteps: [
        "Focus on API concepts - accuracy below 70%",
        "Continue JavaScript practice - good improvement trend",
        "Challenge yourself with intermediate HTML",
      ],
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            result: stats,
          }),
        },
      ],
    };
  }
}
