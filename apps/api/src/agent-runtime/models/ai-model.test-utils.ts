import { ConfigService } from '@nestjs/config';
import { AiModelRouter } from './ai-model.router';
import { OpenAiChatProvider } from './openai-chat.provider';

/** Builds the production provider map for unit tests that spy on global fetch. */
export function createTestAiModelRouter(config: ConfigService): AiModelRouter {
  return new AiModelRouter(config, [new OpenAiChatProvider(config)]);
}
