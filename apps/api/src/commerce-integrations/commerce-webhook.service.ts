import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceCredentialsService } from './commerce-credentials.service';
import type { CommercePlatformId } from './commerce-platform.types';
import { CommerceSyncService } from './commerce-sync.service';
import { PlatformRegistryService } from './platform-registry.service';

@Injectable()
export class CommerceWebhookService {
  private readonly logger = new Logger(CommerceWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformRegistryService,
    private readonly credentials: CommerceCredentialsService,
    private readonly sync: CommerceSyncService,
  ) {}

  async receive(
    platformParam: string,
    integrationId: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
    parsedBody: unknown,
  ): Promise<{ accepted: boolean; duplicate?: boolean }> {
    const platform = platformParam.toLowerCase();
    if (!this.registry.has(platform)) {
      throw new NotFoundException('Plataforma no registrada.');
    }
    const integration = await this.prisma.commerceIntegration.findFirst({
      where: {
        id: integrationId,
        platform: platform.toUpperCase() as 'WOOCOMMERCE' | 'MAGENTO' | 'SHOPIFY' | 'PRESTASHOP',
      },
    });
    if (!integration) throw new NotFoundException('Integración no encontrada.');

    const adapter = this.registry.get(platform as CommercePlatformId);
    const creds = this.credentials.open(integration.encryptedCredentials);
    if (!adapter.verifyWebhook) {
      throw new UnauthorizedException('Esta plataforma no acepta webhooks aún.');
    }
    const verified = await adapter.verifyWebhook(headers, rawBody, creds);
    if (!verified.valid) {
      throw new UnauthorizedException('Firma de webhook inválida.');
    }

    try {
      await this.prisma.commerceWebhookEvent.create({
        data: {
          tenantId: integration.tenantId,
          integrationId: integration.id,
          externalEventId: verified.eventId,
          eventType: verified.eventType,
          payload: (parsedBody ?? {}) as Prisma.InputJsonValue,
          signatureValid: true,
          processingStatus: 'QUEUED',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { accepted: true, duplicate: true };
      }
      throw error;
    }

    const externalProductId = this.extractProductId(parsedBody);
    const execution = await this.prisma.commerceSyncExecution.create({
      data: {
        tenantId: integration.tenantId,
        integrationId: integration.id,
        syncType: 'EVENT',
        status: 'PENDING',
      },
    });
    await this.sync.enqueue({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      executionId: execution.id,
      syncType: 'EVENT',
      externalProductId: externalProductId ?? undefined,
    });
    this.logger.log(
      `Queued commerce webhook platform=${platform} integration=${integrationId}`,
    );
    return { accepted: true };
  }

  private extractProductId(body: unknown): string | null {
    if (!body || typeof body !== 'object') return null;
    const record = body as Record<string, unknown>;
    if (typeof record.id === 'number' || typeof record.id === 'string') {
      return String(record.id);
    }
    return null;
  }
}
