import { describe, it, expect } from 'vitest';
import { loadProviderChain } from '../src/config.mjs';

describe('provider chain config', () => {
  it('derives a legacy single provider when LLM_PROVIDERS is unset', () => {
    expect(
      loadProviderChain({ provider: 'api', temperature: 0.8 }, { LLM_API_KEY: 'k', LLM_MODEL: 'gpt-4o-mini' }),
    ).toEqual([
      { name: 'api', apiKey: 'k', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini', temperature: 0.8 },
    ]);
    expect(loadProviderChain({ provider: 'ollama', temperature: 0.8 }, { OLLAMA_MODEL: 'llama3' })[0]).toMatchObject({
      name: 'ollama',
      model: 'llama3',
      apiKey: 'ollama',
    });
    expect(loadProviderChain({ provider: 'api', temperature: 0.8 }, {})[0].skipReason).toMatch(/LLM_API_KEY/);
  });
  it('builds the domestic-first chain from LLM_<NAME>_* keys', () => {
    const chain = loadProviderChain(
      { provider: 'api', temperature: 0.85 },
      { LLM_PROVIDERS: 'dashscope, openai,ollama,lmstudio', LLM_DASHSCOPE_API_KEY: 'd', LLM_LMSTUDIO_MODEL: 'qwen' },
    );
    expect(chain.map((p) => p.name)).toEqual(['dashscope', 'openai', 'ollama', 'lmstudio']);
    expect(chain[0]).toMatchObject({
      apiKey: 'd',
      model: 'qwen-plus',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
    expect(chain[0].skipReason).toBeUndefined();
    expect(chain[1].skipReason).toMatch(/LLM_OPENAI_API_KEY/);
    expect(chain[2]).toMatchObject({ apiKey: 'ollama', model: 'qwen2.5:14b', baseURL: 'http://localhost:11434/v1' });
    expect(chain[3]).toMatchObject({ model: 'qwen', baseURL: 'http://localhost:1234/v1' });
    expect(
      loadProviderChain({ provider: 'api', temperature: 0.85 }, { LLM_PROVIDERS: 'lmstudio' })[0].skipReason,
    ).toMatch(/LLM_LMSTUDIO_MODEL/);
  });
});
