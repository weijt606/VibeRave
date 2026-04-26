import OpenAI from 'openai';

/**
 * Generic OpenAI-compatible chat completions client. Works with anything
 * that speaks the OpenAI Chat Completions API:
 *
 *   • OpenAI       https://api.openai.com/v1
 *   • Gemini       https://generativelanguage.googleapis.com/v1beta/openai
 *   • Groq         https://api.groq.com/openai/v1
 *   • OpenRouter   https://openrouter.ai/api/v1
 *   • Ollama       http://localhost:11434/v1
 *   • LM Studio    http://localhost:1234/v1
 *   • etc.
 *
 * The factory accepts optional `apiKey` / `baseURL` / `model` so the
 * composition root can pass env defaults, and the per-request override
 * path can build a one-off client with the user's settings.
 *
 * @param {{
 *   apiKey: string | null,
 *   baseURL?: string | null,
 *   model: string,
 *   temperature?: number,
 * }} cfg
 * @returns {import('../application/ports.mjs').LlmClient | null}
 */
export function createOpenAICompatibleClient({ apiKey, baseURL, model, temperature = 0.85 }) {
  if (!apiKey) return null;
  // Most providers reject `null` baseURL; only pass it when set.
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return {
    async complete({ systemPrompt, userMessage, history = [], temperature: tempOverride } = {}) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((turn) => ({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: turn.text,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await client.chat.completions.create({
        model,
        messages,
        // Per-call override lets the transcript normalizer go deterministic
        // (temp 0) while code-gen keeps the configured diversity.
        temperature: typeof tempOverride === 'number' ? tempOverride : temperature,
      });

      const text = response.choices?.[0]?.message?.content ?? '';
      return { text, model: response.model || model };
    },
  };
}
