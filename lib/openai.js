import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Chat wrapper function for OpenAI API calls
 * @param {string} systemPrompt - System message to set model behavior
 * @param {string} userPrompt - User message with the actual request
 * @param {object} options - Additional options for the API call
 * @returns {Promise<string>} The model's response text
 */
export async function chat(systemPrompt, userPrompt, options = {}) {
  const {
    model = "gpt-3.5-turbo", // Default model - users should swap to one they have access to
    maxTokens = 2000,
    temperature = 0.2, // Low temperature for consistent JSON responses
    ...otherOptions
  } = options;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
      ...otherOptions,
    });

    return response.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error(`OpenAI API failed: ${error.message}`);
  }
}
