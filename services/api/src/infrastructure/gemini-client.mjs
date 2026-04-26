import { GoogleGenAI } from '@google/genai';

/**
 * Returns an LlmClient implementation, or `null` if no API key is configured.
 * Returning null lets the composition root keep wiring the rest of the app
 * and surface a 503 at request time instead of crashing on boot.
 *
 * @param {{ apiKey: string | null, model: string, temperature?: number }} cfg
 * @returns {import('../application/ports.mjs').LlmClient | null}
 */
export function createGeminiClient({ apiKey, model, temperature = 0.85 }) {
  if (!apiKey) return null;
  const genai = new GoogleGenAI({ apiKey });

  return {
    async complete({ systemPrompt, userMessage, history = [], temperature: tempOverride } = {}) {
      const contents = history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      }));
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const response = await genai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          // Per-call override lets the transcript normalizer go deterministic
          // (temp 0) while code-gen keeps the configured diversity (0.85).
          temperature: typeof tempOverride === 'number' ? tempOverride : temperature,
        },
      });
      return { text: response.text ?? '', model };
    },
  };
}
