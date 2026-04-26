/**
 * Ollama-backed LlmClient. Talks to a local ollama daemon (default
 * http://localhost:11434) using the chat endpoint, which natively supports
 * system prompts + multi-turn history without any prompt-template surgery.
 *
 * Thinking mode is disabled by default. Models like qwen3:8b emit a long
 * internal-monologue token stream before any answer — fine for a research
 * chat, useless for our live-coding loop where we want sub-second code
 * drops. Override via OLLAMA_THINK=true if you actually want the chain.
 *
 * @param {{
 *   baseUrl?: string,
 *   model: string,
 *   temperature?: number,
 *   numCtx?: number,
 *   think?: boolean,
 * }} cfg
 * @returns {import('../application/ports.mjs').LlmClient}
 */
export function createOllamaClient({
  baseUrl = 'http://localhost:11434',
  model,
  temperature = 0.7,
  numCtx,
  think = false,
}) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/chat`;

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

      const body = {
        model,
        messages,
        stream: false,
        think,
        options: {
          temperature: typeof tempOverride === 'number' ? tempOverride : temperature,
          ...(numCtx ? { num_ctx: numCtx } : {}),
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${detail.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = data?.message?.content ?? '';
      return { text, model: data?.model ?? model };
    },
  };
}
