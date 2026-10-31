/** Task labels used by the model router (not vendor-specific). */
export type AiModelTask =
  | 'sales_reply'
  | 'structured_json'
  | 'intent_classification'
  | 'memory_summarization'
  | 'response_validation';

export type AiChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type AiChatMessage = {
  role: AiChatRole | string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export type AiToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiGenerateRequest = {
  task: AiModelTask;
  model?: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** When true, ask the provider for a JSON object response if supported. */
  jsonObject?: boolean;
  tools?: AiToolDefinition[];
  toolChoice?: 'auto' | 'none';
  parallelToolCalls?: boolean;
  timeoutMs?: number;
  /** OpenAI-compatible bearer key override; otherwise the adapter reads env. */
  apiKey?: string;
};

export type AiGenerateUsage = {
  promptTokens?: number;
  completionTokens?: number;
  cachedPromptTokens?: number;
};

export type AiGenerateResult = {
  message: AiChatMessage;
  usage?: AiGenerateUsage;
  provider: string;
  model: string;
  /** True when the reply came from the fallback provider (scenario L). */
  degraded?: boolean;
};

export type AiModelCapabilities = {
  provider: string;
  chat: boolean;
  structuredJson: boolean;
  tools: boolean;
  streaming: boolean;
};
