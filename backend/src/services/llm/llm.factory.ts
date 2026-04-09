import { LLMProvider, Options } from '../agent/agent.interfaces.js';
import { DeepSeekService } from './deepseek.service.js';
import { LLMService } from './llm.interface.js';
import { SecretAIService } from './secretai.service.js';

export function createLLMService(options: Options): LLMService {
  switch (options.llmProvider) {
    case LLMProvider.SecretAI:
      if (!options.secretAI?.apiKey) {
        throw new Error('SecretAI API key is required');
      }
      return new SecretAIService(options.secretAI);

    case LLMProvider.DeepSeek:
      if (!options.deepSeek?.apiKey) {
        throw new Error('DeepSeek API key is required');
      }
      return new DeepSeekService({
        apiKey: options.deepSeek.apiKey,
        model: options.deepSeek.model,
      });

    default:
      throw new Error(`Unsupported LLM provider: ${options.llmProvider}`);
  }
}
