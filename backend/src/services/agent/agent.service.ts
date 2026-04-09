import {
  Block,
  Client,
  Contract,
  Token,
  Transaction,
  Wallet,
} from '@crypto.com/developer-platform-client';
import { validateFunctionArgs } from '../../helpers/agent.helpers.js';
import { DASHBOARD_API_KEY, DEVELOPER_PLATFORM_PROVIDER_URL, EXPLORER_API_KEY } from '../../helpers/constants/global.constants.js';
import { logger } from '../../helpers/logger.helper.js';
import { BaseError } from '../../lib/errors/base.error.js';
import { DeepSeekService } from '../llm/deepseek.service.js';
import { LLMService } from '../llm/llm.interface.js';
import { SecretAIService } from '../llm/secretai.service.js';
import {
  AIMessageResponse,
  BlockchainFunction,
  FunctionArgs,
  FunctionCallResponse,
  LLMProvider,
  Options,
  QueryContext,
  Role,
  Status,
} from './agent.interfaces.js';

Client.init({
  provider: DEVELOPER_PLATFORM_PROVIDER_URL,
  apiKey: DASHBOARD_API_KEY,
});

export class AIAgentService {
  private options: Options;
  private llmService: LLMService;

  constructor(options: Options) {
    this.options = options;
    this.llmService = this.initializeLLMService(options.llmProvider || LLMProvider.SecretAI);
  }

  public async interpretUserQuery(query: string, context: QueryContext[]): Promise<AIMessageResponse> {
    return this.llmService.interpretUserQuery(query, context);
  }

  public async processInterpretation(
    interpretation: AIMessageResponse,
    query: string,
    context: QueryContext[]
  ): Promise<{ functionResponses: FunctionCallResponse[]; finalResponse: string }> {
    let functionResponses: FunctionCallResponse[] = [];
    const functionsToExecute = interpretation.tool_calls;

    if (functionsToExecute) {
      functionResponses = await Promise.all(
        functionsToExecute.map(async (toolCall) => {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          return await this.executeFunction(functionName, functionArgs);
        })
      );
    }

    const finalResponse = await this.generateFinalResponse(query, functionResponses, context);
    return { functionResponses, finalResponse };
  }

  /**
   * Streaming variant of processInterpretation. Executes tool calls the
   * same way, then streams the final response via the LLM service's
   * streamFinalResponse method. Requires SecretAIService — other providers
   * don't currently expose streaming.
   */
  public async processInterpretationStreaming(
    interpretation: AIMessageResponse,
    query: string,
    context: QueryContext[],
    onToken: (token: string) => void,
    onToolsComplete?: (functionResponses: FunctionCallResponse[]) => void
  ): Promise<{ functionResponses: FunctionCallResponse[]; finalResponse: string }> {
    let functionResponses: FunctionCallResponse[] = [];
    const functionsToExecute = interpretation.tool_calls;

    if (functionsToExecute) {
      functionResponses = await Promise.all(
        functionsToExecute.map(async (toolCall) => {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          return await this.executeFunction(functionName, functionArgs);
        })
      );
    }

    if (onToolsComplete) {
      onToolsComplete(functionResponses);
    }

    const secretai = this.llmService as SecretAIService;
    if (typeof secretai.streamFinalResponse !== 'function') {
      throw new Error('Streaming is only supported when the LLM provider is SecretAI');
    }

    const finalResponse = await secretai.streamFinalResponse(
      query,
      functionResponses,
      context,
      onToken
    );
    return { functionResponses, finalResponse };
  }

  public updateContext(context: QueryContext[], query: string, response: string): QueryContext[] {
    context.push({ role: Role.User, content: query });
    context.push({ role: Role.Assistant, content: response });
    if (context.length > 10) context.shift();
    return context;
  }

  private initializeLLMService(provider: LLMProvider): LLMService {
    switch (provider) {
      case LLMProvider.SecretAI:
        if (!this.options.secretAI) {
          throw new Error('SecretAI configuration is required when using SecretAI provider');
        }
        return new SecretAIService(this.options.secretAI);
      case LLMProvider.DeepSeek:
        if (!this.options.deepSeek) {
          throw new Error('DeepSeek configuration is required when using DeepSeek provider');
        }
        return new DeepSeekService(this.options.deepSeek);
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  private async executeFunction(
    functionName: BlockchainFunction,
    functionArgs: FunctionArgs
  ): Promise<FunctionCallResponse> {
    try {
      validateFunctionArgs(functionArgs);

      switch (functionName) {
        case BlockchainFunction.GetBalance:
          return await Wallet.balance(functionArgs.address);
        case BlockchainFunction.GetLatestBlock:
          return await Block.getBlockByTag('latest');
        case BlockchainFunction.GetTransactionsByAddress:
          return {
            status: Status.Failed,
            data: { message: 'getTransactionsByAddress is not available in this SDK version' },
          };
        case BlockchainFunction.GetContractABI:
          return {
            status: Status.Failed,
            data: { message: 'getContractABI is not available in this SDK version' },
          };
        case BlockchainFunction.GetTransactionByHash:
          return await Transaction.getTransactionByHash(functionArgs.txHash);
        case BlockchainFunction.GetBlockByTag:
          return await Block.getBlockByTag(functionArgs.blockTag);
        case BlockchainFunction.GetTransactionStatus:
          return await Transaction.getTransactionStatus(functionArgs.txHash);
        case BlockchainFunction.CreateWallet:
          return Wallet.create();
        case BlockchainFunction.TransferToken:
          return await Token.transfer({
            to: functionArgs.to,
            amount: functionArgs.amount,
            contractAddress: functionArgs.contractAddress,
          });
        case BlockchainFunction.WrapToken:
          return await Token.wrap({ amount: functionArgs.amount });
        case BlockchainFunction.SwapToken:
          return await Token.swap({
            fromContractAddress: functionArgs.fromContractAddress,
            toContractAddress: functionArgs.toContractAddress,
            amount: functionArgs.amount,
          });
        case BlockchainFunction.GetCurrentTime: {
          const now = new Date();
          return {
            status: Status.Success,
            data: { localTime: now.toLocaleString(), utcTime: now.toUTCString() },
          };
        }
        case BlockchainFunction.GetErc20Balance:
          return await Token.getERC20TokenBalance(functionArgs.address, functionArgs.contractAddress);
        default:
          return {
            status: Status.Failed,
            data: { message: `Received unknown function: ${functionName}` },
          };
      }
    } catch (error: unknown) {
      if (error instanceof BaseError) {
        return {
          status: Status.Failed,
          data: { message: `Error during execution: ${error.message}` },
        };
      }
      logger.error('Unknown error during execution: ', error);
      return {
        status: Status.Failed,
        data: { message: error instanceof Error ? error.message : 'Unknown error during execution' },
      };
    }
  }

  private async generateFinalResponse(
    query: string,
    functionResponses: FunctionCallResponse[],
    context: QueryContext[]
  ): Promise<string> {
    return this.llmService.generateFinalResponse(query, functionResponses, context);
  }
}
