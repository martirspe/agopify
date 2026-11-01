import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import {
  CurrentUser,
  Public,
} from '../common/decorators/auth.decorators';
import type { AuthUserPayload } from '../common/types/auth-user';
import { CommerceIntegrationsService } from './commerce-integrations.service';
import { CommerceWebhookService } from './commerce-webhook.service';
import {
  ConnectCommerceIntegrationDto,
  StartCommerceSyncDto,
  UpdateCommerceSyncSettingsDto,
} from './dto/commerce-integrations.dto';

@ApiTags('commerce-integrations')
@Controller()
export class CommerceIntegrationsController {
  constructor(
    private readonly integrations: CommerceIntegrationsService,
    private readonly webhooks: CommerceWebhookService,
  ) {}

  @ApiBearerAuth()
  @Get('commerce-integrations/platforms')
  listPlatforms() {
    return this.integrations.listPlatforms();
  }

  @ApiBearerAuth()
  @Get('commerce-integrations')
  list(@CurrentUser() user: AuthUserPayload) {
    return this.integrations.list(user.tenantId);
  }

  @ApiBearerAuth()
  @Get('commerce-integrations/:id')
  get(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.integrations.get(user.tenantId, id);
  }

  @ApiBearerAuth()
  @Post('commerce-integrations/:platform/connect')
  connect(
    @CurrentUser() user: AuthUserPayload,
    @Param('platform') platform: string,
    @Body() dto: ConnectCommerceIntegrationDto,
  ) {
    return this.integrations.connect(user, platform, dto);
  }

  @ApiBearerAuth()
  @Post('commerce-integrations/:id/test')
  @HttpCode(200)
  test(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.integrations.test(user, id);
  }

  @ApiBearerAuth()
  @Delete('commerce-integrations/:id')
  disconnect(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.integrations.disconnect(user, id);
  }

  @ApiBearerAuth()
  @Patch('commerce-integrations/:id/settings')
  updateSettings(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCommerceSyncSettingsDto,
  ) {
    return this.integrations.updateSettings(user, id, dto);
  }

  @ApiBearerAuth()
  @Post('commerce-integrations/:id/sync')
  startSync(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Body() dto: StartCommerceSyncDto,
  ) {
    return this.integrations.startSync(user, id, dto.syncType ?? 'INITIAL');
  }

  @ApiBearerAuth()
  @Post('commerce-integrations/:id/sync/:executionId/retry')
  @HttpCode(200)
  retrySync(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Param('executionId') executionId: string,
  ) {
    return this.integrations.retrySync(user, id, executionId);
  }

  @ApiBearerAuth()
  @Get('commerce-integrations/:id/sync/history')
  syncHistory(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.integrations.syncHistory(user.tenantId, id);
  }

  @ApiBearerAuth()
  @Get('commerce-integrations/:id/sync/:executionId')
  syncStatus(
    @CurrentUser() user: AuthUserPayload,
    @Param('id') id: string,
    @Param('executionId') executionId: string,
  ) {
    return this.integrations.syncStatus(user.tenantId, id, executionId);
  }

  @Public()
  @Post('webhooks/commerce/:platform/:integrationId')
  @HttpCode(200)
  async webhook(
    @Param('platform') platform: string,
    @Param('integrationId') integrationId: string,
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Body() body: unknown,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
    return this.webhooks.receive(
      platform,
      integrationId,
      req.headers as Record<string, string | string[] | undefined>,
      raw,
      body,
    );
  }
}
