import OpenAI from 'openai';

/**
 * Generic OpenAI-compatible chat completions client. Works with anything
 * that speaks the OpenAI Chat Completions API:
 *
 *   • OpenAI       https://api.openai.com/v1
 *   • DashScope    https://dashscope.aliyuncs.com/compatible-mode/v1
 *   • Gemini       https://generativelanguage.googleapis.com/v1beta/openai
 *   • Groq         https://api.groq.com/openai/v1
 *   • OpenRouter   https://openrouter.ai/api/v1
 *   • Ollama       http://localhost:11434/v1
 *   • LM Studio    http://localhost:1234/v1
 *
 * One client = one provider. Failover between providers is the job of
 * `provider-chain.mjs`, which is why the SDK's own retries are OFF by
 * default (`maxRetries: 0`) and every call carries a hard AbortController
 * timeout — a hung cloud endpoint must cost at most `timeoutMs` before
 * the chain moves on to the next provider.
 *
 * @param {{
 *   apiKey: string | null,
 *   baseURL?: string | null,
 *   model: string,
 *   temperature?: number,
 *   timeoutMs?: number,
 *   maxTokens?: number | null,
 *   maxRetries?: number,
 *   name?: string,
 * }} cfg
 * @returns {(import('../application/ports.mjs').LlmClient & { name: string, model: string, baseURL: string | null }) | null}
 */
export function createOpenAICompatibleClient({
  apiKey,
  baseURL,
  model,
  temperature = 0.85,
  timeoutMs = 15000,
  maxTokens = null,
  maxRetries = 0,
  name = 'llm',
}) {
  if (!apiKey || !model) return null;
  // Most providers reject `null` baseURL; only pass it when set.
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
    maxRetries,
    timeout: timeoutMs,
  });

  return {
    name,
    model,
    baseURL: baseURL || null,
    async complete({
      systemPrompt,
      userMessage,
      history = [],
      temperature: tempOverride,
      maxTokens: maxTokensOverride,
    } = {}) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((turn) => ({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: turn.text,
        })),
        { role: 'user', content: userMessage },
      ];
      const tokens = typeof maxTokensOverride === 'number' ? maxTokensOverride : maxTokens;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await client.chat.completions.create(
          {
            model,
            messages,
            // Per-call override lets the transcript normalizer go deterministic
            // (temp 0) while code-gen keeps the configured diversity.
            temperature: typeof tempOverride === 'number' ? tempOverride : temperature,
            ...(tokens ? { max_tokens: tokens } : {}),
          },
          { signal: controller.signal, timeout: timeoutMs },
        );
      } catch (err) {
        const timedOut =
          controller.signal.aborted ||
          err?.name === 'AbortError' ||
          err?.name === 'APIConnectionTimeoutError' ||
          err?.name === 'APIUserAbortError';
        const status = err?.status ?? err?.response?.status ?? 0;
        const upstreamMsg = timedOut
          ? `timed out after ${timeoutMs} ms`
          : err?.error?.message || err?.response?.data?.error?.message || err?.message || 'unknown error';
        const where = baseURL || 'OpenAI default';
        const message = `LLM request to ${where} (model "${model}") failed${status ? ` with HTTP ${status}` : ''}: ${upstreamMsg}`;
        const wrapped = new Error(message);
        wrapped.status = 502;
        wrapped.code = 'llm_upstream_failed';
        wrapped.upstreamStatus = status || null;
        wrapped.timedOut = timedOut;
        wrapped.provider = name;
        throw wrapped;
      } finally {
        clearTimeout(timer);
      }

      const text = response.choices?.[0]?.message?.content ?? '';
      return { text, model: response.model || model, provider: name };
    },
  };
}
