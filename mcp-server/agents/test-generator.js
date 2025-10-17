/**
 * Test Generator Agent - Specialized for Junior Web Development
 * Focuses on HTML, JavaScript, UI frameworks, and APIs
 */

import OpenAI from "openai";

let openai = null;

// Lazy-load OpenAI client
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

export class TestGeneratorAgent {
  constructor() {
    // Track recently generated questions to avoid repetition
    this.recentQuestionHashes = new Set();
    this.maxRecentQuestions = 50; // Remember last 50 questions

    this.specializations = {
      html: [
        "Semantic HTML elements",
        "Forms and validation",
        "Accessibility basics",
        "DOM structure",
        "HTML5 features",
        "Meta tags and SEO basics",
      ],
      javascript: [
        "Variables and data types",
        "Functions and scope",
        "DOM manipulation",
        "Event handling",
        "Async/await and promises",
        "Array and object methods",
        "ES6+ features",
        "Error handling",
        "Local storage",
        "JSON handling",
      ],
      frameworks: {
        react: [
          "Components and JSX",
          "Props and state",
          "Event handling",
          "useEffect and lifecycle",
          "Conditional rendering",
          "Lists and keys",
          "Forms in React",
          "Basic hooks",
          "Component communication",
        ],
        vue: [
          "Template syntax",
          "Data binding",
          "Computed properties",
          "Event handling",
          "Component basics",
          "Props and emit",
          "Directives (v-if, v-for)",
          "Vue lifecycle",
          "Reactivity",
        ],
        angular: [
          "Components and templates",
          "Data binding",
          "Directives",
          "Services and dependency injection",
          "Component communication",
          "Forms and validation",
          "Routing basics",
          "HTTP client",
        ],
      },
      apis: [
        "HTTP methods (GET, POST, PUT, DELETE)",
        "Status codes",
        "JSON format",
        "Fetch API",
        "Async data handling",
        "Error handling in API calls",
        "Authentication basics",
        "REST principles",
        "Query parameters",
        "Request headers",
      ],
      css: [
        "Selectors and specificity",
        "Box model",
        "Flexbox basics",
        "Grid basics",
        "Responsive design",
        "CSS variables",
        "Pseudo-classes and pseudo-elements",
        "Positioning",
      ],
    };
  }

  async generateTest(args) {
    const {
      topics = ["javascript", "html"],
      numQuestions = 5,
      difficulty = "junior",
      focusAreas = [],
      framework = "vanilla",
    } = args;

    // Build specialized prompt for junior web developers
    const systemPrompt = this.buildSystemPrompt(framework, difficulty);
    const userPrompt = this.buildUserPrompt(
      topics,
      numQuestions,
      focusAreas,
      framework
    );

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4", // Use GPT-4 for better code generation
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 3000,
        temperature: 0.7, // Increased for more variety while maintaining accuracy
        presence_penalty: 0.3, // Encourage diverse content
        frequency_penalty: 0.2, // Reduce repetition
      });

      const content = response.choices[0]?.message?.content?.trim();

      try {
        const result = JSON.parse(content);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: true,
                result: this.enhanceQuestions(result, framework),
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
      throw new Error(`Test generation failed: ${error.message}`);
    }
  }

  buildSystemPrompt(framework, difficulty) {
    return `You are an expert web development instructor specializing in junior-level training. 

CONTEXT: Generate tests for junior developers (6 months - 2 years experience) focusing on:
- Practical, real-world scenarios
- Code understanding and debugging
- Best practices and common pitfalls
- Framework: ${framework}
- Level: ${difficulty}

OUTPUT FORMAT: JSON only in this exact structure:
{
  "questions": [
    {
      "id": 1,
      "type": "mcq" | "short" | "code",
      "prompt": "Clear, practical question",
      "choices": ["option1", "option2", "option3", "option4"], // for MCQ only
      "answer": "correct answer or code solution",
      "rubric": [
        "Specific grading criteria for partial credit",
        "Common mistakes to watch for",
        "Key concepts that must be demonstrated"
      ],
      "points": 20,
      "category": "html|css|javascript|api|framework|general",
      "difficulty": "beginner|junior|intermediate",
      "codeExample": "optional code snippet if relevant"
    }
  ],
  "totalPoints": 100,
  "metadata": {
    "framework": "${framework}",
    "targetLevel": "junior",
    "focusAreas": ["identified areas"]
  }
}

QUESTION TYPES:
- "mcq": Multiple choice with 4 options
- "short": Brief text answer (1-3 sentences)
- "code": Code snippet or debugging question

GUIDELINES:
- Make questions practical and job-relevant
- Include real code examples when possible
- Focus on understanding, not memorization
- Test problem-solving skills
- Include common debugging scenarios
- Emphasize best practices
- Points should sum to exactly 100

VARIETY REQUIREMENTS:
- Each test should feel completely different from previous ones
- Use diverse real-world scenarios and project contexts
- Vary the specific technologies, methods, and approaches tested
- Include different types of challenges (syntax, logic, best practices, debugging)
- Reference different tools, libraries, and development situations
- Create questions that could come from different companies/projects
- Ensure no two questions feel like variations of the same concept`;
  }

  buildUserPrompt(topics, numQuestions, focusAreas, framework) {
    const topicDetails = this.getTopicDetails(topics, framework);
    const focusText =
      focusAreas.length > 0
        ? `\n\nFOCUS AREAS (prioritize these based on previous mistakes): ${focusAreas.join(
            ", "
          )}`
        : "";

    // Add variety by including different scenario types
    const scenarioTypes = [
      "debugging a broken feature",
      "code review scenarios",
      "performance optimization",
      "accessibility improvements",
      "security vulnerabilities",
      "cross-browser compatibility",
      "responsive design challenges",
      "API integration problems",
      "user experience improvements",
      "modern best practices",
    ];

    const randomScenarios = scenarioTypes
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .join(", ");

    const currentTime = new Date().toISOString();

    return `Generate ${numQuestions} UNIQUE questions for junior web developers. 
TIMESTAMP: ${currentTime} (use this to ensure uniqueness)

TOPICS TO COVER: ${topics.join(", ")}

SPECIFIC AREAS:
${topicDetails}

FRAMEWORK CONTEXT: ${framework === "vanilla" ? "Pure HTML/CSS/JS" : framework}

VARIETY REQUIREMENTS:
- Create FRESH, UNIQUE questions (avoid common/generic patterns)
- Mix question types: MCQ (40%), short answer (30%), code problems (30%)
- Include diverse scenarios like: ${randomScenarios}
- Vary complexity within junior level (some easier, some challenging)
- Use different code examples and contexts each time
- Test different aspects: syntax, concepts, debugging, best practices, real-world application

PRACTICAL CONTEXTS:
- Building a to-do app feature
- Fixing e-commerce checkout bugs  
- Optimizing a blog website
- Creating responsive navigation
- Handling user form validation
- Working with team APIs
- Improving site accessibility
- Managing state in applications

${focusText}

IMPORTANT: Each question should feel like a real workplace scenario that a junior developer (6 months - 2 years) would encounter. Avoid textbook examples - use practical, job-relevant situations.`;
  }

  getTopicDetails(topics, framework) {
    let details = [];

    topics.forEach((topic) => {
      switch (topic.toLowerCase()) {
        case "html":
          details.push(
            `HTML: ${this.specializations.html.slice(0, 4).join(", ")}`
          );
          break;
        case "javascript":
        case "js":
          details.push(
            `JavaScript: ${this.specializations.javascript
              .slice(0, 5)
              .join(", ")}`
          );
          break;
        case "css":
          details.push(
            `CSS: ${this.specializations.css.slice(0, 4).join(", ")}`
          );
          break;
        case "api":
        case "apis":
          details.push(
            `APIs: ${this.specializations.apis.slice(0, 4).join(", ")}`
          );
          break;
        case "react":
        case "vue":
        case "angular":
          if (this.specializations.frameworks[topic]) {
            details.push(
              `${topic}: ${this.specializations.frameworks[topic]
                .slice(0, 4)
                .join(", ")}`
            );
          }
          break;
      }
    });

    return details.join("\n");
  }

  enhanceQuestions(result, framework) {
    // Add framework-specific context and ensure proper categorization
    if (result.questions) {
      result.questions = result.questions.map((q) => {
        // Generate hash of question prompt to track uniqueness
        const questionHash = this.generateQuestionHash(q.prompt);

        // Store hash for future deduplication
        this.recentQuestionHashes.add(questionHash);

        // Clean up old hashes if we have too many
        if (this.recentQuestionHashes.size > this.maxRecentQuestions) {
          const hashes = Array.from(this.recentQuestionHashes);
          this.recentQuestionHashes = new Set(
            hashes.slice(-this.maxRecentQuestions)
          );
        }

        return {
          ...q,
          framework: framework,
          enhanced: true,
          generatedAt: new Date().toISOString(),
          uniqueId: questionHash,
        };
      });
    }

    // Ensure metadata
    if (!result.metadata) {
      result.metadata = {};
    }
    result.metadata.framework = framework;
    result.metadata.generatedBy = "TestGeneratorAgent";
    result.metadata.questionCount = result.questions?.length || 0;
    result.metadata.diversity = this.calculateDiversityScore(
      result.questions || []
    );

    return result;
  }

  generateQuestionHash(prompt) {
    // Simple hash function for question uniqueness tracking
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  calculateDiversityScore(questions) {
    if (questions.length === 0) return 0;

    const categories = new Set(questions.map((q) => q.category));
    const types = new Set(questions.map((q) => q.type));
    const uniquePrompts = new Set(
      questions.map((q) => this.generateQuestionHash(q.prompt))
    );

    // Score based on variety of categories, types, and unique content
    const categoryScore = categories.size / Math.max(questions.length, 3);
    const typeScore = types.size / 3; // 3 possible types
    const uniquenessScore = uniquePrompts.size / questions.length;

    return Math.round(
      ((categoryScore + typeScore + uniquenessScore) / 3) * 100
    );
  }

  // Get available topics for this agent
  getAvailableTopics() {
    return {
      core: ["html", "css", "javascript", "apis"],
      frameworks: Object.keys(this.specializations.frameworks),
      specializations: this.specializations,
    };
  }
}
