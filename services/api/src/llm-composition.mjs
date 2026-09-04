import { createOpenAICompatibleClient } from './infrastructure/openai-compatible-client.mjs';
import { createProviderChain } from './infrastructure/provider-chain.mjs';

/**
 * Wire the LLM provider chain from config (CONTRACTS.md §8.1). Shared by the
 * HTTP composition root (index.mjs) and scripts/pregenerate.mjs so both use
 * the same failover / timeout / max_tokens policy.
 *
 * Returns:
 *   chain            the provider chain (LlmClient port + health())
 *   defaultLlmClient chain, or null when no provider could be built
 *   llmClientFor     per-request override → chain with the override provider
 *                    prepended (cached so its circuit breaker persists)
 */
export function composeLlm(config, { log = (line) => console.log(line) } = {}) {
  const { timeoutMs, maxTokens } = config.llm;
  const entries = [];
  for (const p of config.llm.providers || []) {
    if (p.skipReason) {
      log(`[llm] provider=${p.name} skipped: ${p.skipReason}`);
      continue;
    }
    const client = createOpenAICompatibleClient({
      name: p.name,
      apiKey: p.apiKey,
      baseURL: p.baseURL,
      model: p.model,
      temperature: p.temperature ?? config.llm.temperature,
      timeoutMs,
      maxTokens,
      maxRetries: 0,
    });
    if (client) entries.push({ name: p.name, model: p.model, client });
  }
  const chain = createProviderChain({ providers: entries, log });
  const defaultLlmClient = chain.size > 0 ? chain : null;

  // Per-request override chain cache keyed on a config hash so the SDK
  // isn't re-instantiated (and the breaker isn't reset) on every request.
  const overrideCache = new Map();
  function llmClientFor(overrides) {
    if (!overrides) return defaultLlmClient;
    const provider = (overrides.provider || 'api').toLowerCase();
    const apiKey = overrides.apiKey ?? (provider === 'ollama' ? 'ollama' : null);
    const model = overrides.model || null;
    if (!apiKey || !model) return defaultLlmClient;
    const baseURL = overrides.baseURL || (provider === 'ollama' ? config.llm.ollama.baseURL : config.llm.api.baseURL);
    const temperature = typeof overrides.temperature === 'number' ? overrides.temperature : config.llm.temperature;
    const key = `${provider}|${baseURL || ''}|${model}|${apiKey.slice(-6)}|${temperature}`;
    let c = overrideCache.get(key);
    if (!c) {
      const client = createOpenAICompatibleClient({
        name: `override:${provider}`,
        apiKey,
        baseURL,
        model,
        temperature,
        timeoutMs,
        maxTokens,
        maxRetries: 0,
      });
      if (!client) return defaultLlmClient;
      c = chain.withPrepended({ name: `override:${provider}`, model, client });
      overrideCache.set(key, c);
    }
    return c;
  }

  return { chain, defaultLlmClient, llmClientFor };
}
