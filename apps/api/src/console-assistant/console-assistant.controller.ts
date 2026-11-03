import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Patch,
  PipeTransform,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/auth.decorators';
import type { AuthUserPayload } from '../common/types/auth-user';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import { ConsoleAssistantService } from './console-assistant.service';
import {
  CONSOLE_ASSISTANT_CONVERSATION_ID,
  ImportConsoleAssistantConversationsDto,
  RenameConsoleAssistantConversationDto,
  UpdateConsoleAssistantPreferencesDto,
  UpsertConsoleAssistantConversationDto,
} from './dto/console-assistant.dto';

@Injectable()
class ConversationIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!CONSOLE_ASSISTANT_CONVERSATION_ID.test(value ?? '')) {
      throw new BadRequestException('Identificador de conversación no válido.');
    }
    return value;
  }
}

@ApiTags('console-assistant')
@ApiBearerAuth()
@Controller('console-assistant')
export class ConsoleAssistantController {
  constructor(private readonly assistant: ConsoleAssistantService) {}

  @Get()
  state(@CurrentUser() user: AuthUserPayload) {
    return this.assistant.getState(user.userId, user.tenantId);
  }

  @RateLimit('console-assistant-prefs', 30)
  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateConsoleAssistantPreferencesDto,
  ) {
    return this.assistant.updatePreferences(user.userId, user.tenantId, dto);
  }

  @RateLimit('console-assistant-import', 5)
  @Post('conversations/import')
  importConversations(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ImportConsoleAssistantConversationsDto,
  ) {
    return this.assistant.importConversations(user.userId, user.tenantId, dto);
  }

  @RateLimit('console-assistant-write', 60)
  @Put('conversations/:id')
  upsertConversation(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ConversationIdPipe) id: string,
    @Body() dto: UpsertConsoleAssistantConversationDto,
  ) {
    return this.assistant.upsertConversation(user.userId, user.tenantId, id, dto);
  }

  @RateLimit('console-assistant-write', 60)
  @Patch('conversations/:id')
  renameConversation(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ConversationIdPipe) id: string,
    @Body() dto: RenameConsoleAssistantConversationDto,
  ) {
    return this.assistant.renameConversation(user.userId, user.tenantId, id, dto);
  }

  @RateLimit('console-assistant-write', 60)
  @Delete('conversations/:id')
  @HttpCode(204)
  deleteConversation(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ConversationIdPipe) id: string,
  ) {
    return this.assistant.deleteConversation(user.userId, user.tenantId, id);
  }
}
