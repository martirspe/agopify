import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import {
  DsButtonComponent,
  DsCheckboxComponent,
  DsConfirmService,
  DsEmptyStateComponent,
  DsFormSectionComponent,
  DsIconComponent,
  DsBannerComponent,
  DsMenuComponent,
  DsModalDirective,
  DsPageHeaderComponent,
  DsSaveBarComponent,
  DsSelectComponent,
} from '@agopify/ui';
import {
  CatalogApiService,
  CollectionDto,
  ComponentInput,
  MediaInput,
  ProductChannelKind,
  ProductDetails,
  ProductDto,
  ProductKind,
  ProductStatus,
  ServiceMode,
} from '../../core/api/catalog-api.service';
import { IntegrationsStateService } from '../../core/integrations/integrations-state.service';
import { resizeImage } from '../../core/media/resize-image';
import { productCompleteness } from './product-completeness';

import {
  CombinationDraft,
  VariantAxis,
  generateCombinations,
  isColorAxisName,
  readOptions,
  keyOf,
} from './variant-combinations';
import { CatalogCategory } from '../../core/api/catalog-api.service';
import { CatalogListState, catalogCsv, catalogStock, filterCatalog } from './catalog-list';
type VariantDraft = CombinationDraft;
type VariantRow = { variant: VariantDraft; index: number; key: string };

type FaqDraft = { question: string; answer: string };

export type KindFilter = 'todos' | 'productos' | 'servicios' | 'digitales';
type FilterPanelId = 'closed' | 'dimensions' | 'tipo' | 'inventario' | 'tienda';
const KIND_FILTERS: KindFilter[] = ['todos', 'productos', 'servicios', 'digitales'];
const MAX_FAQS = 10;

type MediaDraft = { url: string; kind: 'image' | 'related'; alt: string; caption: string };

const MAX_MEDIA = 12;
const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    DsCheckboxComponent,
    DsSelectComponent,
    DsFormSectionComponent,
    DsSaveBarComponent,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    DsButtonComponent,
    DsEmptyStateComponent,
    DsIconComponent,
    DsMenuComponent,
    DsModalDirective,
    DsBannerComponent,
    DsPageHeaderComponent,
  ],
  templateUrl: './products.page.html',
  styleUrl: './products.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly maxMedia = MAX_MEDIA;
  readonly variantPageCount = computed(() => Math.max(1, Math.ceil(this.matchingVariants().length / 25)));
  private readonly api = inject(CatalogApiService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmDialog = inject(DsConfirmService);
  private readonly integrations = inject(IntegrationsStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly storeActive = computed(() => this.integrations.isActive('store'));
  readonly products = signal<ProductDto[]>([]);
  readonly listState = toSignal(
    this.route.queryParamMap.pipe(
      map((params): CatalogListState => {
        const value = params.get('tipo') as KindFilter | null;
        const oneOf = <T extends string>(key: string, values: readonly T[], fallback: T): T => values.includes(params.get(key) as T) ? params.get(key) as T : fallback;
        const size = Number(params.get('porPagina'));
        const page = Number(params.get('pagina'));
        return { kind: value && KIND_FILTERS.includes(value) ? value : 'todos', query: (params.get('q') ?? '').slice(0, 200),
          status: oneOf('estado', ['todos', 'activo', 'borrador', 'archivado', 'disponibles', 'pausados'], 'todos'),
          publication: oneOf('tienda', ['todos', 'visibles', 'ocultos', 'whatsapp', 'instagram'], 'todos'),
          inventory: oneOf('inventario', ['todos', 'agotados'] as const, 'todos'),
          sort: oneOf('orden', ['recientes', 'antiguos', 'nombre', 'nombre-desc'], 'recientes'),
          page: Number.isSafeInteger(page) && page > 0 ? page : 1, pageSize: [25, 50, 100].includes(size) ? size : 25 };
      }),
    ),
    { initialValue: { kind: 'todos', query: '', status: 'todos', publication: 'todos', sort: 'recientes', page: 1, pageSize: 25 } as CatalogListState },
  );
  readonly kindFilter = computed(() => this.listState().kind);
  readonly kindOptions: Array<{ id: KindFilter; label: string }> = [
    { id: 'todos', label: 'Todos los tipos' },
    { id: 'productos', label: 'Físicos' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'digitales', label: 'Digitales' },
  ];
  readonly statusViews: Array<{ id: 'todos' | 'activo' | 'borrador' | 'archivado'; label: string }> = [
    { id: 'todos', label: 'Todos' },
    { id: 'activo', label: 'Activos' },
    { id: 'borrador', label: 'Borradores' },
    { id: 'archivado', label: 'Archivados' },
  ];
  readonly sortOptions: Array<{ id: CatalogListState['sort']; label: string }> = [
    { id: 'recientes', label: 'Más recientes' },
    { id: 'antiguos', label: 'Más antiguos' },
    { id: 'nombre', label: 'Nombre, A–Z' },
    { id: 'nombre-desc', label: 'Nombre, Z–A' },
  ];
  readonly filterPanel = signal<FilterPanelId>('closed');
  private readonly filterDimensions: Array<{ id: Exclude<FilterPanelId, 'closed' | 'dimensions'>; label: string }> = [
    { id: 'tipo', label: 'Tipo' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'tienda', label: 'Canal' },
  ];
  readonly kindCounts = computed((): Record<KindFilter, number> => {
    const list = this.products();
    const services = list.filter((product) => product.kind === 'SERVICE').length;
    const digital = list.filter((product) => product.kind === 'DIGITAL').length;
    return { todos: list.length, productos: list.length - services - digital, servicios: services, digitales: digital };
  });
  readonly statusCounts = computed(() => {
    const list = this.products();
    let active = 0;
    let draft = 0;
    let archived = 0;
    for (const product of list) {
      const status = product.status ?? (product.isAvailable ? 'ACTIVE' : 'DRAFT');
      if (status === 'ACTIVE') active += 1;
      else if (status === 'ARCHIVED') archived += 1;
      else draft += 1;
    }
    return { todos: list.length, activo: active, borrador: draft, archivado: archived };
  });
  readonly filteredProducts = computed(() => filterCatalog(this.products(), this.listState()));
  /** Kept for quick filters / specs; the index UI uses status views instead of metric cards. */
  readonly catalogSummary = computed(() => ({
    total: this.products().length,
    soldOut: this.products().filter((product) => catalogStock(product) === 0).length,
  }));
  readonly activeListFilters = computed(() => {
    const state = this.listState();
    const filters: Array<{ key: string; label: string }> = [];
    if (state.kind !== 'todos') {
      filters.push({
        key: 'tipo',
        label: `Tipo es ${this.kindOptions.find((option) => option.id === state.kind)?.label ?? 'Tipo'}`,
      });
    }
    if (state.inventory === 'agotados') filters.push({ key: 'inventario', label: 'Inventario es Agotados' });
    if (state.publication !== 'todos') {
      const pubLabel =
        state.publication === 'visibles' ? 'En tienda web'
        : state.publication === 'whatsapp' ? 'En WhatsApp'
        : state.publication === 'instagram' ? 'En Instagram'
        : 'Ocultos en tienda';
      filters.push({ key: 'tienda', label: `Canal es ${pubLabel}` });
    }
    return filters;
  });
  readonly visibleFilterDimensions = computed(() => {
    const state = this.listState();
    return this.filterDimensions.filter((dimension) => {
      if (dimension.id === 'tipo' && state.kind !== 'todos') return false;
      if (dimension.id === 'inventario' && state.inventory === 'agotados') return false;
      if (dimension.id === 'tienda' && state.publication !== 'todos') return false;
      return true;
    });
  });
  readonly filterPanelTitle = computed(() => {
    const panel = this.filterPanel();
    if (panel === 'tipo') return 'Tipo';
    if (panel === 'inventario') return 'Inventario';
    if (panel === 'tienda') return 'Canal';
    return 'Filtros';
  });
  readonly filterPanelOptions = computed(() => {
    const panel = this.filterPanel();
    const state = this.listState();
    if (panel === 'tipo') {
      return this.kindOptions
        .filter((option) => option.id !== 'todos')
        .map((option) => ({
          value: option.id,
          label: `${option.label} (${this.kindCounts()[option.id]})`,
          selected: state.kind === option.id,
        }));
    }
    if (panel === 'inventario') {
      return [{ value: 'agotados', label: 'Agotados', selected: state.inventory === 'agotados' }];
    }
    if (panel === 'tienda') {
      const options: Array<{ value: string; label: string; selected: boolean }> = [];
      if (this.storeActive()) {
        options.push(
          { value: 'visibles', label: 'En tienda web', selected: state.publication === 'visibles' },
          { value: 'ocultos', label: 'Ocultos en tienda', selected: state.publication === 'ocultos' },
        );
      }
      options.push(
        { value: 'whatsapp', label: 'En WhatsApp', selected: state.publication === 'whatsapp' },
        { value: 'instagram', label: 'En Instagram', selected: state.publication === 'instagram' },
      );
      return options;
    }
    return [];
  });
  readonly collections = signal<CollectionDto[]>([]);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.listState().pageSize)));
  readonly currentPage = computed(() => Math.min(this.listState().page, this.totalPages()));
  readonly listStart = computed(() => this.filteredProducts().length ? (this.currentPage() - 1) * this.listState().pageSize + 1 : 0);
  readonly listEnd = computed(() => Math.min(this.currentPage() * this.listState().pageSize, this.filteredProducts().length));
  readonly visibleProducts = computed(() => this.filteredProducts().slice(this.listStart() ? this.listStart() - 1 : 0, this.listEnd()));
  readonly hasListFilters = computed(() => this.activeListFilters().length > 0 || Boolean(this.listState().query.trim()));
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingVersion = signal<string | null>(null);
  readonly handleLocked = signal(false);
  readonly variantsEnabled = signal(false);
  readonly media = signal<MediaDraft[]>([]);
  /** Selected tile in the Shopify-style media grid (alt / caption / ambient). */
  readonly selectedMediaIndex = signal<number | null>(null);
  readonly mediaDraggingIndex = signal<number | null>(null);
  readonly uploading = signal(false);
  readonly detailsEnabled = signal(false);
  readonly setEnabled = signal(false);
  readonly components = signal<ComponentInput[]>([]);
  readonly pieceOptions = computed(() =>
    this.products().filter(
      (product) =>
        product.id !== this.editingId() &&
        product.kind === 'PRODUCT' &&
        !(product.variants?.length ?? 0) &&
        !(product.components?.length ?? 0),
    ),
  );
  readonly categoryDraft = signal('');
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly variantDrafts = signal<VariantDraft[]>([]);
  readonly axes = signal<VariantAxis[]>([]);
  readonly axesPending = signal(false);
  readonly variantError = signal<string | null>(null);
  readonly variantGroupBy = signal('');
  readonly variantQuery = signal('');
  readonly variantGroupsClosed = signal<Record<string, boolean>>({});
  readonly variantPhotoTarget = signal<{ indexes: number[]; label: string } | null>(null);
  readonly variantPage = signal(0);
  readonly variantGroupOptions = computed(() => [...new Set(this.variantDrafts().flatMap(v => v.options.map(o => o.name)))]);
  readonly activeVariantGroup = computed(() => this.variantGroupBy() === '__all' ? '' : this.variantGroupOptions().includes(this.variantGroupBy()) ? this.variantGroupBy() : this.variantGroupOptions()[0] ?? '');
  readonly matchingVariants = computed<VariantRow[]>(() => {
    const query = this.variantQuery().trim().toLocaleLowerCase('es');
    return this.variantDrafts().map((variant, index) => ({ variant, index, key: variant.id || keyOf(variant.options) }))
      .filter(row => !query || `${this.variantLabel(row.variant)} ${row.variant.sku}`.toLocaleLowerCase('es').includes(query));
  });
  readonly variantRows = computed(() => this.matchingVariants().slice(this.variantPage() * 25, (this.variantPage() + 1) * 25));
  readonly variantGroups = computed(() => {
    const name = this.activeVariantGroup();
    const groupKey = (row: VariantRow) => name ? row.variant.options.find(o => o.name === name)?.value ?? 'Sin valor' : 'Todas las variantes';
    const groups = new Map<string, VariantRow[]>();
    for (const row of this.variantRows()) { const key = groupKey(row); groups.set(key, [...(groups.get(key) ?? []), row]); }
    return [...groups].map(([key, rows]) => {
      const allRows = this.matchingVariants().filter(row => groupKey(row) === key);
      const photos = new Set(allRows.map(row => row.variant.imageUrl));
      return { key, rows, indexes: allRows.map(row => row.index), total: allRows.length, image: photos.size === 1 ? allRows[0].variant.imageUrl : null };
    });
  });
  readonly categories = signal<CatalogCategory[]>([]);
  readonly classificationError = signal(false);
  readonly categoryId = signal('');
  readonly attributeValues = signal<Record<string, string>>({});
  readonly kindCategories = computed(() => this.categories().filter((category) => category.kind === this.formValues().kind));
  readonly selectedCategory = computed(() => this.categories().find((category) => category.id === this.categoryId()));
  /**
   * Product-level required attributes. Variant-defining ones (Color, Talla…) follow Shopify:
   * they live only as option axes when variants are on — never duplicated here.
   */
  readonly requiredCategoryAttributes = computed(() => {
    const attributes = this.selectedCategory()?.attributes.filter((attribute) => attribute.required) ?? [];
    if (!this.variantsEnabled()) return attributes;
    return attributes.filter((attribute) => !attribute.variant);
  });
  readonly showHandle = signal(false);
  readonly faqs = signal<FaqDraft[]>([]);
  readonly maxFaqs = MAX_FAQS;

  readonly isEditing = computed(() => Boolean(this.editingId()));

  readonly productForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(250)]],
    handle: ['', [Validators.required, Validators.minLength(2)]],
    descriptionShort: ['', [Validators.maxLength(1000)]],
    descriptionFull: ['', [Validators.maxLength(5000)]],
    categoriesText: [''],
    kind: ['PRODUCT' as ProductKind],
    digitalAccessUrl: ['', [Validators.maxLength(500), Validators.pattern(/^$|^https:\/\/[^\s]+$/)]],
    digitalInstructions: ['', [Validators.maxLength(600)]],
    digitalFormat: ['', [Validators.maxLength(80)]],
    license: ['', [Validators.maxLength(300)]],
    accessDuration: ['', [Validators.maxLength(200)]],
    returns: ['', [Validators.maxLength(300)]],
    useCasesText: [''],
    exclusionsText: [''],
    compatibilityText: [''],
    durationMinutes: [null as number | null, [Validators.min(5), Validators.max(1440)]],
    serviceMode: ['' as ServiceMode | ''],
    price: [0, [Validators.required, Validators.min(0)]],
    currency: ['PEN', Validators.required],
    status: ['DRAFT' as ProductStatus],
    channelStore: [false],
    channelWhatsapp: [false],
    channelInstagram: [false],
    stockUnlimited: [true],
    stockQty: [0, [Validators.min(0)]],
    compareAtPrice: [null as number | null, [Validators.min(0)]],
    brand: ['', [Validators.maxLength(60)]],
    sku: ['', [Validators.maxLength(60)]],
    line: ['', [Validators.maxLength(80)]],
    size: ['', [Validators.maxLength(60)]],
    family: ['', [Validators.maxLength(80)]],
    intensity: ['', [Validators.maxLength(80)]],
    benefitsText: [''],
    usageText: [''],
    notesText: [''],
    highlightsText: [''],
    scentText: [''],
    montage: [false],
    audience: ['', [Validators.maxLength(200)]],
    attributesText: [''],
    contentsText: [''],
    warranty: ['', [Validators.maxLength(300)]],
    requirementsText: [''],
    coverage: ['', [Validators.maxLength(200)]],
    cancellation: ['', [Validators.maxLength(300)]],
    keywordsText: [''],
  });

  private readonly formValues = toSignal(
    this.productForm.valueChanges.pipe(
      startWith(this.productForm.getRawValue()),
      map(() => this.productForm.getRawValue()),
    ),
    { initialValue: this.productForm.getRawValue() },
  );

  readonly isService = computed(() => this.formValues().kind === 'SERVICE');
  readonly isDigital = computed(() => this.formValues().kind === 'DIGITAL');
  readonly isPhysical = computed(() => this.formValues().kind === 'PRODUCT');

  /** Minimum to save/publish — not the enrichment coach. */
  readonly readiness = computed(() => {
    const values = this.formValues();
    const hasName = values.name.trim().length >= 2;
    const hasDescription = values.descriptionShort.trim().length >= 8;
    const hasPrice = Number(values.price) > 0;
    const items = [
      {
        id: 'name',
        label: values.kind === 'SERVICE' ? 'Nombre del servicio' : 'Nombre del producto',
        done: hasName,
        required: true,
      },
      {
        id: 'description',
        label: 'Descripción corta',
        done: hasDescription,
        required: true,
      },
      {
        id: 'handle',
        label: 'Enlace del producto',
        done: slugify(values.handle).length >= 2,
        required: true,
      },
      { id: 'price', label: 'Precio', done: hasPrice, required: true },
    ];
    if (values.kind === 'DIGITAL') {
      items.push({
        id: 'access',
        label: 'Enlace de acceso seguro',
        done: /^https:\/\/[^\s]+$/.test(values.digitalAccessUrl.trim()),
        required: true,
      });
    }
    return items;
  });

  /** Warn when store visibility is on without a main photo. */
  readonly storePhotoWarning = computed(
    () =>
      this.formValues().channelStore &&
      !this.media().some((item) => item.kind === 'image'),
  );

  readonly completeness = computed(() => {
    const values = this.formValues();
    return productCompleteness({
      kind: values.kind,
      categories: this.parseCategories(values.categoriesText),
      photos: this.media().filter((item) => item.kind === 'image').length,
      descriptionFull: values.descriptionFull,
    });
  });

  readonly readinessReady = computed(() =>
    this.readiness()
      .filter((item) => item.required)
      .every((item) => item.done),
  );

  readonly pendingFields = computed(() => this.readiness().filter(item => !item.done).length);
  readonly editorPreview = computed(() => ({
    name: this.formValues().name.trim() || 'Nombre del producto',
    description: this.formValues().descriptionShort.trim(),
    price: this.formatPrice(Math.round(Number(this.formValues().price || 0) * 100), this.formValues().currency),
    image: this.media().find(item => item.kind === 'image')?.url,
  }));
  readonly editorTitle = computed(() => {
    const name = this.formValues().name.trim();
    if (name) return name;
    return this.isEditing() ? 'Editar producto' : 'Agregar producto';
  });
  private readonly draftDirty = signal(false);
  private readonly formTick = toSignal(
    this.productForm.valueChanges.pipe(startWith(null)),
    { initialValue: null },
  );
  readonly editorPending = computed(() => {
    this.formTick();
    return this.productForm.dirty || this.draftDirty();
  });
  private touchEditor(): void {
    this.draftDirty.set(true);
  }

  focusEditorField(id: string): void {
    if (id === 'handle') this.showHandle.set(true);
    const names: Record<string, string> = {
      name: 'name',
      description: 'descriptionShort',
      handle: 'handle',
      price: 'price',
      access: 'digitalAccessUrl',
    };
    // Wait a tick so a newly revealed handle input exists in the DOM.
    setTimeout(() => {
      const field = this.host.nativeElement.querySelector<HTMLElement>(
        `[formControlName="${names[id] ?? id}"]`,
      );
      field?.focus({ preventScroll: true });
      field?.scrollIntoView?.({ block: 'center' });
    }, 0);
  }

  editorFieldError(id: string): string | null {
    const controls = this.productForm.controls;
    const field = id === 'description' ? controls.descriptionShort : id === 'access' ? controls.digitalAccessUrl : id === 'name' ? controls.name : id === 'handle' ? controls.handle : controls.price;
    if (!field.touched) return null;
    if (field.hasError('maxlength')) return 'Reduce el texto al máximo indicado.';
    if (this.readiness().find(item => item.id === id)?.done && !field.invalid) return null;
    const messages: Record<string, string> = {
      name: 'Escribe un nombre de al menos 2 caracteres.',
      description: 'Describe el producto con al menos 8 caracteres.',
      handle: 'Usa una dirección con al menos 2 letras o números.',
      price: 'Ingresa un precio mayor que cero.',
      access: 'Ingresa un enlace HTTPS válido para entregar el contenido.',
    };
    return messages[id] ?? null;
  }

  readonly nameCount = computed(() => this.formValues().name.length);
  readonly descriptionCount = computed(
    () => this.formValues().descriptionShort.length,
  );

  constructor() {
    this.productForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.errorMessage() === 'Revisa los datos marcados antes de guardar el producto.' && this.productForm.valid && this.readinessReady()) this.errorMessage.set(null);
    });
    this.productForm.controls.name.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        if (this.handleLocked() || this.editingId()) return;
        this.productForm.controls.handle.setValue(slugify(name), {
          emitEvent: false,
        });
      });

    this.productForm.controls.stockUnlimited.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((unlimited) => {
        const qty = this.productForm.controls.stockQty;
        if (unlimited) {
          qty.disable({ emitEvent: false });
        } else {
          qty.enable({ emitEvent: false });
        }
      });

    void this.load();
    void this.loadCategories();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set(null);
    try {
      const [products, collections] = await Promise.all([
        this.api.list(),
        this.api.listCollections().catch(() => [] as CollectionDto[]),
      ]);
      this.products.set(products);
      this.collections.set(collections);
    } catch {
      this.loadFailed.set(true);
      this.errorMessage.set(
        'No pudimos cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    this.editingId.set(null);
    this.handleLocked.set(false);
    this.showHandle.set(false);
    this.variantsEnabled.set(false);
    this.media.set([]);
    this.selectedMediaIndex.set(null);
    this.mediaDraggingIndex.set(null);
    this.categoryDraft.set('');
    this.variantDrafts.set([]);
    this.axes.set([]);
    this.axesPending.set(false);
    this.resetVariantView();
    this.categoryId.set('');
    this.attributeValues.set({});
    this.variantPage.set(0);
    this.faqs.set([]);
    this.detailsEnabled.set(false);
    this.setEnabled.set(false);
    this.components.set([]);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.productForm.reset({
      audience: '',
      attributesText: '',
      contentsText: '',
      warranty: '',
      requirementsText: '',
      coverage: '',
      cancellation: '',
      keywordsText: '',
      name: '',
      handle: '',
      descriptionShort: '',
      descriptionFull: '',
      categoriesText: '',
      kind: 'PRODUCT',
      digitalAccessUrl: '',
      digitalInstructions: '',
      durationMinutes: null,
      serviceMode: '',
      price: 0,
      currency: 'PEN',
      status: 'DRAFT',
      channelStore: false,
      channelWhatsapp: false,
      channelInstagram: false,
      stockUnlimited: true,
      stockQty: 0,
      compareAtPrice: null,
      brand: '',
      sku: '',
      line: '',
      size: '',
      family: '',
      intensity: '',
      benefitsText: '',
      usageText: '',
      notesText: '',
      highlightsText: '',
      scentText: '',
      montage: false,
    });
    this.productForm.controls.stockQty.disable({ emitEvent: false });
    this.draftDirty.set(false);
    this.editorOpen.set(true);
  }

  openEdit(product: ProductDto): void {
    this.editingId.set(product.id);
    this.editingVersion.set(product.updatedAt);
    this.handleLocked.set(true);
    this.showHandle.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.variantsEnabled.set((product.variants?.length ?? 0) > 0);
    this.media.set(
      (product.media ?? []).map((item) => ({
        url: item.url,
        kind: item.kind === 'related' ? 'related' : 'image',
        alt: item.alt ?? '',
        caption: item.caption ?? '',
      })),
    );
    this.selectedMediaIndex.set(null);
    this.mediaDraggingIndex.set(null);
    this.categoryDraft.set('');
    const details = product.details ?? {};
    this.detailsEnabled.set(
      Boolean(
        details.family ||
          details.intensity ||
          details.scent?.length ||
          details.notes?.length ||
          details.highlights?.length ||
          details.montage,
      ),
    );
    this.faqs.set((details.faqs ?? []).map((faq) => ({ ...faq })));
    this.setEnabled.set((product.components?.length ?? 0) > 0);
    this.components.set(
      (product.components ?? []).map((row) => ({ productId: row.componentId, quantity: row.quantity })),
    );
    this.productForm.reset({
      sku: product.sku ?? '',
      line: product.line ?? '',
      size: details.size ?? '',
      family: details.family ?? '',
      intensity: details.intensity ?? '',
      benefitsText: (details.benefits ?? []).join('\n'),
      usageText: (details.usage ?? []).join('\n'),
      notesText: (details.notes ?? []).join('\n'),
      highlightsText: (details.highlights ?? []).join('\n'),
      scentText: (details.scent ?? [])
        .map((note) => (note.description ? `${note.name}: ${note.description}` : note.name))
        .join('\n'),
      montage: details.montage ?? false,
      audience: details.audience ?? '',
      attributesText: (details.attributes ?? [])
        .map((row) => `${row.name}: ${row.value}`)
        .join('\n'),
      contentsText: (details.contents ?? []).join('\n'),
      warranty: details.warranty ?? '',
      requirementsText: (details.requirements ?? []).join('\n'),
      coverage: details.coverage ?? '',
      cancellation: details.cancellation ?? '',
      keywordsText: (details.keywords ?? []).join(', '),
      name: product.name,
      handle: product.handle,
      descriptionShort: product.descriptionShort ?? '',
      descriptionFull: product.descriptionFull ?? '',
      categoriesText: (product.categories ?? []).join(', '),
      kind: product.kind,
      digitalAccessUrl: product.digitalAccessUrl ?? '',
      digitalInstructions: product.digitalInstructions ?? '',
      digitalFormat: details.digitalFormat ?? '',
      license: details.license ?? '',
      accessDuration: details.accessDuration ?? '',
      returns: details.returns ?? '',
      useCasesText: (details.useCases ?? []).join('\n'),
      exclusionsText: (details.exclusions ?? []).join('\n'),
      compatibilityText: (details.compatibility ?? []).join('\n'),
      durationMinutes: product.durationMinutes,
      serviceMode: product.serviceMode ?? '',
      price: product.basePriceCents / 100,
      currency: product.currency,
      status: product.status ?? (product.isAvailable ? 'ACTIVE' : 'DRAFT'),
      channelStore: product.channelListings?.some((row) => row.channel === 'STORE' && row.isPublished) ?? product.isPublishedOnStore,
      channelWhatsapp: product.channelListings?.some((row) => row.channel === 'WHATSAPP' && row.isPublished) ?? false,
      channelInstagram: product.channelListings?.some((row) => row.channel === 'INSTAGRAM' && row.isPublished) ?? false,
      stockUnlimited: product.stockUnlimited,
      stockQty: product.stockQty ?? 0,
      compareAtPrice:
        product.compareAtPriceCents === null ? null : product.compareAtPriceCents / 100,
      brand: product.brand ?? '',
    });
    if (product.stockUnlimited) {
      this.productForm.controls.stockQty.disable({ emitEvent: false });
    } else {
      this.productForm.controls.stockQty.enable({ emitEvent: false });
    }
    const variants = product.variants ?? [];
    this.variantDrafts.set(variants.map((variant) => ({
      id: variant.id, sku: variant.sku ?? '', options: readOptions(variant),
      imageUrl: variant.imageUrl ?? null, price: variant.priceCents / 100,
      priceInherited: variant.priceInherited ?? false, isAvailable: variant.isAvailable, stockQty: variant.stockQty,
      expectedStockQty: variant.stockQty,
    })));
    const optionValues = new Map<string, Set<string>>();
    for (const variant of this.variantDrafts()) for (const option of variant.options) {
      const values = optionValues.get(option.name) ?? new Set<string>();
      values.add(option.value); optionValues.set(option.name, values);
    }
    const definitionColors = new Map<string, Record<string, string>>();
    for (const definition of product.optionDefinitions ?? []) {
      const colors: Record<string, string> = {};
      for (const entry of definition.values) {
        const row = typeof entry === 'string' ? { value: entry } : entry;
        if (row.color) colors[row.value.trim()] = row.color;
      }
      definitionColors.set(definition.name.trim().toLocaleLowerCase('es'), colors);
    }
    this.axes.set([...optionValues].map(([name, values]) => ({
      name,
      values: [...values].join('\n'),
      colors: definitionColors.get(name.trim().toLocaleLowerCase('es')) ?? {},
    })));
    this.axesPending.set(false);
    this.resetVariantView();
    this.categoryId.set(product.categoryId ?? '');
    this.attributeValues.set({ ...(product.attributeValues ?? {}) });
    this.variantPage.set(0);
    this.draftDirty.set(false);
    this.productForm.markAsPristine();
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    if (this.saving() || this.uploading()) return;
    this.variantPhotoTarget.set(null);
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.variantDrafts.set([]);
    this.media.set([]);
    this.selectedMediaIndex.set(null);
    this.mediaDraggingIndex.set(null);
    this.draftDirty.set(false);
  }

  /** Restores the last loaded product (or a blank create draft) without leaving the editor. */
  discardEditorChanges(): void {
    if (this.saving() || this.uploading() || this.deleting()) return;
    const id = this.editingId();
    if (id) {
      const product = this.products().find((row) => row.id === id);
      if (product) {
        this.openEdit(product);
        return;
      }
    }
    this.openCreate();
  }

  toggleDetails(enabled: boolean): void {
    this.detailsEnabled.set(enabled);
  }

  /** A service has no stock of its own, so it cannot be sold as a set. */
  setKind(kind: ProductKind): void {
    this.productForm.controls.kind.setValue(kind);
    if (kind !== 'PRODUCT') this.setEnabled.set(false);
    this.setCategory('');
  }

  toggleSet(enabled: boolean): void {
    this.setEnabled.set(enabled);
    this.touchEditor();
    if (enabled) {
      this.variantsEnabled.set(false);
      if (!this.components().length) this.addComponent();
    }
  }

  addComponent(): void {
    const used = new Set(this.components().map((row) => row.productId));
    const next = this.pieceOptions().find((product) => !used.has(product.id));
    this.components.update((list) => [...list, { productId: next?.id ?? '', quantity: 1 }]);
    this.touchEditor();
  }

  updateComponent(index: number, patch: Partial<ComponentInput>): void {
    this.components.update((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    this.touchEditor();
  }

  removeComponent(index: number): void {
    this.components.update((list) => list.filter((_, i) => i !== index));
    this.touchEditor();
  }

  updateMedia(index: number, patch: Partial<MediaDraft>): void {
    this.media.update((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    this.touchEditor();
  }

  selectMedia(index: number): void {
    this.selectedMediaIndex.set(this.selectedMediaIndex() === index ? null : index);
  }

  setFeaturedMedia(index: number): void {
    if (index <= 0) return;
    this.media.update((list) => {
      if (index >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
    this.selectedMediaIndex.set(0);
    this.touchEditor();
  }

  moveMedia(index: number, delta: -1 | 1): void {
    this.media.update((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    const selected = this.selectedMediaIndex();
    if (selected === index) this.selectedMediaIndex.set(index + delta);
    else if (selected === index + delta) this.selectedMediaIndex.set(index);
    this.touchEditor();
  }

  onMediaDragStart(index: number, event: DragEvent): void {
    this.mediaDraggingIndex.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onMediaDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onMediaDrop(targetIndex: number, event: DragEvent): void {
    event.preventDefault();
    const from = this.mediaDraggingIndex() ?? Number(event.dataTransfer?.getData('text/plain'));
    this.mediaDraggingIndex.set(null);
    if (!Number.isInteger(from) || from === targetIndex || from < 0 || from >= this.media().length) return;
    this.media.update((list) => {
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    this.selectedMediaIndex.set(targetIndex);
    this.touchEditor();
  }

  onMediaDragEnd(): void {
    this.mediaDraggingIndex.set(null);
  }

  async onFiles(input: HTMLInputElement): Promise<void> {
    if (this.saving() || this.deleting() || this.uploading()) return;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    const room = MAX_MEDIA - this.media().length;
    if (room <= 0) {
      this.errorMessage.set(`Máximo ${MAX_MEDIA} fotos por producto.`);
      return;
    }
    this.uploading.set(true);
    this.errorMessage.set(null);
    try {
      for (const file of files.slice(0, room)) {
        const image = await resizeImage(file);
        const { url } = await this.api.uploadMedia(image.contentType, image.data);
        this.media.update((list) => [...list, { url, kind: 'image', alt: '', caption: '' }]);
        this.touchEditor();
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 429
          ? 'Subiste muchas fotos seguidas. Espera un minuto e inténtalo de nuevo.'
          : 'No pudimos subir la foto. Usa una imagen JPG, PNG o WebP.',
      );
    } finally {
      this.uploading.set(false);
    }
  }

  pieceName(productId: string): string {
    return this.products().find((product) => product.id === productId)?.name ?? '';
  }

  pieceSelectable(id: string): boolean { return this.pieceOptions().some((piece) => piece.id === id); }
  hasMedia(url: string): boolean { return this.media().some((photo) => photo.url === url); }
  categoryPath(category: CatalogCategory): string { return category.path.map((item) => item.name).join(' → '); }
  updateVariantStock(index: number, value: string): void { this.updateVariant(index, { stockQty: value.trim() ? Number(value) : null }); }

  onHandleInput(): void {
    this.handleLocked.set(true);
  }

  openHandleEditor(): void {
    this.showHandle.set(true);
  }

  toggleVariants(enabled: boolean): void {
    this.variantsEnabled.set(enabled);
    this.touchEditor();
    if (enabled && this.variantDrafts().length === 0) {
      this.addVariant();
    }
  }

  async loadCategories(): Promise<void> {
    this.classificationError.set(false);
    try { this.categories.set(await this.api.categories()); }
    catch { this.classificationError.set(true); }
  }

  setCategory(id: string): void {
    this.categoryId.set(id); this.attributeValues.set({});
    this.detailsEnabled.set(id === 'fragrances');
    this.touchEditor();
    const suggested = this.selectedCategory()?.attributes.filter((attribute) => attribute.variant && attribute.required) ?? [];
    if (!suggested.length) return;
    // Shopify pattern: Color/Size become variant options, not product-level fields.
    if (!this.variantDrafts().length) {
      this.variantsEnabled.set(true);
      this.axes.set(suggested.slice(0, 5).map((attribute) => ({ name: attribute.name, values: '', colors: {} })));
      this.axesPending.set(true);
      this.setEnabled.set(false);
    } else {
      this.variantsEnabled.set(true);
      this.ensureVariantAxesForCategory(suggested.map((attribute) => attribute.name));
    }
  }

  /** Adds missing category option axes (e.g. Color, Talla) without wiping merchant values. */
  private ensureVariantAxesForCategory(names: string[]): void {
    const existing = new Set(this.axes().map((axis) => axis.name.trim().toLocaleLowerCase('es')));
    const missing = names.filter((name) => !existing.has(name.trim().toLocaleLowerCase('es')));
    if (!missing.length) return;
    this.axes.update((axes) => [
      ...axes,
      ...missing.slice(0, Math.max(0, 5 - axes.length)).map((name) => ({ name, values: '', colors: {} })),
    ]);
    this.axesPending.set(true);
  }

  isColorAxis(axis: VariantAxis): boolean {
    return isColorAxisName(axis.name);
  }

  axisColor(axis: VariantAxis, value: string): string {
    return axis.colors?.[value.trim()] ?? '#cccccc';
  }

  setAxisColor(axisIndex: number, value: string, color: string): void {
    const key = value.trim();
    if (!key || !/^#[0-9A-Fa-f]{6}$/.test(color)) return;
    this.axes.update((axes) =>
      axes.map((axis, index) =>
        index === axisIndex
          ? { ...axis, colors: { ...(axis.colors ?? {}), [key]: color.toLowerCase() } }
          : axis,
      ),
    );
    this.touchEditor();
  }

  setAttribute(key: string, value: string): void {
    this.attributeValues.update((values) => ({ ...values, [key]: value }));
    this.touchEditor();
  }

  addAxis(): void {
    if (this.axes().length < 5) {
      this.axes.update((axes) => [...axes, { name: '', values: '' }]);
      this.axesPending.set(true);
      this.touchEditor();
    }
  }

  updateAxis(index: number, patch: Partial<VariantAxis>): void {
    const previous = this.axes()[index];
    if (patch.name !== undefined && previous) {
      this.variantDrafts.update(list => list.map(variant => ({ ...variant, options: variant.options.map(option => option.name === previous.name.trim() ? { ...option, name: patch.name!.trim() } : option) })));
      if (this.variantGroupBy() === previous.name.trim()) this.variantGroupBy.set(patch.name.trim());
    }
    this.axes.update((axes) => axes.map((axis, i) => i === index ? { ...axis, ...patch } : axis));
    this.axesPending.set(true);
    this.variantError.set(null);
    this.touchEditor();
  }

  removeAxis(index: number): void {
    this.axes.update((axes) => axes.filter((_, i) => i !== index));
    this.touchEditor();
    if (!this.axes().length) {
      this.variantDrafts.set([]); this.variantsEnabled.set(false); this.axesPending.set(false); this.resetVariantView(); return;
    }
    this.axesPending.set(true);
    this.generateVariants();
  }

  generateVariants(): void {
    try {
      this.variantDrafts.set(generateCombinations(this.axes(), this.variantDrafts(), Number(this.productForm.controls.price.value), this.productForm.controls.sku.value.trim()));
      this.axesPending.set(false);
      this.variantPage.set(0); this.variantError.set(null);
    } catch (error) { this.variantError.set(error instanceof Error ? error.message : 'Revisa las opciones.'); }
  }

  axisValues(axis: VariantAxis): string[] { return axis.values.split(/[\n,]/); }

  updateAxisValue(axisIndex: number, valueIndex: number, value: string): void {
    const axis = this.axes()[axisIndex];
    const values = this.axisValues(axis);
    const previous = values[valueIndex].trim();
    if (previous) this.variantDrafts.update(list => list.map(variant => ({ ...variant, options: variant.options.map(option => option.name === axis.name.trim() && option.value === previous ? { ...option, value: value.trim() } : option) })));
    values[valueIndex] = value;
    const colors = { ...(axis.colors ?? {}) };
    if (previous && previous !== value.trim()) {
      if (colors[previous] && !colors[value.trim()]) colors[value.trim()] = colors[previous];
      delete colors[previous];
    }
    this.updateAxis(axisIndex, { values: values.join('\n'), colors });
  }

  addAxisValue(index: number): void {
    const axis = this.axes()[index];
    if (this.axisValues(axis).length < 50) this.updateAxis(index, { values: `${axis.values}\n` });
  }

  removeAxisValue(axisIndex: number, valueIndex: number): void {
    const axis = this.axes()[axisIndex];
    const removed = this.axisValues(axis)[valueIndex]?.trim();
    const values = this.axisValues(axis).filter((_, index) => index !== valueIndex);
    const colors = { ...(axis.colors ?? {}) };
    if (removed) delete colors[removed];
    this.updateAxis(axisIndex, { values: values.join('\n'), colors });
    this.generateVariants();
  }

  variantLabel(variant: VariantDraft): string { return variant.options.map(o => o.value).join(' / '); }
  variantChildLabel(variant: VariantDraft): string { return variant.options.filter(o => o.name !== this.activeVariantGroup()).map(o => o.value).join(' / ') || this.variantLabel(variant); }

  setVariantGroup(value: string): void { this.variantGroupBy.set(value); this.variantPage.set(0); this.variantGroupsClosed.set({}); }
  setVariantQuery(value: string): void { this.variantQuery.set(value); this.variantPage.set(0); }
  toggleVariantGroup(key: string): void { this.variantGroupsClosed.update(state => ({ ...state, [key]: !state[key] })); }
  selectVariantPhoto(url: string | null): void {
    const target = this.variantPhotoTarget();
    if (!target) return;
    const indexes = new Set(target.indexes);
    this.variantDrafts.update(list => list.map((variant, index) => indexes.has(index) ? { ...variant, imageUrl: url } : variant));
    this.variantPhotoTarget.set(null);
  }

  private resetVariantView(): void {
    this.variantGroupBy.set(''); this.variantQuery.set(''); this.variantGroupsClosed.set({});
    this.variantPhotoTarget.set(null); this.variantError.set(null);
  }

  addVariant(): void {
    if (!this.axes().length) this.addAxis();
  }

  addFaq(): void {
    if (this.faqs().length >= MAX_FAQS) return;
    this.faqs.update((list) => [...list, { question: '', answer: '' }]);
  }

  updateFaq(index: number, patch: Partial<FaqDraft>): void {
    this.faqs.update((list) => list.map((faq, i) => (i === index ? { ...faq, ...patch } : faq)));
  }

  removeFaq(index: number): void {
    this.faqs.update((list) => list.filter((_, i) => i !== index));
  }

  setKindFilter(filter: KindFilter): void {
    this.setListFilter('tipo', filter === 'todos' ? '' : filter);
  }

  openFilterPanel(panel: Exclude<FilterPanelId, 'closed'> = 'dimensions'): void {
    this.filterPanel.set(panel);
  }

  closeFilterPanel(): void {
    this.filterPanel.set('closed');
  }

  onFilterQueryInput(value: string): void {
    this.setListFilter('q', value);
    if (this.filterPanel() === 'closed') this.filterPanel.set('dimensions');
    else if (this.filterPanel() !== 'dimensions') this.filterPanel.set('dimensions');
  }

  onFilterQueryKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeFilterPanel();
      return;
    }
    if (event.key === 'ArrowDown' && this.filterPanel() === 'closed') {
      event.preventDefault();
      this.openFilterPanel('dimensions');
    }
  }

  applyFilterPanelValue(value: string): void {
    const panel = this.filterPanel();
    if (panel === 'tipo') this.setListFilter('tipo', value);
    else if (panel === 'inventario') this.setListFilter('inventario', value);
    else if (panel === 'tienda') this.setListFilter('tienda', value);
    this.closeFilterPanel();
  }

  onFilterFocusOut(event: FocusEvent): void {
    if (this.filterPanel() === 'closed') return;
    const root = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (root && next && root.contains(next)) return;
    // Defer so option mousedown (preventDefault) can keep focus and apply the value.
    setTimeout(() => {
      const active = root?.ownerDocument.activeElement;
      if (root && active && root.contains(active)) return;
      this.closeFilterPanel();
    }, 0);
  }

  setListFilter(key: string, value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value === 'todos' || !value ? null : value, pagina: null },
      queryParamsHandling: 'merge',
      replaceUrl: key === 'q',
    });
  }

  setListPage(page: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { pagina: page > 1 ? Math.min(page, this.totalPages()) : null }, queryParamsHandling: 'merge' });
  }

  clearListFilters(): void {
    this.closeFilterPanel();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null, tipo: null, estado: null, tienda: null, inventario: null, pagina: null }, queryParamsHandling: 'merge' });
  }

  showCatalogAttention(key: 'estado' | 'inventario' | 'tienda', value: string): void {
    void this.router.navigate([], { relativeTo: this.route,
      queryParams: { q: null, tipo: null, estado: null, tienda: null, inventario: null, pagina: null, [key]: value },
      queryParamsHandling: 'merge',
    });
  }

  readonly exportingPackage = signal(false);

  /** Spreadsheet of the current filtered list (not re-importable). */
  exportCatalogCsv(): void {
    const url = URL.createObjectURL(
      new Blob([catalogCsv(this.filteredProducts())], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalogo-agopify.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Full package ZIP for «Importar catálogo» (backup before a DB reset). */
  async exportCatalogPackage(): Promise<void> {
    if (this.exportingPackage() || !this.products().length) return;
    this.exportingPackage.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const pack = await this.api.exportPackage();
      const url = URL.createObjectURL(pack.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pack.filename;
      link.click();
      URL.revokeObjectURL(url);
      this.successMessage.set(
        pack.warnings.length
          ? `Paquete descargado. Aviso: ${pack.warnings[0]}`
          : 'Paquete descargado. Puedes reimportarlo desde «Importar catálogo».',
      );
    } catch {
      this.errorMessage.set(
        'No se pudo exportar el catálogo. Solo el dueño o un administrador puede hacerlo.',
      );
    } finally {
      this.exportingPackage.set(false);
    }
  }

  listScore(product: ProductDto): number {
    return productCompleteness({
      kind: product.kind,
      categories: product.categories ?? [],
      photos: (product.media ?? []).filter((item) => item.kind !== 'related').length,
      descriptionFull: product.descriptionFull,
    }).score;
  }

  removeVariant(index: number): void {
    this.variantDrafts.update((list) => list.filter((_, i) => i !== index));
    this.variantPage.set(Math.min(this.variantPage(), Math.max(0, Math.ceil(this.matchingVariants().length / 25) - 1)));
    this.touchEditor();
  }

  updateVariant(index: number, patch: Partial<VariantDraft>): void {
    this.variantDrafts.update((list) =>
      list.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
    this.touchEditor();
  }

  onVariantPriceInput(index: number, value: string): void {
    this.updateVariant(index, { price: Number(value || 0), priceInherited: false });
  }

  removeMediaUrl(index: number): void {
    const selected = this.selectedMediaIndex();
    if (selected === index) this.selectedMediaIndex.set(null);
    else if (selected !== null && selected > index) this.selectedMediaIndex.set(selected - 1);
    this.media.update((list) => list.filter((_, i) => i !== index));
    this.touchEditor();
  }

  onCategoryDraftInput(value: string): void {
    this.categoryDraft.set(value);
  }

  addCategoryFromDraft(): void {
    const value = this.categoryDraft().trim();
    if (!value) return;
    const current = this.parseCategories(
      this.productForm.controls.categoriesText.value,
    );
    if (!current.includes(value)) {
      this.productForm.controls.categoriesText.setValue(
        [...current, value].join(', '),
      );
    }
    this.categoryDraft.set('');
  }

  removeCategory(category: string): void {
    const next = this.parseCategories(
      this.productForm.controls.categoriesText.value,
    ).filter((item) => item !== category);
    this.productForm.controls.categoriesText.setValue(next.join(', '));
  }

  categoryChips(): string[] {
    return this.parseCategories(this.formValues().categoriesText);
  }

  private storeFields(values: {
    status: ProductStatus;
    channelStore: boolean;
    channelWhatsapp: boolean;
    channelInstagram: boolean;
    compareAtPrice: number | null;
    brand: string;
  }) {
    const compareAt =
      values.compareAtPrice === null || String(values.compareAtPrice) === ''
        ? null
        : toCents(Number(values.compareAtPrice));
    const channelListings: Array<{ channel: ProductChannelKind; isPublished: boolean }> = [
      { channel: 'STORE', isPublished: values.channelStore },
      { channel: 'WHATSAPP', isPublished: values.channelWhatsapp },
      { channel: 'INSTAGRAM', isPublished: values.channelInstagram },
    ];
    return {
      status: values.status,
      channelListings,
      compareAtPriceCents: compareAt && compareAt > 0 ? compareAt : null,
      brand: values.brand.trim() || null,
    };
  }

  private optionDefinitionsFromDrafts(): Array<{ name: string; values: Array<{ value: string; color?: string }> }> {
    if (!this.variantsEnabled() || this.setEnabled()) return [];
    return this.axes().map((axis) => ({
      name: axis.name.trim(),
      values: axis.values
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const color = axis.colors?.[value];
          return color ? { value, color } : { value };
        }),
    }));
  }

  async saveProduct(): Promise<void> {
    if (this.saving() || this.deleting() || this.uploading()) return;
    if (this.variantsEnabled() && !this.setEnabled() && this.axesPending()) {
      this.errorMessage.set('Completa las opciones de variantes antes de guardar.');
      return;
    }
    if (this.productForm.invalid || !this.readinessReady()) {
      this.productForm.markAllAsTouched();
      this.errorMessage.set(
        'Revisa los datos marcados antes de guardar el producto.',
      );
      const missing = this.readiness().find(item => !item.done);
      const invalid = Object.entries(this.productForm.controls).find(([, control]) => control.invalid);
      this.focusEditorField(missing?.id ?? invalid?.[0] ?? 'name');
      return;
    }

    const values = this.productForm.getRawValue();
    const handle = slugify(values.handle);
    if (handle.length < 2) {
      this.productForm.controls.handle.setErrors({ minlength: true });
      return;
    }

    const service = values.kind === 'SERVICE';
    const stockless = values.kind !== 'PRODUCT';
    const asSet = this.setEnabled() && !stockless;
    const components = asSet ? this.components() : [];
    if (components.some((row) => !row.productId || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 20) || new Set(components.map((row) => row.productId)).size !== components.length) {
      this.errorMessage.set('Elige todas las piezas y cantidades válidas, sin repetir productos.'); return;
    }
    if (asSet && !components.length) {
      this.errorMessage.set('Agrega al menos una pieza al set o desactiva "Se vende como set".');
      return;
    }
    const duration = Number(values.durationMinutes);
    const extras = {
      kind: values.kind,
      categoryId: this.categoryId() || null,
      attributeValues: this.categoryId() ? this.attributeValues() : null,
      digitalAccessUrl: values.kind === 'DIGITAL' ? values.digitalAccessUrl.trim() || null : null,
      digitalInstructions: values.kind === 'DIGITAL' ? values.digitalInstructions.trim() || null : null,
      durationMinutes: service && duration > 0 ? Math.round(duration) : null,
      serviceMode: service && values.serviceMode ? values.serviceMode : null,
      sku: values.sku.trim() || null,
      line: values.line.trim() || null,
      details: this.detailsPayload(values),
      media: this.media().map(
        (item): MediaInput => ({
          url: item.url,
          kind: item.kind,
          alt: item.alt.trim() || undefined,
          caption: item.caption.trim() || undefined,
        }),
      ),
      components,
    };

    const variants = this.variantsEnabled() && !asSet ? this.variantDrafts().map((item) => ({
      ...(item.id ? { id: item.id } : {}), sku: item.sku.trim() || undefined,
      expectedStockQty: item.expectedStockQty,
      options: item.options, imageUrl: item.imageUrl, priceInherited: item.priceInherited,
      priceCents: toCents(item.priceInherited ? Number(values.price) : item.price),
      isAvailable: item.isAvailable, stockQty: stockless ? null : item.stockQty,
    })) : [];
    if (this.variantsEnabled() && !asSet && (!variants.length || new Set(variants.map((item) => keyOf(item.options))).size !== variants.length)) {
      this.errorMessage.set('Genera combinaciones válidas y distintas antes de guardar.'); return;
    }
    if (this.categoryId() && !this.selectedCategory()) {
      this.errorMessage.set('Carga la clasificación antes de guardar este producto.'); return;
    }
    const missing = this.selectedCategory()?.attributes.find((attribute) => {
      if (!attribute.required || this.attributeValues()[attribute.key]?.trim()) return false;
      if (!attribute.variant) return true;
      // Variant-defining attrs (Color, Talla…) must be covered by option axes, not product fields.
      if (!variants.length) return true;
      return !variants.every((variant) =>
        variant.options.some(
          (option) =>
            option.name.trim().toLocaleLowerCase('es') === attribute.name.trim().toLocaleLowerCase('es') &&
            option.value.trim(),
        ),
      );
    });
    if (missing) {
      this.errorMessage.set(
        missing.variant
          ? `Define la opción «${missing.name}» en Variantes (como en Shopify: no se pide otra vez arriba).`
          : `Completa ${missing.name}.`,
      );
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const editingId = this.editingId();
      const saved = editingId
        ? await this.api.update(editingId, {
            expectedUpdatedAt: this.editingVersion() ?? undefined,
            name: values.name.trim(),
            handle,
            descriptionShort: values.descriptionShort.trim() || undefined,
            descriptionFull: values.descriptionFull.trim() || '',
            categories: this.parseCategories(values.categoriesText),
            basePriceCents: toCents(values.price),
            currency: values.currency,
            stockUnlimited: stockless || values.stockUnlimited,
            stockQty: stockless || values.stockUnlimited ? null : Number(values.stockQty),
            variants,
            optionDefinitions: this.optionDefinitionsFromDrafts(),
            ...extras,
            ...this.storeFields(values),
          })
        : await this.api.create({
            name: values.name.trim(),
            handle,
            descriptionShort: values.descriptionShort.trim() || undefined,
            descriptionFull: values.descriptionFull.trim() || undefined,
            categories: this.parseCategories(values.categoriesText),
            basePriceCents: toCents(values.price),
            currency: values.currency,
            stockUnlimited: stockless || values.stockUnlimited,
            stockQty: stockless || values.stockUnlimited
              ? undefined
              : Number(values.stockQty),
            variants,
            optionDefinitions: this.optionDefinitionsFromDrafts(),
            ...extras,
            ...this.storeFields(values),
          });
      this.editorOpen.set(false);
      this.editingId.set(null);
      this.draftDirty.set(false);
      this.successMessage.set(
        editingId
          ? `"${saved.name}" actualizado.`
          : `"${saved.name}" agregado al catálogo.`,
      );
      await this.load();
    } catch (error) {
      this.errorMessage.set(this.mapSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteProduct(): Promise<void> {
    const productId = this.editingId();
    if (!productId) return;
    const name = this.productForm.controls.name.value.trim() || 'este producto';
    const confirmed = await this.confirmDialog.confirm({
      title: `¿Eliminar "${name}"?`,
      message:
        'Sale del catálogo, la tienda web y el inventario. Los pedidos anteriores conservan su detalle.',
      confirmLabel: 'Eliminar producto',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.errorMessage.set(null);
    try {
      await this.api.remove(productId);
      this.products.set(this.products().filter((product) => product.id !== productId));
      this.closeEditor();
      this.successMessage.set(`"${name}" eliminado.`);
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 409 && typeof error.error?.message === 'string'
          ? error.error.message
          : 'No se pudo eliminar el producto. Inténtalo de nuevo.',
      );
    } finally {
      this.deleting.set(false);
    }
  }

  formatPrice(cents: number, currency: string): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  }

  stockLabel(product: ProductDto): string {
    if (product.kind === 'DIGITAL') return 'Digital';
    if (product.kind === 'SERVICE') {
      return product.durationMinutes ? `Servicio · ${product.durationMinutes} min` : 'Servicio';
    }
    const pieces = product.components?.length ?? 0;
    if (pieces) return `Set · ${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`;
    const stock = catalogStock(product);
    if (stock === null) return 'Sin seguimiento';
    if (stock === 0) return 'Agotado';
    const variants = product.variants?.length ?? 0;
    const base = stock === 1 ? '1 en inventario' : `${stock} en inventario`;
    return variants ? `${base} · ${variants} var.` : base;
  }

  productStatus(product: ProductDto): ProductStatus {
    return product.status ?? (product.isAvailable ? 'ACTIVE' : 'DRAFT');
  }

  statusLabel(product: ProductDto): string {
    const status = this.productStatus(product);
    if (status === 'ACTIVE') return 'Activo';
    if (status === 'ARCHIVED') return 'Archivado';
    return 'Borrador';
  }

  kindLabel(kind: ProductKind): string {
    if (kind === 'SERVICE') return 'Servicio';
    if (kind === 'DIGITAL') return 'Producto digital';
    return 'Producto físico';
  }

  channelFlags(product: ProductDto): { whatsapp: boolean; instagram: boolean; store: boolean } {
    if (this.productStatus(product) !== 'ACTIVE') {
      return { whatsapp: false, instagram: false, store: false };
    }
    const listings = product.channelListings;
    const published = (channel: ProductChannelKind, legacy?: boolean) =>
      listings?.some((row) => row.channel === channel && row.isPublished) ?? Boolean(legacy);
    return {
      whatsapp: published('WHATSAPP'),
      instagram: published('INSTAGRAM'),
      store: this.storeActive() && published('STORE', product.isPublishedOnStore),
    };
  }

  channelSummary(product: ProductDto): string {
    const flags = this.channelFlags(product);
    const labels: string[] = [];
    if (flags.whatsapp) labels.push('WhatsApp');
    if (flags.instagram) labels.push('Instagram');
    if (flags.store) labels.push('Tienda');
    return labels.length ? labels.join(' · ') : 'Sin publicar';
  }

  setStatusView(status: 'todos' | 'activo' | 'borrador' | 'archivado'): void {
    this.setListFilter('estado', status === 'todos' ? '' : status);
  }

  availabilityLabel(product: ProductDto): string {
    if (this.productStatus(product) !== 'ACTIVE') return 'No disponible';
    return catalogStock(product) === 0 ? 'Sin stock' : 'Disponible';
  }

  thumb(product: ProductDto): string | null {
    return product.media?.find((item) => item.kind !== 'related')?.url ?? null;
  }

  private detailsPayload(values: ReturnType<ProductsPage['productForm']['getRawValue']>): ProductDetails | null {
    const details: ProductDetails = {};
    const text = (value: string) => value.trim() || undefined;
    const service = values.kind === 'SERVICE';
    const fragrance = this.detailsEnabled() && values.kind === 'PRODUCT';
    details.size = text(values.size);
    details.audience = text(values.audience);
    details.returns = text(values.returns);
    if (values.kind === 'DIGITAL') {
      details.digitalFormat = text(values.digitalFormat);
      details.license = text(values.license);
      details.accessDuration = text(values.accessDuration);
    }
    if (!service) details.warranty = text(values.warranty);
    if (service) {
      details.coverage = text(values.coverage);
      details.cancellation = text(values.cancellation);
    }
    if (fragrance) {
      details.family = text(values.family);
      details.intensity = text(values.intensity);
    }
    const listFields: Array<[keyof ProductDetails, string, boolean]> = [
      ['benefits', values.benefitsText, true],
      ['useCases', values.useCasesText, true],
      ['exclusions', values.exclusionsText, true],
      ['compatibility', values.compatibilityText, !service],
      ['contents', values.contentsText, true],
      ['usage', values.usageText, !service],
      ['requirements', values.requirementsText, service || values.kind === 'DIGITAL'],
      ['notes', values.notesText, fragrance],
      ['highlights', values.highlightsText, fragrance],
    ];
    for (const [key, raw, enabled] of listFields) {
      const list = enabled ? lines(raw) : [];
      if (list.length) (details as Record<string, unknown>)[key] = list;
    }
    const pairs = (raw: string, max: number) =>
      lines(raw)
        .slice(0, max)
        .map((row) => {
          const [name, ...rest] = row.split(':');
          return { name: name.trim(), rest: rest.join(':').trim() };
        })
        .filter((row) => row.name);
    const attributes = pairs(values.attributesText, 20)
      .filter((row) => row.rest)
      .map((row) => ({ name: row.name.slice(0, 60), value: row.rest.slice(0, 200) }));
    for (const definition of this.selectedCategory()?.attributes ?? []) {
      const value = this.attributeValues()[definition.key]?.trim();
      if (value) attributes.push({ name: definition.name, value });
    }
    if (attributes.length) details.attributes = [...new Map(attributes.map((attribute) => [attribute.name.trim().toLocaleLowerCase('es'), attribute])).values()];
    const keywords = values.keywordsText
      .split(',')
      .map((word) => word.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20);
    if (keywords.length) details.keywords = keywords;
    const faqs = this.faqs()
      .map((faq) => ({ question: faq.question.trim(), answer: faq.answer.trim() }))
      .filter((faq) => faq.question.length >= 3 && faq.answer);
    if (faqs.length) details.faqs = faqs;
    const scent = fragrance
      ? pairs(values.scentText, 6).map((row) => ({
          name: row.name.slice(0, 80),
          ...(row.rest ? { description: row.rest.slice(0, 200) } : {}),
        }))
      : [];
    if (scent.length) details.scent = scent;
    if (fragrance && values.montage) details.montage = true;
    const clean = Object.fromEntries(
      Object.entries(details).filter(([, value]) => value !== undefined),
    ) as ProductDetails;
    return Object.keys(clean).length ? clean : null;
  }

  private parseCategories(raw: string): string[] {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  private mapSaveError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message =
        typeof error.error?.message === 'string'
          ? error.error.message
          : Array.isArray(error.error?.message)
            ? error.error.message.join(' ')
            : '';
      if (
        error.status === 409 ||
        /unique|already exists|handle/i.test(message)
      ) {
        return 'Ese identificador (handle) ya existe. Elige otro.';
      }
      if (error.status === 400) {
        return typeof error.error?.message === 'string'
          ? error.error.message
          : 'Revisa los campos: nombre, descripción y precio son obligatorios.';
      }
    }
    return 'No se pudo guardar el producto. Inténtalo de nuevo.';
  }
}
