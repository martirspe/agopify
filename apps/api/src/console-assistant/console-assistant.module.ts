import { Module } from '@nestjs/common';
import { ConsoleAssistantController } from './console-assistant.controller';
import { ConsoleAssistantService } from './console-assistant.service';

@Module({
  controllers: [ConsoleAssistantController],
  providers: [ConsoleAssistantService],
})
export class ConsoleAssistantModule {}
