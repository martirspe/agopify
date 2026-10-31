import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { SalesAgentRuntimeService } from './sales-agent-runtime.service';
import { SalesAgentToolsService } from './sales-agent-tools.service';
import { SalesInfrastructureModule } from './sales-infrastructure.module';
import { SalesToolRegistry } from './sales-tool-registry.service';
import { SalesEngineController } from './sales-engine.controller';
import { SalesEngineOpsService } from './sales-engine-ops.service';
import { AI_MODEL_PROVIDERS } from './models/ai-model.provider';
import { AiModelRouter } from './models/ai-model.router';
import { OpenAiChatProvider } from './models/openai-chat.provider';

@Module({
  imports: [
    OrdersModule,
    PaymentsModule,
    KnowledgeModule,
    SalesInfrastructureModule,
  ],
  controllers: [SalesEngineController],
  providers: [
    OpenAiChatProvider,
    {
      provide: AI_MODEL_PROVIDERS,
      useFactory: (openai: OpenAiChatProvider) => [openai],
      inject: [OpenAiChatProvider],
    },
    AiModelRouter,
    SalesAgentRuntimeService,
    SalesAgentToolsService,
    SalesToolRegistry,
    SalesEngineOpsService,
  ],
  exports: [SalesAgentRuntimeService, SalesAgentToolsService, AiModelRouter],
})
export class AgentRuntimeModule {}
