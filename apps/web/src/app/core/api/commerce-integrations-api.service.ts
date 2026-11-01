import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CommercePlatformDescriptor = {
  id: string;
  name: string;
  category: string;
  version: string;
  authenticationTypes: string[];
  capabilities: string[];
  connectable: boolean;
  requiredCredentialFields: string[];
  summary: string;
};

export type CommerceSyncSettings = {
  automaticSyncEnabled: boolean;
  syncProducts: boolean;
  syncVariants: boolean;
  syncInventory: boolean;
  syncPrices: boolean;
  syncImages: boolean;
  deletionPolicy: 'unpublish' | 'ignore' | 'archive';
};

export type CommerceSyncExecution = {
  id: string;
  syncType: string;
  status: string;
  totalItems: number;
  createdItems: number;
  updatedItems: number;
  unchangedItems: number;
  skippedItems?: number;
  failedItems: number;
  durationMs?: number | null;
  errorSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type CommerceIntegrationView = {
  id: string;
  platform: string;
  name: string;
  baseUrl: string | null;
  status: string;
  authenticationType?: string;
  capabilities?: string[];
  syncSettings: CommerceSyncSettings;
  externalStoreId: string | null;
  externalStoreName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  hasCredentials: boolean;
  webhookUrl: string | null;
  mappedProductCount: number;
  latestSync: CommerceSyncExecution | null;
  webhookEventCount?: number;
};

@Injectable({ providedIn: 'root' })
export class CommerceIntegrationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/commerce-integrations`;

  listPlatforms() {
    return firstValueFrom(
      this.http.get<{
        encryptionConfigured: boolean;
        platforms: CommercePlatformDescriptor[];
      }>(`${this.base}/platforms`),
    );
  }

  list() {
    return firstValueFrom(this.http.get<CommerceIntegrationView[]>(this.base));
  }

  get(id: string) {
    return firstValueFrom(this.http.get<CommerceIntegrationView>(`${this.base}/${id}`));
  }

  connect(
    platform: string,
    body: { name: string; baseUrl?: string; credentials: Record<string, string> },
  ) {
    return firstValueFrom(
      this.http.post<CommerceIntegrationView>(`${this.base}/${platform}/connect`, body),
    );
  }

  test(id: string) {
    return firstValueFrom(
      this.http.post<{ ok: boolean; integration: CommerceIntegrationView }>(
        `${this.base}/${id}/test`,
        {},
      ),
    );
  }

  updateSettings(id: string, body: Partial<CommerceSyncSettings>) {
    return firstValueFrom(
      this.http.patch<CommerceIntegrationView>(`${this.base}/${id}/settings`, body),
    );
  }

  disconnect(id: string) {
    return firstValueFrom(this.http.delete<{ ok: boolean }>(`${this.base}/${id}`));
  }

  startSync(id: string, syncType: 'INITIAL' | 'INCREMENTAL' | 'RECONCILIATION' = 'INITIAL') {
    return firstValueFrom(
      this.http.post<{ executionId: string; status: string; syncType: string }>(
        `${this.base}/${id}/sync`,
        { syncType },
      ),
    );
  }

  retrySync(id: string, executionId: string) {
    return firstValueFrom(
      this.http.post<{ executionId: string; status: string; syncType: string }>(
        `${this.base}/${id}/sync/${executionId}/retry`,
        {},
      ),
    );
  }

  syncHistory(id: string) {
    return firstValueFrom(
      this.http.get<CommerceSyncExecution[]>(`${this.base}/${id}/sync/history`),
    );
  }
}
