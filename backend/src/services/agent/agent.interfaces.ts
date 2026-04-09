export enum LLMProvider {
  OpenAI = 'openai',
  DeepSeek = 'deepseek',
  SecretAI = 'secretai',
}

export interface OpenAIOptions {
  apiKey: string;
  model?: string;
}

export interface DeepSeekOptions {
  apiKey: string;
  model?: string;
}

export interface SecretAIOptions {
  apiKey: string;
  baseUrl: string;
  model?: string;
}

export interface Options {
  deepSeek?: DeepSeekOptions;
  openAI?: OpenAIOptions;
  secretAI?: SecretAIOptions;
  llmProvider?: LLMProvider;
  chainId: number;
  context: QueryContext[];
}

export interface Tool<T> {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: T;
  };
}

export enum Role {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
  Tool = 'tool',
}

export interface FunctionArgs {
  contractAddress: string;
  address: string;
  session: string;
  limit: string;
  txHash: string;
  blockTag: string;
  txDetail: boolean;
  to: string;
  amount: number;
  symbol: Symbol;
  fromContractAddress: string;
  toContractAddress: string;
  name: string;
}

export enum Symbol {
  TCRO = 'TCRO',
  ETH = 'ETH',
}

export interface QueryContext {
  role: Role;
  content: string;
}

export interface AIMessageResponse {
  content: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: BlockchainFunction;
    arguments: string;
  };
}

export enum BlockchainFunction {
  TransferToken = 'transfertoken',
  GetBalance = 'getBalance',
  GetLatestBlock = 'getLatestBlock',
  GetTransactionsByAddress = 'getTransactionsByAddress',
  GetContractABI = 'getContractABI',
  GetTransactionByHash = 'getTransactionByHash',
  GetBlockByTag = 'getBlockByTag',
  GetTransactionStatus = 'getTransactionStatus',
  CreateWallet = 'createWallet',
  WrapToken = 'wrapToken',
  SwapToken = 'swapToken',
  GetCurrentTime = 'getCurrentTime',
  FunctionNotFound = 'functionNotFound',
  GetErc20Balance = 'getErc20Balance',
}

export interface BlockchainFunctionResponse<T> {
  status: Status;
  data?: T;
}

export enum Status {
  Success = 'Success',
  Failed = 'Failed',
}

export interface FunctionCallResponse {
  status: Status;
  data: object;
}
