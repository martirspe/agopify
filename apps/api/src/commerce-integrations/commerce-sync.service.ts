import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSyncWriterService } from './catalog-sync-writer.service';
import { CommerceCredentialsService } from './commerce-credentials.service';
import type { CommercePlatformId } from './commerce-platform.types';
import { PlatformRegistryService } from './platform-registry.service';

type SyncJob = {
  tenantId: string;
  integrationId: string;
  executionId: string;
  syncType: 'INITIAL' | 'INCREMENTAL' | 'EVENT' | 'RECONCILIATION';
  externalProductId?: string;
};

const QUEUE = 'commerce-integration-sync';

@Injectable()
export class CommerceSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommerceSyncService.name);
  private queue?: Queue<SyncJob>;
  private worker?: Worker<SyncJob>;
  private redis: Redis | null = null;
  private connection: ConnectionOptions | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly credentials: CommerceCredentialsService,
    private readonly registry: PlatformRegistryService,
    private readonly writer: CatalogSyncWriterService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('NODE_ENV') === 'test') return;
    const url = this.config.get<string>('REDIS_URL');
    if (!url) return;
    const parsed = new URL(url);
    this.connection = {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      db: Number(parsed.pathname.slice(1) || 0),
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    };
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on('error', () =>
      this.logger.warn('Commerce sync Redis unavailable'),
    );
    this.queue = new Queue<SyncJob>(QUEUE, {
      connection: { ...this.connection, maxRetriesPerRequest: 1 },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: { count: 200 },
      },
    });
    this.worker = new Worker<SyncJob>(QUEUE, (job) => this.process(job), {
      connection: this.connection,
      concurrency: 2,
    });
    this.worker.on('error', () =>
      this.logger.warn('Commerce sync worker unavailable'),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this.redis?.disconnect();
  }

  async enqueue(job: SyncJob): Promise<void> {
    if (this.queue) {
      await this.queue.add(`${job.syncType}:${job.executionId}`, job, {
        jobId: job.executionId,
      });
      return;
    }
    // Without Redis (local/dev), run inline so connect→sync still works.
    await this.process({ data: job } as Job<SyncJob>);
  }

  private async process(job: Job<SyncJob>): Promise<void> {
    const { tenantId, integrationId, executionId, syncType, externalProductId } =
      job.data;
    const startedAt = new Date();
    await this.prisma.commerceSyncExecution.updateMany({
      where: { id: executionId, tenantId },
      data: { status: 'RUNNING', startedAt },
    });
    await this.prisma.commerceIntegration.updateMany({
      where: { id: integrationId, tenantId },
      data: { status: 'SYNCING', lastError: null },
    });

    try {
      const integration = await this.prisma.commerceIntegration.findFirst({
        where: { id: integrationId, tenantId },
      });
      if (!integration) throw new Error('integration missing');

      const platform = integration.platform.toLowerCase() as CommercePlatformId;
      const adapter = this.registry.get(platform);
      const creds = this.credentials.open(integration.encryptedCredentials);
      const context = {
        tenantId,
        integrationId,
        baseUrl: integration.baseUrl,
        credentials: creds,
        configuration: (integration.configuration ?? {}) as Record<string, unknown>,
      };

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let failed = 0;
      let total = 0;
      let checkpoint: Record<string, unknown> = {};

      if (syncType === 'EVENT' && externalProductId) {
        const external = await adapter.fetchProductById(context, externalProductId);
        if (external) {
          total = 1;
          const normalized = adapter.normalizeProduct(external, {
            tenantId,
            integrationId,
          });
          const result = await this.writer.upsertNormalizedProduct(
            tenantId,
            integrationId,
            normalized,
          );
          if (result.operation === 'created') created += 1;
          else if (result.operation === 'updated') updated += 1;
          else unchanged += 1;
        }
      } else {
        let cursor: string | null = null;
        let pages = 0;
        const updatedSince =
          syncType === 'INCREMENTAL' && integration.lastSyncAt
            ? integration.lastSyncAt.toISOString()
            : null;
        do {
          const page = await adapter.fetchProducts(context, {
            cursor,
            pageSize: 50,
            updatedSince,
          });
          for (const item of page.items) {
            total += 1;
            try {
              const normalized = adapter.normalizeProduct(item, {
                tenantId,
                integrationId,
              });
              const result = await this.writer.upsertNormalizedProduct(
                tenantId,
                integrationId,
                normalized,
              );
              if (result.operation === 'created') created += 1;
              else if (result.operation === 'updated') updated += 1;
              else unchanged += 1;
            } catch (error) {
              failed += 1;
              this.logger.warn(
                `Sync item failed integration=${integrationId} external=${item.id}`,
              );
              void error;
            }
          }
          cursor = page.nextCursor ?? null;
          checkpoint = { cursor, pages: ++pages };
          if (pages >= 200) break;
        } while (cursor);
      }

      const completedAt = new Date();
      const status =
        failed > 0 && created + updated + unchanged > 0
          ? 'PARTIAL'
          : failed > 0
            ? 'FAILED'
            : 'COMPLETED';
      await this.prisma.commerceSyncExecution.update({
        where: { id: executionId },
        data: {
          status,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          totalItems: total,
          createdItems: created,
          updatedItems: updated,
          unchangedItems: unchanged,
          failedItems: failed,
          checkpoint: checkpoint as Prisma.InputJsonValue,
          errorSummary: failed ? `${failed} productos con error` : null,
        },
      });
      await this.prisma.commerceIntegration.updateMany({
        where: { id: integrationId, tenantId },
        data: {
          status: status === 'FAILED' ? 'ERROR' : 'CONNECTED',
          lastSyncAt: completedAt,
          lastError: status === 'FAILED' ? `${failed} productos con error` : null,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error de sincronización';
      await this.prisma.commerceSyncExecution.updateMany({
        where: { id: executionId, tenantId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorSummary: message.slice(0, 500),
        },
      });
      await this.prisma.commerceIntegration.updateMany({
        where: { id: integrationId, tenantId },
        data: { status: 'ERROR', lastError: message.slice(0, 500) },
      });
      throw error;
    }
  }
}
