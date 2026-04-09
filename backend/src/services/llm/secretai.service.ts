import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { logger } from '../../helpers/logger.helper.js';
import { SecretAIModelError, SecretAIUnauthorizedError } from '../../lib/errors/service.errors.js';
import { CONTENT, TOOLS } from '../agent/agent.constants.js';
import { AIMessageResponse, FunctionCallResponse, QueryContext, Role, SecretAIOptions } from '../agent/agent.interfaces.js';
import { LLMService } from './llm.interface.js';

type OAIRole = 'system' | 'user' | 'assistant' | 'tool' | 'function';

export class SecretAIService implements LLMService {
  private client: OpenAI;
  private model: string;
  private lastAssistantMessage: AIMessageResponse | null = null;

  constructor(config: SecretAIOptions) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: `${config.baseUrl.replace(/\/$/, '')}/v1`,
    });
    this.model = config.model || 'qwen3:8b';
  }

  private mapRole(role: Role): OAIRole {
    switch (role) {
      case Role.System:
        return 'system';
      case Role.User:
        return 'user';
      case Role.Assistant:
        return 'assistant';
      case Role.Tool:
        return 'tool';
      default:
        return 'user';
    }
  }

  private createMessage(role: OAIRole, content: string): ChatCompletionMessageParam {
    return { role, content } as ChatCompletionMessageParam;
  }

  public async interpretUserQuery(query: string, context: QueryContext[]): Promise<AIMessageResponse> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        this.createMessage('system', CONTENT),
        ...context.map((ctx) => this.createMessage(this.mapRole(ctx.role), ctx.content)),
        this.createMessage('user', query),
      ];

      const chatCompletion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        tools: TOOLS,
        tool_choice: 'auto',
      });

      this.lastAssistantMessage = chatCompletion.choices[0].message as AIMessageResponse;
      return this.lastAssistantMessage;
    } catch (e) {
      if (e instanceof Error && (e.message.includes('Incorrect API key') || e.message.includes('Missing Authorization'))) {
        throw new SecretAIUnauthorizedError(`SecretAI API key is invalid. ${e.message}`);
      }
      if (e instanceof Error && e.message.includes('does not exist')) {
        throw new SecretAIModelError(`${e.message}`);
      }
      logger.error('Unknown error while interpreting user query: ', e);
      throw e;
    }
  }

  public async generateFinalResponse(
    query: string,
    functionResponses: FunctionCallResponse[],
    context: QueryContext[]
  ): Promise<string> {
    try {
      const messages: ChatCompletionMessageParam[] = [
        this.createMessage(
          'system',
          'You are a helpful blockchain assistant running privately inside a Trusted Execution Environment. Your reasoning is confidential and hardware-attested. Help users interact with the Cronos blockchain.'
        ),
        ...context.map((ctx) => this.createMessage(this.mapRole(ctx.role), ctx.content)),
        this.createMessage('user', query),
      ];

      if (this.lastAssistantMessage && this.lastAssistantMessage.tool_calls) {
        messages.push({
          role: 'assistant',
          content: this.lastAssistantMessage.content,
          tool_calls: this.lastAssistantMessage.tool_calls,
        } as ChatCompletionMessageParam);

        functionResponses.forEach((response, index) => {
          messages.push({
            role: 'tool',
            content: JSON.stringify(response.data, null, 2),
            tool_call_id: this.lastAssistantMessage?.tool_calls?.[index]?.id,
          } as ChatCompletionMessageParam);
        });
      }

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
      });

      return completion.choices[0].message.content || 'Unable to generate response';
    } catch (e) {
      logger.error('Error generating final response:', e);
      return 'Error generating final response';
    }
  }
}
