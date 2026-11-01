import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DsButtonComponent,
  DsConfirmService,
  DsDisclosureComponent,
  DsEmptyStateComponent,
  DsFormSectionComponent,
  DsIconComponent,
  DsPageHeaderComponent,
  DsSelectComponent,
} from '@vendedoria/ui';
import { messageFrom } from '../../core/api/api-error';
import {
  CommerceIntegrationView,
  CommerceIntegrationsApiService,
  CommercePlatformDescriptor,
  CommerceSyncExecution,
} from '../../core/api/commerce-integrations-api.service';
import { AuthApiService } from '../../core/auth/auth-api.service';

type Panel = 'overview' | 'sync' | 'connect' | 'upcoming';
type SyncKind = 'INITIAL' | 'INCREMENTAL' | 'RECONCILIATION';
type ConnectablePlatform = 'magento' | 'woocommerce';

@Component({
  selector: 'app-commerce-integrations-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    DsButtonComponent,
    DsDisclosureComponent,
    DsEmptyStateComponent,
    DsFormSectionComponent,
    DsIconComponent,
    DsPageHeaderComponent,
    DsSelectComponent,
  ],
  templateUrl: './commerce-integrations.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommerceIntegrationsPage {
  private readonly api = inject(CommerceIntegrationsApiService);
  private readonly auth = inject(AuthApiService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmDialog = inject(DsConfirmService);

  readonly canManage = () => this.auth.isManager();
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly busy = signal(false);
  readonly operation = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly encryptionConfigured = signal(false);
  readonly platforms = signal<CommercePlatformDescriptor[]>([]);
  readonly connections = signal<CommerceIntegrationView[]>([]);
  readonly history = signal<CommerceSyncExecution[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly panel = signal<Panel>('overview');
  readonly platformChoice = signal<ConnectablePlatform>('magento');
  readonly syncKind = signal<SyncKind>('INITIAL');
  readonly copied = signal(false);
  readonly detail = signal<CommerceIntegrationView | null>(null);

  readonly connectable = computed(() =>
    this.platforms().filter((platform) => platform.connectable),
  );
  readonly upcoming = computed(() =>
    this.platforms().filter((platform) => !platform.connectable),
  );
  readonly selected = computed(() => {
    const id = this.selectedId();
    return this.connections().find((item) => item.id === id) ?? this.detail();
  });
  readonly mappedTotal = computed(() =>
    this.connections().reduce((sum, item) => sum + (item.mappedProductCount || 0), 0),
  );
  readonly connectedCount = computed(
    () => this.connections().filter((item) => item.status === 'CONNECTED' || item.status === 'SYNCING').length,
  );
  readonly errorCount = computed(
    () => this.connections().filter((item) => item.status === 'ERROR').length,
  );
  readonly selectedPlatform = computed(() =>
    this.platforms().find((platform) => platform.id === this.platformChoice()) ?? null,
  );

  readonly form = this.fb.nonNullable.group({
    name: ['Tienda principal', [Validators.required, Validators.minLength(2)]],
    baseUrl: ['', [Validators.required, Validators.pattern(/^https:\/\/.+/i)]],
    accessToken: [''],
    consumerKey: [''],
    consumerSecret: [''],
    webhookSecret: [''],
  });

  readonly settingsForm = this.fb.nonNullable.group({
    automaticSyncEnabled: [true],
    syncProducts: [true],
    syncVariants: [true],
    syncInventory: [true],
    syncPrices: [true],
    syncImages: [true],
    deletionPolicy: this.fb.nonNullable.control<'unpublish' | 'ignore' | 'archive'>(
      'unpublish',
    ),
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set(null);
    try {
      const [platforms, connections] = await Promise.all([
        this.api.listPlatforms(),
        this.api.list(),
      ]);
      this.encryptionConfigured.set(platforms.encryptionConfigured);
      this.platforms.set(platforms.platforms);
      this.connections.set(connections);
      const selected =
        this.selectedId() && connections.some((item) => item.id === this.selectedId())
          ? this.selectedId()
          : connections[0]?.id ?? null;
      this.selectedId.set(selected);
      if (selected) {
        await this.loadDetail(selected);
      } else {
        this.detail.set(null);
        this.history.set([]);
        if (this.panel() !== 'connect' && this.panel() !== 'upcoming') {
          this.panel.set('connect');
        }
      }
    } catch {
      this.loadFailed.set(true);
      this.errorMessage.set('No pudimos cargar las integraciones de catálogo.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadDetail(id: string): Promise<void> {
    const [detail, history] = await Promise.all([
      this.api.get(id),
      this.api.syncHistory(id),
    ]);
    this.detail.set(detail);
    this.history.set(history);
    this.settingsForm.reset(detail.syncSettings);
    this.settingsForm.markAsPristine();
  }

  openPanel(panel: Panel): void {
    this.panel.set(panel);
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  choosePlatform(id: ConnectablePlatform): void {
    this.platformChoice.set(id);
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  setSyncKind(value: string): void {
    if (value === 'INITIAL' || value === 'INCREMENTAL' || value === 'RECONCILIATION') {
      this.syncKind.set(value);
    }
  }

  async select(connection: CommerceIntegrationView): Promise<void> {
    this.selectedId.set(connection.id);
    this.panel.set('overview');
    this.busy.set(true);
    try {
      await this.loadDetail(connection.id);
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'No pudimos cargar el detalle.'));
    } finally {
      this.busy.set(false);
    }
  }

  async test(connection: CommerceIntegrationView): Promise<void> {
    this.selectedId.set(connection.id);
    await this.testSelected();
  }

  async sync(connection: CommerceIntegrationView): Promise<void> {
    this.selectedId.set(connection.id);
    await this.syncSelected();
  }

  async disconnect(connection: CommerceIntegrationView): Promise<void> {
    this.selectedId.set(connection.id);
    await this.disconnectSelected();
  }

  fieldError(control: 'name' | 'baseUrl' | 'accessToken' | 'consumerKey' | 'consumerSecret'): string | null {
    const field = this.form.controls[control];
    if (!field.touched || !field.invalid) return null;
    if (field.hasError('required') || field.hasError('minlength')) return 'Este campo es obligatorio.';
    if (field.hasError('pattern')) return 'Usa una URL HTTPS válida.';
    return 'Revisa este campo.';
  }

  async connect(): Promise<void> {
    if (!this.canManage() || this.busy() || !this.encryptionConfigured()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Revisa los campos marcados.');
      return;
    }
    const values = this.form.getRawValue();
    const platform = this.platformChoice();
    const credentials: Record<string, string> = { baseUrl: values.baseUrl.trim() };
    if (platform === 'magento') {
      if (!values.accessToken.trim()) {
        this.form.controls.accessToken.markAsTouched();
        this.errorMessage.set('El token de acceso de Magento es obligatorio.');
        return;
      }
      credentials['accessToken'] = values.accessToken.trim();
    } else {
      if (!values.consumerKey.trim() || !values.consumerSecret.trim()) {
        this.form.controls.consumerKey.markAsTouched();
        this.form.controls.consumerSecret.markAsTouched();
        this.errorMessage.set('La clave y el secreto de WooCommerce son obligatorios.');
        return;
      }
      credentials['consumerKey'] = values.consumerKey.trim();
      credentials['consumerSecret'] = values.consumerSecret.trim();
      if (values.webhookSecret.trim()) {
        credentials['webhookSecret'] = values.webhookSecret.trim();
      }
    }
    this.busy.set(true);
    this.operation.set('connect');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const created = await this.api.connect(platform, {
        name: values.name.trim(),
        baseUrl: values.baseUrl.trim(),
        credentials,
      });
      this.successMessage.set(`${created.name} conectada y verificada.`);
      this.form.patchValue({
        accessToken: '',
        consumerKey: '',
        consumerSecret: '',
        webhookSecret: '',
      });
      this.form.markAsPristine();
      this.selectedId.set(created.id);
      this.panel.set('overview');
      await this.load();
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'No pudimos conectar la tienda.'));
    } finally {
      this.busy.set(false);
      this.operation.set(null);
    }
  }

  async syncSelected(): Promise<void> {
    const connection = this.selected();
    if (!connection || !this.canManage() || this.busy()) return;
    this.busy.set(true);
    this.operation.set('sync');
    this.errorMessage.set(null);
    try {
      await this.api.startSync(connection.id, this.syncKind());
      this.successMessage.set(
        this.syncKind() === 'INITIAL'
          ? 'Importación inicial en curso.'
          : this.syncKind() === 'INCREMENTAL'
            ? 'Sincronización incremental en curso.'
            : 'Reconciliación en curso.',
      );
      await this.load();
      this.selectedId.set(connection.id);
      this.panel.set('sync');
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'No pudimos iniciar la sincronización.'));
    } finally {
      this.busy.set(false);
      this.operation.set(null);
    }
  }

  async retry(execution: CommerceSyncExecution): Promise<void> {
    const connection = this.selected();
    if (!connection || !this.canManage() || this.busy()) return;
    this.busy.set(true);
    this.operation.set('retry');
    try {
      await this.api.retrySync(connection.id, execution.id);
      this.successMessage.set('Reintento encolado.');
      await this.loadDetail(connection.id);
      await this.load();
      this.selectedId.set(connection.id);
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'No pudimos reintentar la sincronización.'));
    } finally {
      this.busy.set(false);
      this.operation.set(null);
    }
  }

  async testSelected(): Promise<void> {
    const connection = this.selected();
    if (!connection || !this.canManage() || this.busy()) return;
    this.busy.set(true);
    this.operation.set('test');
    try {
      await this.api.test(connection.id);
      this.successMessage.set('Conexión verificada correctamente.');
      await this.load();
      this.selectedId.set(connection.id);
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'La prueba de conexión falló.'));
    } finally {
      this.busy.set(false);
      this.operation.set(null);
    }
  }

  async saveSettings(): Promise<void> {
    const connection = this.selected();
    if (!connection || !this.canManage() || this.busy() || this.settingsForm.pristine) return;
    this.busy.set(true);
    this.operation.set('settings');
    try {
      const updated = await this.api.updateSettings(
        connection.id,
        this.settingsForm.getRawValue(),
      );
      this.detail.set(updated);
      this.settingsForm.markAsPristine();
      this.successMessage.set('Preferencias de sincronización guardadas.');
      await this.load();
      this.selectedId.set(connection.id);
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'No pudimos guardar las preferencias.'));
    } finally {
      this.busy.set(false);
      this.operation.set(null);
    }
  }

  async disconnectSelected(): Promise<void> {
    const connection = this.selected();
    if (!connection || !this.canManage() || this.busy()) return;
    if (
      !(await this.confirmDialog.confirm({
        title: `¿Desconectar ${connection.name}?`,
        message:
          'Se eliminarán las credenciales de esta tienda. Los productos ya importados permanecerán en tu catálogo.',
        confirmLabel: 'Desconectar',
      }))
    ) {
      return;
    }
    this.busy.set(true);
    this.operation.set('disconnect');
    try {
      await this.api.disconnect(connection.id);
      this.successMessage.set('Integración desconectada.');
      this.selectedId.set(null);
      this.detail.set(null);
      await this.load();
      this.panel.set(this.connections().length ? 'overview' : 'connect');
    } catch (error) {
      this.errorMessage.set(messageFrom(error, 'No pudimos desconectar la integración.'));
    } finally {
      this.busy.set(false);
      this.operation.set(null);
    }
  }

  async copyWebhook(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      window.setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.errorMessage.set('No pudimos copiar la URL. Selecciónala manualmente.');
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'CONNECTED':
        return 'Conectada';
      case 'SYNCING':
        return 'Sincronizando';
      case 'ERROR':
        return 'Con error';
      case 'REAUTH_REQUIRED':
        return 'Requiere autorización';
      case 'CONNECTING':
        return 'Conectando';
      case 'DISCONNECTED':
        return 'Desconectada';
      case 'COMPLETED':
        return 'Completada';
      case 'PARTIAL':
        return 'Parcial';
      case 'FAILED':
        return 'Fallida';
      case 'RUNNING':
        return 'En curso';
      case 'PENDING':
        return 'En cola';
      default:
        return status;
    }
  }

  platformLabel(platform: string): string {
    switch (platform) {
      case 'magento':
        return 'Magento';
      case 'woocommerce':
        return 'WooCommerce';
      case 'shopify':
        return 'Shopify';
      case 'prestashop':
        return 'PrestaShop';
      default:
        return platform;
    }
  }

  syncTypeLabel(type: string): string {
    switch (type) {
      case 'INITIAL':
        return 'Importación inicial';
      case 'INCREMENTAL':
        return 'Incremental';
      case 'RECONCILIATION':
        return 'Reconciliación';
      case 'EVENT':
        return 'Evento';
      case 'INVENTORY':
        return 'Inventario';
      default:
        return type;
    }
  }

  capabilityLabel(capability: string): string {
    const map: Record<string, string> = {
      'products.read': 'Lectura de productos',
      'products.bulk_read': 'Lectura masiva',
      'products.incremental_sync': 'Sync incremental',
      'products.webhooks': 'Webhooks',
      'products.variants': 'Variantes',
      'products.media': 'Imágenes',
      'products.categories': 'Categorías',
      'inventory.read': 'Inventario',
      'inventory.multi_location': 'Multi-ubicación',
      'pricing.read': 'Precios',
      'metafields.read': 'Metacampos',
      'store.multiple_views': 'Vistas de tienda',
    };
    return map[capability] ?? capability;
  }
}
