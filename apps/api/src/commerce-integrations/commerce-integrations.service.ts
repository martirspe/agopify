import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommerceAuthType,
  CommercePlatform,
  Prisma,
} from '@prisma/client';
import { assertManager } from '../common/roles';
import type { AuthUserPayload } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CommerceCredentialsService } from './commerce-credentials.service';
import type { CommercePlatformId } from './commerce-platform.types';
import { CommerceSyncService } from './commerce-sync.service';
import { PlatformRegistryService } from './platform-registry.service';
import { assertSafeStoreBaseUrl, storeOrigin } from './safe-store-url';

const PLATFORM_ENUM: Record<CommercePlatformId, CommercePlatform> = {
  magento: 'MAGENTO',
  woocommerce: 'WOOCOMMERCE',
  shopify: 'SHOPIFY',
  prestashop: 'PRESTASHOP',
};

const AUTH_ENUM: Record<string, CommerceAuthType> = {
  oauth2: 'OAUTH2',
  oauth1a: 'OAUTH1A',
  api_token: 'API_TOKEN',
  api_key: 'API_KEY',
  basic: 'BASIC',
};

type SyncSettings = {
  automaticSyncEnabled: boolean;
  syncProducts: boolean;
  syncVariants: boolean;
  syncInventory: boolean;
  syncPrices: boolean;
  syncImages: boolean;
  deletionPolicy: 'unpublish' | 'ignore' | 'archive';
};

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  automaticSyncEnabled: true,
  syncProducts: true,
  syncVariants: true,
  syncInventory: true,
  syncPrices: true,
  syncImages: true,
  deletionPolicy: 'unpublish',
};

@Injectable()
export class CommerceIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformRegistryService,
    private readonly credentials: CommerceCredentialsService,
    private readonly sync: CommerceSyncService,
    private readonly config: ConfigService,
  ) {}

  listPlatforms() {
    return {
      encryptionConfigured: this.credentials.configured,
      platforms: this.registry.list(),
    };
  }

  async list(tenantId: string) {
    const rows = await this.prisma.commerceIntegration.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const counts = await this.prisma.commerceIntegrationResource.groupBy({
      by: ['integrationId'],
      where: { tenantId, resourceType: 'PRODUCT', internalId: { not: null } },
      _count: { _all: true },
    });
    const countById = new Map(
      counts.map((row) => [row.integrationId, row._count._all]),
    );
    const latestByIntegration = await this.latestSyncByIntegration(
      tenantId,
      rows.map((row) => row.id),
    );
    return rows.map((row) =>
      this.toView(row, {
        mappedProductCount: countById.get(row.id) ?? 0,
        latestSync: latestByIntegration.get(row.id) ?? null,
      }),
    );
  }

  async get(tenantId: string, id: string) {
    const row = await this.require(tenantId, id);
    const mappedProductCount = await this.prisma.commerceIntegrationResource.count({
      where: {
        tenantId,
        integrationId: id,
        resourceType: 'PRODUCT',
        internalId: { not: null },
      },
    });
    const latest = await this.prisma.commerceSyncExecution.findFirst({
      where: { tenantId, integrationId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        syncType: true,
        status: true,
        totalItems: true,
        createdItems: true,
        updatedItems: true,
        failedItems: true,
        completedAt: true,
        startedAt: true,
        errorSummary: true,
        createdAt: true,
      },
    });
    const webhookEventCount = await this.prisma.commerceWebhookEvent.count({
      where: { tenantId, integrationId: id },
    });
    return {
      ...this.toView(row, {
        mappedProductCount,
        latestSync: latest,
      }),
      webhookEventCount,
      syncSettings: this.readSettings(row.syncSettings),
    };
  }

  async connect(
    user: AuthUserPayload,
    platformParam: string,
    dto: {
      name: string;
      baseUrl?: string;
      credentials: Record<string, string>;
    },
  ) {
    assertManager(user, 'Solo el dueño o un administrador puede conectar integraciones.');
    if (!this.credentials.configured) {
      throw new BadRequestException(
        'Las integraciones de comercio no están configuradas en este entorno.',
      );
    }
    const platform = platformParam.toLowerCase();
    if (!this.registry.has(platform)) {
      throw new NotFoundException('Plataforma no registrada.');
    }
    const adapter = this.registry.get(platform);
    if (!adapter.descriptor.connectable) {
      throw new BadRequestException(
        `El conector de ${adapter.descriptor.name} aún no está disponible para activar.`,
      );
    }

    const credentials = { ...dto.credentials };
    if (dto.baseUrl) credentials.baseUrl = dto.baseUrl;
    for (const field of adapter.descriptor.requiredCredentialFields) {
      if (!credentials[field]?.trim()) {
        throw new BadRequestException(`Falta el campo requerido: ${field}.`);
      }
    }

    let baseUrl: string | null = null;
    if (credentials.baseUrl) {
      const safe = await assertSafeStoreBaseUrl(credentials.baseUrl);
      baseUrl = storeOrigin(safe);
      credentials.baseUrl = baseUrl;
    }

    let validation;
    try {
      validation = await adapter.validateConnection(credentials, baseUrl);
    } catch {
      throw new BadRequestException(
        'No pudimos validar la conexión con la tienda. Revisa la URL y las credenciales.',
      );
    }
    if (!validation.ok) {
      throw new BadRequestException(
        validation.message || 'No pudimos validar la conexión con la tienda.',
      );
    }

    const sealed = this.credentials.seal(credentials);
    const authType =
      AUTH_ENUM[adapter.descriptor.authenticationTypes[0]] ?? 'API_TOKEN';

    try {
      const created = await this.prisma.commerceIntegration.create({
        data: {
          tenantId: user.tenantId,
          platform: PLATFORM_ENUM[platform],
          name: dto.name.trim(),
          baseUrl,
          status: 'CONNECTED',
          authenticationType: authType,
          encryptedCredentials: sealed,
          capabilities: adapter.descriptor.capabilities,
          externalStoreId: validation.storeId ?? null,
          externalStoreName: validation.storeName ?? null,
          connectedAt: new Date(),
          configuration: {},
          syncSettings: DEFAULT_SYNC_SETTINGS,
        },
      });
      return this.toView(created, { mappedProductCount: 0, latestSync: null });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una integración con ese nombre para esta plataforma.',
        );
      }
      throw error;
    }
  }

  async test(user: AuthUserPayload, id: string) {
    assertManager(user, 'Solo el dueño o un administrador puede probar integraciones.');
    const row = await this.require(user.tenantId, id);
    const platform = row.platform.toLowerCase() as CommercePlatformId;
    const adapter = this.registry.get(platform);
    const credentials = this.credentials.open(row.encryptedCredentials);
    let result;
    try {
      result = await adapter.validateConnection(credentials, row.baseUrl);
    } catch {
      throw new BadRequestException(
        'No pudimos contactar la tienda. Revisa la URL y las credenciales.',
      );
    }
    if (!result.ok) {
      await this.prisma.commerceIntegration.update({
        where: { id: row.id },
        data: {
          status: 'ERROR',
          lastError: result.message ?? 'Conexión inválida',
        },
      });
      throw new BadRequestException(result.message || 'La conexión falló.');
    }
    const updated = await this.prisma.commerceIntegration.update({
      where: { id: row.id },
      data: {
        status: 'CONNECTED',
        lastError: null,
        externalStoreId: result.storeId ?? row.externalStoreId,
        externalStoreName: result.storeName ?? row.externalStoreName,
      },
    });
    return {
      ok: true,
      integration: this.toView(updated, {
        mappedProductCount: await this.mappedCount(user.tenantId, id),
        latestSync: null,
      }),
    };
  }

  async updateSettings(
    user: AuthUserPayload,
    id: string,
    patch: Partial<SyncSettings>,
  ) {
    assertManager(user, 'Solo el dueño o un administrador puede cambiar la sincronización.');
    const row = await this.require(user.tenantId, id);
    const current = this.readSettings(row.syncSettings);
    const next: SyncSettings = {
      ...current,
      ...Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ),
    };
    const updated = await this.prisma.commerceIntegration.update({
      where: { id: row.id },
      data: { syncSettings: next },
    });
    return {
      ...this.toView(updated, {
        mappedProductCount: await this.mappedCount(user.tenantId, id),
        latestSync: null,
      }),
      syncSettings: next,
    };
  }

  async disconnect(user: AuthUserPayload, id: string) {
    assertManager(user, 'Solo el dueño o un administrador puede desconectar integraciones.');
    const row = await this.require(user.tenantId, id);
    const platform = row.platform.toLowerCase() as CommercePlatformId;
    const adapter = this.registry.get(platform);
    const credentials = this.credentials.open(row.encryptedCredentials);
    await adapter.disconnect({
      tenantId: row.tenantId,
      integrationId: row.id,
      baseUrl: row.baseUrl,
      credentials,
      configuration: {},
    });
    await this.prisma.commerceIntegration.delete({ where: { id: row.id } });
    return { ok: true };
  }

  async startSync(
    user: AuthUserPayload,
    id: string,
    syncType: 'INITIAL' | 'INCREMENTAL' | 'RECONCILIATION' = 'INITIAL',
  ) {
    assertManager(user, 'Solo el dueño o un administrador puede sincronizar.');
    const row = await this.require(user.tenantId, id);
    if (!['CONNECTED', 'ERROR', 'SYNCING'].includes(row.status)) {
      throw new BadRequestException('La integración no está lista para sincronizar.');
    }
    const execution = await this.prisma.commerceSyncExecution.create({
      data: {
        tenantId: user.tenantId,
        integrationId: row.id,
        syncType,
        status: 'PENDING',
      },
    });
    await this.sync.enqueue({
      tenantId: user.tenantId,
      integrationId: row.id,
      executionId: execution.id,
      syncType,
    });
    return {
      executionId: execution.id,
      status: execution.status,
      syncType,
    };
  }

  async retrySync(user: AuthUserPayload, id: string, executionId: string) {
    assertManager(user, 'Solo el dueño o un administrador puede reintentar una sincronización.');
    const row = await this.require(user.tenantId, id);
    const previous = await this.prisma.commerceSyncExecution.findFirst({
      where: { id: executionId, tenantId: user.tenantId, integrationId: id },
    });
    if (!previous) throw new NotFoundException('Ejecución no encontrada.');
    if (!['FAILED', 'PARTIAL'].includes(previous.status)) {
      throw new BadRequestException('Solo se pueden reintentar ejecuciones fallidas o parciales.');
    }
    return this.startSync(
      user,
      row.id,
      previous.syncType as 'INITIAL' | 'INCREMENTAL' | 'RECONCILIATION',
    );
  }

  async syncHistory(tenantId: string, id: string) {
    await this.require(tenantId, id);
    return this.prisma.commerceSyncExecution.findMany({
      where: { tenantId, integrationId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        completedAt: true,
        durationMs: true,
        totalItems: true,
        createdItems: true,
        updatedItems: true,
        unchangedItems: true,
        skippedItems: true,
        failedItems: true,
        errorSummary: true,
        createdAt: true,
      },
    });
  }

  async syncStatus(tenantId: string, id: string, executionId: string) {
    await this.require(tenantId, id);
    const execution = await this.prisma.commerceSyncExecution.findFirst({
      where: { id: executionId, tenantId, integrationId: id },
    });
    if (!execution) throw new NotFoundException('Ejecución no encontrada.');
    return execution;
  }

  private async mappedCount(tenantId: string, integrationId: string) {
    return this.prisma.commerceIntegrationResource.count({
      where: {
        tenantId,
        integrationId,
        resourceType: 'PRODUCT',
        internalId: { not: null },
      },
    });
  }

  private async latestSyncByIntegration(tenantId: string, ids: string[]) {
    const map = new Map<
      string,
      {
        id: string;
        syncType: string;
        status: string;
        totalItems: number;
        createdItems: number;
        updatedItems: number;
        failedItems: number;
        completedAt: Date | null;
        startedAt: Date | null;
        errorSummary: string | null;
        createdAt: Date;
      }
    >();
    if (!ids.length) return map;
    const rows = await this.prisma.commerceSyncExecution.findMany({
      where: { tenantId, integrationId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        integrationId: true,
        syncType: true,
        status: true,
        totalItems: true,
        createdItems: true,
        updatedItems: true,
        failedItems: true,
        completedAt: true,
        startedAt: true,
        errorSummary: true,
        createdAt: true,
      },
    });
    for (const row of rows) {
      if (!map.has(row.integrationId)) {
        map.set(row.integrationId, row);
      }
    }
    return map;
  }

  private readSettings(value: unknown): SyncSettings {
    const raw = (value && typeof value === 'object' ? value : {}) as Partial<SyncSettings>;
    return {
      automaticSyncEnabled: raw.automaticSyncEnabled ?? DEFAULT_SYNC_SETTINGS.automaticSyncEnabled,
      syncProducts: raw.syncProducts ?? DEFAULT_SYNC_SETTINGS.syncProducts,
      syncVariants: raw.syncVariants ?? DEFAULT_SYNC_SETTINGS.syncVariants,
      syncInventory: raw.syncInventory ?? DEFAULT_SYNC_SETTINGS.syncInventory,
      syncPrices: raw.syncPrices ?? DEFAULT_SYNC_SETTINGS.syncPrices,
      syncImages: raw.syncImages ?? DEFAULT_SYNC_SETTINGS.syncImages,
      deletionPolicy: raw.deletionPolicy ?? DEFAULT_SYNC_SETTINGS.deletionPolicy,
    };
  }

  private webhookUrl(platform: string, integrationId: string): string | null {
    if (platform !== 'WOOCOMMERCE') return null;
    const base = (
      this.config.get<string>('PUBLIC_API_BASE_URL') ?? 'http://localhost:3000/api/v1'
    ).replace(/\/$/, '');
    return `${base}/webhooks/commerce/woocommerce/${integrationId}`;
  }

  private async require(tenantId: string, id: string) {
    const row = await this.prisma.commerceIntegration.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Integración no encontrada.');
    return row;
  }

  private toView(
    row: {
      id: string;
      platform: CommercePlatform;
      name: string;
      baseUrl: string | null;
      status: string;
      authenticationType: CommerceAuthType;
      capabilities: unknown;
      syncSettings?: unknown;
      externalStoreId: string | null;
      externalStoreName: string | null;
      connectedAt: Date | null;
      lastSyncAt: Date | null;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
    },
    extras: {
      mappedProductCount: number;
      latestSync: {
        id: string;
        syncType: string;
        status: string;
        totalItems: number;
        createdItems: number;
        updatedItems: number;
        failedItems: number;
        completedAt: Date | null;
        startedAt: Date | null;
        errorSummary: string | null;
        createdAt: Date;
      } | null;
    },
  ) {
    return {
      id: row.id,
      platform: row.platform.toLowerCase(),
      name: row.name,
      baseUrl: row.baseUrl,
      status: row.status,
      authenticationType: row.authenticationType,
      capabilities: row.capabilities,
      syncSettings: this.readSettings(row.syncSettings),
      externalStoreId: row.externalStoreId,
      externalStoreName: row.externalStoreName,
      connectedAt: row.connectedAt,
      lastSyncAt: row.lastSyncAt,
      lastError: row.lastError,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      hasCredentials: true,
      webhookUrl: this.webhookUrl(row.platform, row.id),
      mappedProductCount: extras.mappedProductCount,
      latestSync: extras.latestSync,
    };
  }
}
