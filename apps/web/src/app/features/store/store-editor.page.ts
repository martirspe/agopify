import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import type {
  StoreEditorField,
  StoreEditorFrameMessage,
  StoreEditorHostMessage,
  StoreEditorPage as PreviewPage,
  StoreEditorSection,
  StoreEditorSnapshot,
  StoreLayoutItem,
  StoreTemplateContent,
  StoreTemplateFaq,
  StoreTemplateTheme,
  StoreThemeOption,
} from '@agopify/contracts';
import {
  DsChoiceCardComponent,
  DsDisclosureComponent,
  DsEmptyStateComponent,
  DsButtonComponent,
  DsConfirmService,
  DsIconComponent,
  type DsIconName,
} from '@agopify/ui';
import { CatalogApiService } from '../../core/api/catalog-api.service';
import {
  StoreApiService,
  StoreEditorState,
  StoreEditorVersion,
  StoreEditorView,
  type StorePageAi,
  type StorePageAiMode,
  type StoreSectionAi,
  StoreTextAiAction,
} from '../../core/api/store-api.service';
import { IntegrationsStateService } from '../../core/integrations/integrations-state.service';
import { resizeImage } from '../../core/media/resize-image';
import { IntegrationGateComponent } from '../integrations/integration-gate.component';
import { AssistantComposer } from '../get-started/assistant-composer';
import {
  HomeAssistantPanel,
  type AssistantConversation,
  type AssistantPanelMessage,
  type AssistantPanelMode,
} from '../get-started/home-assistant.panel';
import { ConsoleDictationSession } from '../get-started/console-dictation';
import {
  ContentHistory,
  MAX_BLOCKS,
  MAX_FAQ,
  THEME_COLORS,
  THEME_CORNERS,
  THEME_FONTS,
  THEME_CHOICES,
  type AiTextChange,
  type ThemeColorOption,
  addBlock,
  applyPage,
  applyTextChanges,
  canGenerateImage,
  clampValue,
  displayValue,
  fieldKey,
  isOverridden,
  isTextField,
  layoutOf,
  listPageTextChanges,
  moveItem,
  newBlockId,
  removeBlock,
  sectionSchema,
  toggleHidden,
  typeOf,
  withFaq,
  withField,
  withLayout,
  withTheme,
  withoutField,
} from './template-editor';

const SAVE_DELAY_MS = 1200;
const HEX_COLOR = /^#[0-9a-f]{6}$/;
/** Upload target of the logo, which lives in the theme instead of a section. */
const THEME_TARGET = '@theme';
const FRAME_TIMEOUT_MS = 20_000;
const NOTICE_MS = 4000;

type SaveState = 'saved' | 'pending' | 'saving' | 'error';
type Device = 'desktop' | 'tablet' | 'mobile';
const DEVICE_ORDER = ['desktop', 'tablet', 'mobile'] as const satisfies readonly Device[];

/** A section as the panel lists it: `id` is the content key (`hero`, `text-a1b2c3`). */
type PanelSection = Pick<StoreEditorSection, 'label' | 'fields' | 'faq' | 'role' | 'canHide' | 'description'> & {
  id: string;
  hidden: boolean;
  /** Page the preview opens to show it; null for parts of every page. */
  page: PreviewPage | null;
};

const AI_ACTIONS: { id: StoreTextAiAction; label: string }[] = [
  { id: 'write', label: 'Escribir' },
  { id: 'shorter', label: 'Más corto' },
  { id: 'persuasive', label: 'Más vendedor' },
  { id: 'friendly', label: 'Más cercano' },
  { id: 'fix', label: 'Corregir' },
];

const DATE_FORMAT = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/** `datetime-local` value (local time, minutes) of a date. */
function localInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function panelSection(section: StoreEditorSection, id: string, label: string, hidden: boolean): PanelSection {
  const { fields, faq, role, canHide, description } = section;
  const page = role === 'fixed' ? (section.page ?? null) : 'home';
  return { id, label, fields, faq, role, canHide, description, hidden, page };
}

type EditorPlusItem = { id: string; label: string; icon: DsIconName; hint?: string; disabled?: boolean; dividerBefore?: boolean };

@Component({
  selector: 'app-store-editor-page',
  standalone: true,
  imports: [
    RouterLink,
    NgTemplateOutlet,
    FormsModule,
    DsChoiceCardComponent,
    DsDisclosureComponent,
    DsEmptyStateComponent,
    DsButtonComponent,
    DsIconComponent,
    IntegrationGateComponent,
    HomeAssistantPanel,
    AssistantComposer,
  ],
  templateUrl: './store-editor.page.html',
  styleUrls: [
    '../get-started/home-assistant.composer.scss',
    './store-editor.panel.scss',
    './store-editor.versions.scss',
    './store-editor.ai.scss',
    './store-editor.page.scss',
    './store-editor.shell.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:message)': 'onMessage($event)', '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class StoreEditorPage {
  private readonly api = inject(StoreApiService);
  private readonly catalog = inject(CatalogApiService);
  private readonly integrations = inject(IntegrationsStateService);
  private readonly confirmDialog = inject(DsConfirmService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private readonly filePicker = viewChild<ElementRef<HTMLInputElement>>('filePicker');
  private readonly assistantPanel = viewChild(HomeAssistantPanel);
  private readonly homeDictation = new ConsoleDictationSession();
  private readonly history = new ContentHistory();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private dirty = false;
  private savedAt: string | undefined;
  private imageTarget: { section: string; field: string } | null = null;
  private aiRequest = 0;
  private messageSeq = 0;
  readonly homeDictating = this.homeDictation.active;
  readonly homeDictationSupported = this.homeDictation.supported;
  readonly homeDictationError = this.homeDictation.error;

  readonly active = computed(() => this.integrations.isActive('store'));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly view = signal<StoreEditorView | null>(null);
  readonly frameSrc = signal<SafeResourceUrl | null>(null);
  readonly frameReady = signal(false);
  readonly frameFailed = signal(false);
  readonly content = signal<StoreTemplateContent>({ version: 1, sections: {} });
  readonly snapshot = signal<StoreEditorSnapshot | null>(null);
  readonly selectedSection = signal<string | null>(null);
  readonly selectedField = signal<string | null>(null);
  readonly device = signal<Device>('desktop');
  readonly deviceAria = computed(() => {
    switch (this.device()) {
      case 'tablet':
        return 'Vista tablet. Clic para celular';
      case 'mobile':
        return 'Vista celular. Clic para computadora';
      default:
        return 'Vista de computadora. Clic para tablet';
    }
  });
  readonly deviceIcon = computed(() => {
    switch (this.device()) {
      case 'tablet':
        return 'tablet' as const;
      case 'mobile':
        return 'smartphone' as const;
      default:
        return 'monitor' as const;
    }
  });
  readonly deviceTitle = computed(() => {
    switch (this.device()) {
      case 'tablet':
        return 'Tablet';
      case 'mobile':
        return 'Celular';
      default:
        return 'Computadora';
    }
  });
  /** Structure drawer over the preview; closed by default so the canvas dominates. */
  readonly structureOpen = signal(false);
  /** Inspector drawer; opens when a section is selected. */
  readonly inspectorOpen = signal(false);
  readonly sectionQuery = signal('');
  readonly libraryQuery = signal('');
  readonly refreshingFrame = signal(false);
  /** Same home-assistant dock panel as `/app/get-started`. */
  readonly assistantOpen = signal(false);
  readonly assistantMode = signal<AssistantPanelMode>('dock');
  readonly assistantTitle = signal('Diseño de tu tienda');
  readonly assistantMessages = signal<AssistantPanelMessage[]>([]);
  readonly assistantDrafting = signal(false);
  readonly prompt = signal('');
  readonly composerActive = signal(false);
  readonly promptFocused = signal(false);
  readonly homePlusOpen = signal(false);
  readonly saveState = signal<SaveState>('saved');
  readonly hasUnpublished = signal(false);
  readonly scheduledAt = signal<string | null>(null);
  readonly busy = signal<'publish' | 'discard' | 'schedule' | 'restore' | null>(null);
  readonly uploading = signal<string | null>(null);
  readonly notice = signal<{ tone: 'success' | 'danger'; text: string } | null>(null);
  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  readonly panelTab = signal<'sections' | 'style' | 'versions'>('sections');
  /** Previous published designs; null until the Versions tab loads them. */
  readonly versions = signal<StoreEditorVersion[] | null>(null);
  readonly versionsError = signal(false);
  /** Earliest time the schedule input accepts (local `YYYY-MM-DDTHH:mm`). */
  readonly scheduleMin = signal('');
  /** `section.field` whose writing assistant is open. */
  readonly aiField = signal<string | null>(null);
  readonly aiBusy = signal<StoreTextAiAction | null>(null);
  readonly aiSuggestions = signal<string[] | null>(null);
  readonly aiError = signal<string | null>(null);
  readonly aiInstruction = signal('');
  readonly aiActions = AI_ACTIONS;
  readonly aiSectionBusy = signal(false);
  readonly aiSectionError = signal<string | null>(null);
  /** Pending library-block or section-fill proposal awaiting Aplicar. */
  readonly aiSectionDraft = signal<StoreSectionAi | null>(null);
  readonly aiSectionChanges = signal<AiTextChange[]>([]);
  readonly aiSectionSelected = signal<ReadonlySet<string>>(new Set());
  readonly aiSectionIncludeBlock = signal(true);
  readonly aiPageOpen = signal(false);
  readonly aiPageBusy = signal(false);
  readonly aiPageError = signal<string | null>(null);
  readonly aiPageMode = signal<StorePageAiMode>('rewrite');
  /** Pending page proposal awaiting Aplicar / Regenerar / Descartar. */
  readonly aiPageDraft = signal<StorePageAi | null>(null);
  readonly aiPageChanges = signal<AiTextChange[]>([]);
  readonly aiPageSelected = signal<ReadonlySet<string>>(new Set());
  readonly aiPageIncludeBlocks = signal(true);
  readonly aiPagePromptValue = signal('');
  /** `section.field` whose AI photo is being created; it lands in that field even if the panel closes. */
  readonly aiImageBusy = signal<string | null>(null);
  readonly fieldKey = fieldKey;
  readonly isText = isTextField;
  readonly canAiImage = canGenerateImage;
  readonly formatDate = formatDate;
  readonly fonts = THEME_FONTS;
  readonly colors = THEME_COLORS;
  readonly styleChoices = THEME_CHOICES;
  readonly cornerStyles = THEME_CORNERS;
  /** Style the store shows: merchant choices over the template defaults. */
  readonly theme = computed<Required<StoreTemplateTheme> | null>(() => {
    const view = this.view();
    return view ? { ...view.theme.defaults, ...this.content().theme } : null;
  });

  readonly libraryOpen = signal(false);
  readonly dragging = signal<string | null>(null);
  readonly dropTarget = signal<string | null>(null);

  /** Home order being edited (merchant layout of the current template). */
  readonly layout = computed<StoreLayoutItem[]>(() => {
    const view = this.view();
    return view ? layoutOf(this.content(), view.template, view.sections, view.defaultLayout) : [];
  });
  /** Home sections in page order; repeated blocks are numbered. */
  readonly bodySections = computed<PanelSection[]>(() => {
    const schema = this.view()?.sections ?? [];
    const totals = new Map<string, number>();
    for (const item of this.layout()) totals.set(item.type, (totals.get(item.type) ?? 0) + 1);
    const seen = new Map<string, number>();
    return this.layout().flatMap((item) => {
      const section = sectionSchema(schema, item.type);
      if (!section) return [];
      const n = (seen.get(item.type) ?? 0) + 1;
      seen.set(item.type, n);
      const label = section.role === 'block' && (totals.get(item.type) ?? 0) > 1 ? `${section.label} ${n}` : section.label;
      return [panelSection(section, item.id, label, Boolean(item.hidden))];
    });
  });
  /** Sections outside the home body (announcement bar, footer, other pages): texts only. */
  readonly fixedSections = computed<PanelSection[]>(() =>
    (this.view()?.sections ?? []).filter((s) => s.role === 'fixed').map((s) => panelSection(s, s.id, s.label, false)),
  );
  readonly globalSections = computed(() => this.fixedSections().filter((s) => !s.page));
  readonly pageSections = computed(() => this.fixedSections().filter((s) => s.page));
  readonly library = computed(() => (this.view()?.sections ?? []).filter((s) => s.role === 'block'));
  readonly filteredBodySections = computed(() => this.bodySections().filter(s => this.matchesSection(s)));
  readonly filteredGlobalSections = computed(() => this.globalSections().filter(s => this.matchesSection(s)));
  readonly filteredPageSections = computed(() => this.pageSections().filter(s => this.matchesSection(s)));
  readonly filteredLibrary = computed(() => {
    const query = this.normalizeSearch(this.libraryQuery());
    return this.library().filter(s => this.normalizeSearch(`${s.label} ${s.description ?? ''}`).includes(query));
  });

  private normalizeSearch(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase(); }
  private matchesSection(section: PanelSection): boolean {
    return this.normalizeSearch(`${section.label} ${section.description ?? ''} ${section.fields.map(f => f.label).join(' ')}`).includes(this.normalizeSearch(this.sectionQuery()));
  }
  readonly blockCount = computed(() => this.bodySections().filter((s) => s.role === 'block').length);
  readonly maxBlocks = MAX_BLOCKS;
  readonly section = computed(
    () => [...this.bodySections(), ...this.fixedSections()].find((s) => s.id === this.selectedSection()) ?? null,
  );
  /** Where a new block goes: below the open home section, else at the end. */
  readonly insertAfter = computed(() => this.bodySections().find((s) => s.id === this.selectedSection()) ?? null);
  readonly customFaq = computed(() => this.content().faq ?? null);
  readonly maxFaq = MAX_FAQ;
  readonly saveLabel = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return 'Guardando…';
      case 'pending':
        return 'Cambios sin guardar';
      case 'error':
        return 'No se pudo guardar';
      default: {
        const at = this.scheduledAt();
        if (at) return `Se publica el ${formatDate(at)}`;
        return this.hasUnpublished() ? 'Borrador guardado' : 'Sin cambios pendientes';
      }
    }
  });

  readonly assistantPlaceholder = computed(() =>
    this.view()?.aiText ? 'Trabaja con Agopify' : 'La IA del editor no está disponible',
  );

  readonly homePlusItems: EditorPlusItem[] = [
    { id: 'fill', label: 'Rellenar vacíos', icon: 'sparkles' },
    { id: 'rewrite', label: 'Crear página', icon: 'layers' },
    { id: 'structure', label: 'Abrir estructura', icon: 'layers', dividerBefore: true },
    { id: 'files', label: 'Archivos', icon: 'fileText', disabled: true },
    { id: 'voice', label: 'Llamada de voz', icon: 'radio', disabled: true, dividerBefore: true },
  ];

  constructor() {
    void this.load();
    inject(DestroyRef).onDestroy(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      if (this.frameTimer) clearTimeout(this.frameTimer);
      if (this.noticeTimer) clearTimeout(this.noticeTimer);
      this.homeDictation.destroy();
      if (this.dirty) void this.api.saveDraft(this.content(), this.savedAt).catch(() => undefined);
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      await this.integrations.refresh();
      if (!this.active()) return;
      const view = await this.api.editor();
      this.view.set(view);
      this.content.set(view.content);
      this.applyState(view);
      this.selectedSection.set(view.sections[0]?.id ?? null);
      this.startFrame(view.frameUrl);
    } catch (error) {
      this.loadError.set(this.messageFrom(error, 'No pudimos abrir el editor. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** New signed frame URL (the previous one may have expired). */
  async reloadFrame(): Promise<void> {
    if (this.refreshingFrame()) return;
    this.refreshingFrame.set(true);
    try {
      const view = await this.api.editor();
      this.view.update((current) => (current ? { ...current, frameUrl: view.frameUrl, frameExpiresAt: view.frameExpiresAt } : view));
      this.startFrame(view.frameUrl);
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos recargar la vista de tu tienda.') });
    } finally {
      this.refreshingFrame.set(false);
    }
  }

  onMessage(event: MessageEvent): void {
    const frame = this.frame()?.nativeElement;
    const view = this.view();
    if (!frame || !view || event.source !== frame.contentWindow || event.origin !== new URL(view.frameUrl).origin) return;
    const message = event.data as StoreEditorFrameMessage | null;
    if (message?.source !== 'agopify-store') return;
    switch (message.type) {
      case 'snapshot':
        this.snapshot.set(message.snapshot);
        if (!this.frameReady()) {
          this.frameReady.set(true);
          this.frameFailed.set(false);
          if (this.frameTimer) clearTimeout(this.frameTimer);
          this.push();
          this.syncFrameSelection();
        }
        break;
      case 'select':
        if (!message.section) {
          this.selectedSection.set(null);
          this.selectedField.set(null);
          break;
        }
        this.applySelection(message.section, message.field, false);
        break;
      case 'input':
        this.edit(message.section, message.field, message.value, false);
        break;
      case 'commit': {
        const field = this.field(message.section, message.field);
        const value = field ? clampValue(field, message.value) : message.value;
        this.edit(message.section, message.field, value, value !== message.value);
        break;
      }
      case 'image':
        this.applySelection(message.section, message.field, false);
        this.chooseImage(message.section, message.field);
        break;
    }
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty || this.saveState() === 'saving') event.preventDefault();
  }

  /** Accordion header: opens the section (and scrolls the store to it) or closes it. */
  toggleSection(id: string): void {
    if (this.selectedSection() === id) {
      this.clearSelection();
      return;
    }
    this.selectSection(id);
  }

  selectSection(id: string): void {
    if (![...this.bodySections(), ...this.fixedSections()].some((s) => s.id === id)) return;
    this.applySelection(id, null);
  }

  /** Clears host + preview selection (Escape or accordion collapse). */
  clearSelection(): void {
    this.selectedSection.set(null);
    this.selectedField.set(null);
    this.inspectorOpen.set(false);
    this.post({ source: 'agopify-editor', type: 'select', section: null, field: null });
  }

  toggleLibrary(): void {
    this.libraryOpen.update((open) => !open);
    if (this.libraryOpen()) this.reveal('#section-library');
  }

  setAiPageMode(mode: StorePageAiMode): void {
    this.aiPageMode.set(mode);
    this.discardPageAi();
  }

  /** Generates a page patch for preview (does not write the draft until Aplicar). */
  async generatePageWithAi(): Promise<void> {
    const mode = this.aiPageMode();
    const prompt =
      this.aiPagePromptValue().trim() ||
      (mode === 'fillEmpty' ? 'Rellena los textos vacíos de mi tienda con los datos del negocio.' : '');
    if (prompt.length < 3) {
      this.aiPageError.set('Cuéntanos de tu negocio y qué quieres destacar.');
      return;
    }
    if (mode === 'rewrite' && this.blockCount() > 0 && !this.aiPageDraft()) {
      const confirmed = await this.confirmDialog.confirm({
        title: '¿Crear tu página con IA?',
        message:
          'Vas a ver una propuesta antes de aplicarla. Si la aceptas con secciones nuevas, reemplazará las que agregaste. Tus fotos se mantienen.',
        confirmLabel: 'Generar propuesta',
      });
      if (!confirmed) return;
    }
    this.aiPageBusy.set(true);
    this.aiPageError.set(null);
    try {
      const page = await this.api.suggestPage(prompt, mode);
      const view = this.view();
      if (!view) return;
      const changes = listPageTextChanges(this.content(), view.sections, page);
      if (!changes.length && !(mode === 'rewrite' && page.blocks.length)) {
        this.aiPageError.set(
          mode === 'fillEmpty'
            ? 'No hay cambios que aplicar en los textos vacíos.'
            : 'No salió una propuesta útil. Prueba contándonos más de tu negocio.',
        );
        this.aiPageDraft.set(null);
        this.aiPageChanges.set([]);
        return;
      }
      this.aiPageDraft.set(page);
      this.aiPageChanges.set(changes);
      this.aiPageSelected.set(new Set(changes.map((c) => c.key)));
      this.aiPageIncludeBlocks.set(mode === 'rewrite' && page.blocks.length > 0);
    } catch (error) {
      this.aiPageError.set(this.messageFrom(error, 'No pudimos crear la página. Inténtalo de nuevo.'));
      this.aiPageDraft.set(null);
      this.aiPageChanges.set([]);
    } finally {
      this.aiPageBusy.set(false);
    }
  }

  togglePageAiChange(key: string): void {
    const next = new Set(this.aiPageSelected());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.aiPageSelected.set(next);
  }

  applyPageAi(): void {
    const page = this.aiPageDraft();
    const view = this.view();
    if (!page || !view) return;
    const includeBlocks = this.aiPageIncludeBlocks() && page.blocks.length > 0;
    if (!this.aiPageSelected().size && !includeBlocks) {
      this.aiPageError.set('Elige al menos un texto o las secciones nuevas para aplicar.');
      return;
    }
    this.change(
      applyPage(this.content(), view.template, view.sections, page, (type) => newBlockId(type), {
        selectedKeys: this.aiPageSelected(),
        includeBlocks,
      }),
      null,
    );
    this.push();
    this.discardPageAi();
    this.aiPageOpen.set(false);
    this.aiPagePromptValue.set('');
    this.clearSelection();
    this.success(
      includeBlocks
        ? 'Propuesta aplicada. Revisa los textos, agrega tus fotos y publica cuando quieras.'
        : 'Textos aplicados. Puedes deshacerlo con Ctrl+Z.',
    );
  }

  discardPageAi(): void {
    this.aiPageDraft.set(null);
    this.aiPageChanges.set([]);
    this.aiPageSelected.set(new Set());
    this.aiPageIncludeBlocks.set(true);
    this.aiPageError.set(null);
  }

  /** Generates a new library block or fills the selected section; preview before apply. */
  async generateSectionWithAi(promptOrInput: string | HTMLTextAreaElement, targetSection: string | null = null): Promise<void> {
    const prompt = (typeof promptOrInput === 'string' ? promptOrInput : promptOrInput.value).trim();
    if (!prompt) {
      this.aiSectionError.set(
        targetSection ? 'Cuéntanos cómo quieres esta sección.' : 'Cuéntanos qué sección quieres crear.',
      );
      return;
    }
    this.aiSectionBusy.set(true);
    this.aiSectionError.set(null);
    try {
      const draft = await this.api.suggestSection(prompt, targetSection ?? undefined);
      const view = this.view();
      if (!view) return;
      if (draft.target) {
        const section = sectionSchema(view.sections, typeOf(draft.target));
        if (!section) throw new Error('section');
        const changes = listPageTextChanges(this.content(), view.sections, {
          sections: { [draft.target]: draft.texts },
          blocks: [],
        });
        if (!changes.length) {
          this.aiSectionError.set('No hay cambios que aplicar en esta sección.');
          this.aiSectionDraft.set(null);
          return;
        }
        this.aiSectionDraft.set(draft);
        this.aiSectionChanges.set(changes);
        this.aiSectionSelected.set(new Set(changes.map((c) => c.key)));
        this.aiSectionIncludeBlock.set(false);
      } else {
        const block = this.library().find((b) => b.id === draft.type);
        if (!block || this.blockCount() >= MAX_BLOCKS) throw new Error('block');
        const changes: AiTextChange[] = block.fields
          .filter(isTextField)
          .filter((f) => typeof draft.texts[f.id] === 'string')
          .map((f) => ({
            key: fieldKey(`new:${block.id}`, f.id),
            sectionId: `new:${block.id}`,
            sectionLabel: block.label,
            fieldId: f.id,
            fieldLabel: f.label,
            from: '',
            to: clampValue(f, draft.texts[f.id]),
          }));
        this.aiSectionDraft.set(draft);
        this.aiSectionChanges.set(changes);
        this.aiSectionSelected.set(new Set(changes.map((c) => c.key)));
        this.aiSectionIncludeBlock.set(true);
      }
    } catch (error) {
      this.aiSectionError.set(this.messageFrom(error, 'No pudimos preparar la sección. Inténtalo de nuevo.'));
      this.aiSectionDraft.set(null);
      this.aiSectionChanges.set([]);
    } finally {
      this.aiSectionBusy.set(false);
    }
  }

  toggleSectionAiChange(key: string): void {
    const next = new Set(this.aiSectionSelected());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.aiSectionSelected.set(next);
  }

  applySectionAi(input?: HTMLTextAreaElement): void {
    const draft = this.aiSectionDraft();
    const view = this.view();
    if (!draft || !view) return;
    if (draft.target) {
      if (!this.aiSectionSelected().size) {
        this.aiSectionError.set('Elige al menos un texto para aplicar.');
        return;
      }
      this.change(applyTextChanges(this.content(), this.aiSectionChanges(), this.aiSectionSelected()), null);
      this.push();
      this.selectSection(draft.target);
      this.success('Textos de la sección aplicados. Puedes deshacerlo con Ctrl+Z.');
    } else {
      const block = this.library().find((b) => b.id === draft.type);
      if (!block || this.blockCount() >= MAX_BLOCKS) {
        this.aiSectionError.set('No pudimos agregar esa sección.');
        return;
      }
      const id = newBlockId(block.id);
      const added = addBlock(this.content(), view.template, this.layout(), block, id, this.insertAfter()?.id ?? null);
      const selected = this.aiSectionSelected();
      const written = Object.fromEntries(
        block.fields
          .filter(isTextField)
          .filter((f) => selected.has(fieldKey(`new:${block.id}`, f.id)) && typeof draft.texts[f.id] === 'string')
          .map((f) => [f.id, clampValue(f, draft.texts[f.id])]),
      );
      this.change(
        { ...added, sections: { ...added.sections, [id]: { ...added.sections[id], ...written } } },
        null,
      );
      this.push();
      this.libraryOpen.set(false);
      this.selectSection(id);
      this.success(`Sección «${block.label}» creada. Revisa sus textos y agrega fotos si lleva.`);
    }
    if (input) input.value = '';
    this.discardSectionAi();
  }

  discardSectionAi(): void {
    this.aiSectionDraft.set(null);
    this.aiSectionChanges.set([]);
    this.aiSectionSelected.set(new Set());
    this.aiSectionIncludeBlock.set(true);
    this.aiSectionError.set(null);
  }

  /** Intent: rewrite / complete texts of the selected section. */
  fillSelectedSectionWithAi(): void {
    const selected = this.section();
    if (!selected || !this.view()?.aiText) return;
    this.libraryOpen.set(false);
    this.aiPageOpen.set(false);
    this.discardSectionAi();
    void this.generateSectionWithAi(
      `Mejora o completa los textos de la sección «${selected.label}» con los datos de mi negocio.`,
      selected.id,
    );
  }

  moveSection(id: string, delta: number): void {
    const index = this.layout().findIndex((item) => item.id === id);
    if (index !== -1) this.changeLayout(moveItem(this.layout(), id, index + delta));
  }

  toggleVisibility(id: string): void {
    this.changeLayout(toggleHidden(this.layout(), id));
  }

  addSection(block: StoreEditorSection): void {
    const view = this.view();
    if (!view || this.blockCount() >= MAX_BLOCKS) return;
    const id = newBlockId(block.id);
    this.change(addBlock(this.content(), view.template, this.layout(), block, id, this.insertAfter()?.id ?? null), null);
    this.push();
    this.libraryOpen.set(false);
    this.libraryQuery.set('');
    this.selectSection(id);
  }

  removeSection(id: string): void {
    const view = this.view();
    if (!view) return;
    this.change(removeBlock(this.content(), view.template, this.layout(), id), null);
    this.push();
    if (this.selectedSection() === id) this.clearSelection();
    this.success('Sección quitada. Puedes deshacerlo con Ctrl+Z.');
  }

  onDragStart(event: DragEvent, id: string): void {
    this.dragging.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, id: string): void {
    if (!this.dragging()) return;
    event.preventDefault();
    this.dropTarget.set(id);
  }

  onDrop(event: DragEvent, id: string): void {
    event.preventDefault();
    const dragged = this.dragging();
    this.onDragEnd();
    if (!dragged || dragged === id) return;
    this.changeLayout(moveItem(this.layout(), dragged, this.layout().findIndex((item) => item.id === id)));
  }

  onDragEnd(): void {
    this.dragging.set(null);
    this.dropTarget.set(null);
  }

  value(section: string, field: string): string {
    return displayValue(this.content(), this.snapshot(), section, field);
  }

  overridden(section: string, field: string): boolean {
    return isOverridden(this.content(), section, field);
  }

  /** Edits from the inspector: they are pushed to the page right away. */
  editFromPanel(section: string, field: StoreEditorField, value: string): void {
    this.edit(section, field.id, clampValue(field, value), true);
  }

  toggleAi(section: string, field: string): void {
    const key = fieldKey(section, field);
    this.aiRequest++;
    this.aiBusy.set(null);
    this.aiSuggestions.set(null);
    this.aiError.set(null);
    this.aiInstruction.set('');
    this.aiField.set(this.aiField() === key ? null : key);
  }

  async suggest(section: string, field: StoreEditorField, action: StoreTextAiAction): Promise<void> {
    const request = ++this.aiRequest;
    this.aiBusy.set(action);
    this.aiError.set(null);
    try {
      const { suggestions } = await this.api.suggestText({
        section,
        field: field.id,
        action,
        current: this.value(section, field.id),
        instruction: this.aiInstruction().trim() || undefined,
      });
      if (request === this.aiRequest) this.aiSuggestions.set(suggestions);
    } catch (error) {
      if (request === this.aiRequest) {
        this.aiError.set(this.messageFrom(error, 'No pudimos generar textos ahora. Inténtalo de nuevo.'));
      }
    } finally {
      if (request === this.aiRequest) this.aiBusy.set(null);
    }
  }

  /** The chosen text becomes one undo step, like any other edit. */
  useSuggestion(section: string, field: StoreEditorField, text: string): void {
    this.change(withField(this.content(), section, field.id, clampValue(field, text)), null);
    this.push();
    this.toggleAi(section, field.id);
    this.success('Texto aplicado. Puedes deshacerlo con Ctrl+Z.');
  }

  async createImage(section: string, field: string): Promise<void> {
    const key = fieldKey(section, field);
    this.aiImageBusy.set(key);
    this.aiError.set(null);
    try {
      const { url } = await this.api.suggestImage({
        section,
        field,
        instruction: this.aiInstruction().trim() || undefined,
      });
      this.change(withField(this.content(), section, field, url), null);
      this.push();
      if (this.aiField() === key) this.toggleAi(section, field);
      this.success('Imagen creada y aplicada. Puedes deshacerlo con Ctrl+Z.');
    } catch (error) {
      const text = this.messageFrom(error, 'No pudimos crear la imagen. Inténtalo de nuevo.');
      if (this.aiField() === key) this.aiError.set(text);
      else this.notice.set({ tone: 'danger', text });
    } finally {
      this.aiImageBusy.set(null);
    }
  }

  restore(section: string, field: string): void {
    this.change(withoutField(this.content(), section, field), null);
    this.push();
  }

  setChoice(section: string, field: string, value: string): void {
    this.change(withField(this.content(), section, field, value), null);
    this.push();
  }

  hideImage(section: string, field: string): void {
    this.change(withField(this.content(), section, field, ''), null);
    this.push();
  }

  chooseImage(section: string, field: string): void {
    this.imageTarget = { section, field };
    this.filePicker()?.nativeElement.click();
  }

  async onImagePicked(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    const target = this.imageTarget;
    if (!file || !target) return;
    this.uploading.set(fieldKey(target.section, target.field));
    this.notice.set(null);
    try {
      const logo = target.section === THEME_TARGET;
      const image = await resizeImage(file, logo ? 800 : 2000);
      const { url } = await this.catalog.uploadMedia(image.contentType, image.data);
      if (logo) {
        this.setTheme(target.field === 'favicon' ? 'favicon' : 'logo', url);
      } else {
        this.change(withField(this.content(), target.section, target.field, url), null);
        this.push();
      }
    } catch (error) {
      this.notice.set({
        tone: 'danger',
        text: this.messageFrom(error, 'No pudimos subir la imagen. Usa una foto JPG, PNG o WebP e inténtalo de nuevo.'),
      });
    } finally {
      this.uploading.set(null);
    }
  }

  hasThemeOption(option: StoreThemeOption): boolean {
    return this.view()?.theme.options.includes(option) ?? false;
  }

  themeChanged(option: StoreThemeOption): boolean {
    return this.content().theme?.[option] !== undefined;
  }

  /** `merge` joins quick changes (dragging the color picker) into one undo step. */
  setTheme<K extends StoreThemeOption>(option: K, value: StoreTemplateTheme[K] | undefined, merge = false): void {
    this.change(withTheme(this.content(), option, value), merge ? `theme.${option}` : null);
    this.push();
  }

  /** Hex typed by hand: applied when valid, otherwise the field shows the current color again. */
  typeColor(option: ThemeColorOption, input: HTMLInputElement): void {
    const raw = input.value.trim().toLowerCase();
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (HEX_COLOR.test(hex)) this.setTheme(option, hex);
    else input.value = this.theme()?.[option] ?? '';
  }

  chooseLogo(): void {
    this.imageTarget = { section: THEME_TARGET, field: 'logo' };
    this.filePicker()?.nativeElement.click();
  }

  chooseFavicon(): void {
    this.imageTarget = { section: THEME_TARGET, field: 'favicon' };
    this.filePicker()?.nativeElement.click();
  }

  setStyleChoice(option: 'container' | 'spacing' | 'typeScale', value: string): void {
    const allowed = this.styleChoices.find(choice => choice.id === option)?.options;
    if (allowed?.some(choice => choice.value === value)) this.setTheme(option, value as StoreTemplateTheme[typeof option]);
  }

  customizeFaq(): void {
    this.change(withFaq(this.content(), this.snapshot()?.faq ?? []), null);
    this.push();
  }

  useAutomaticFaq(): void {
    this.change(withFaq(this.content(), undefined), null);
    this.push();
  }

  addFaq(): void {
    const faq = this.customFaq() ?? [];
    if (faq.length >= MAX_FAQ) return;
    this.change(withFaq(this.content(), [...faq, { question: 'Nueva pregunta', answer: 'Escribe aquí la respuesta.' }]), null);
    this.push();
  }

  editFaq(index: number, part: keyof StoreTemplateFaq, value: string): void {
    const faq = [...(this.customFaq() ?? [])];
    if (!faq[index]) return;
    faq[index] = { ...faq[index], [part]: value.slice(0, part === 'question' ? 200 : 1200) };
    this.change(withFaq(this.content(), faq), `faq.${index}.${part}`);
    this.push();
  }

  removeFaq(index: number): void {
    this.change(withFaq(this.content(), (this.customFaq() ?? []).filter((_, i) => i !== index)), null);
    this.push();
  }

  undo(): void {
    const previous = this.history.undo(this.content());
    if (previous) this.apply(previous);
  }

  redo(): void {
    const next = this.history.redo(this.content());
    if (next) this.apply(next);
  }

  /**
   * Ctrl/Cmd+S saves; Ctrl/Cmd+Z undoes outside text fields; Escape clears the selection
   * (or closes the AI / library overlays first).
   */
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = Boolean(target?.closest('input, textarea, select, [role="combobox"], [contenteditable="true"]'));

    if (event.key === 'Escape') {
      if (typing || event.defaultPrevented) return;
      if (this.aiField()) {
        event.preventDefault();
        this.aiRequest++;
        this.aiBusy.set(null);
        this.aiSuggestions.set(null);
        this.aiError.set(null);
        this.aiInstruction.set('');
        this.aiField.set(null);
        return;
      }
      if (this.aiPageDraft()) {
        event.preventDefault();
        this.discardPageAi();
        return;
      }
      if (this.aiSectionDraft()) {
        event.preventDefault();
        this.discardSectionAi();
        return;
      }
      if (this.assistantOpen()) {
        event.preventDefault();
        this.closeAssistant();
        return;
      }
      if (this.aiPageOpen()) {
        event.preventDefault();
        this.aiPageOpen.set(false);
        this.discardPageAi();
        return;
      }
      if (this.libraryOpen()) {
        event.preventDefault();
        this.libraryOpen.set(false);
        this.discardSectionAi();
        return;
      }
      if (this.structureOpen()) {
        event.preventDefault();
        this.structureOpen.set(false);
        return;
      }
      if (this.inspectorOpen() && this.selectedSection() === null && this.selectedField() === null) {
        event.preventDefault();
        this.inspectorOpen.set(false);
        return;
      }
      if (this.selectedSection() !== null || this.selectedField() !== null) {
        event.preventDefault();
        this.clearSelection();
      }
      return;
    }

    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!this.busy() && !this.loading() && this.active()) void this.flush();
      return;
    }
    if (event.key.toLowerCase() !== 'z') return;
    if (typing) return;
    event.preventDefault();
    if (event.shiftKey) this.redo();
    else this.undo();
  }

  async retrySave(): Promise<void> {
    this.dirty = true;
    await this.flush();
  }

  async publish(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('publish');
    this.notice.set(null);
    try {
      await this.flush();
      if (this.saveState() === 'error') throw new Error('save');
      const state = await this.api.publishDraft(this.savedAt);
      this.applyState(state);
      this.versions.set(null);
      if (this.panelTab() === 'versions') void this.loadVersions();
      this.success(
        this.view()?.storeStatus === 'PUBLISHED'
          ? 'Cambios publicados. Tus clientes ya ven la nueva versión.'
          : 'Cambios listos. Se verán cuando publiques tu tienda.',
      );
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos publicar los cambios. Inténtalo de nuevo.') });
    } finally {
      this.busy.set(null);
    }
  }

  async discard(): Promise<void> {
    if (this.busy()) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '¿Descartar los cambios sin publicar?',
      message: 'Tu tienda vuelve a la última versión publicada. Esta acción no se puede deshacer.',
      confirmLabel: 'Descartar cambios',
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;
    this.busy.set('discard');
    this.notice.set(null);
    try {
      await this.stopSaving();
      const state = await this.api.discardDraft(this.savedAt);
      this.content.set(state.content);
      this.applyState(state);
      this.saveState.set('saved');
      this.push();
      this.success('Cambios descartados.');
      if (state.template !== this.view()?.template || state.themeVersion !== this.view()?.themeVersion) await this.load();
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos descartar los cambios.') });
    } finally {
      this.busy.set(null);
    }
  }

  openTab(tab: 'sections' | 'style' | 'versions'): void {
    this.panelTab.set(tab);
    if (tab !== 'versions') return;
    this.scheduleMin.set(localInputValue(new Date(Date.now() + 10 * 60_000)));
    if (!this.versions()) void this.loadVersions();
  }

  async loadVersions(): Promise<void> {
    this.versionsError.set(false);
    try {
      this.versions.set(await this.api.editorVersions());
    } catch {
      this.versionsError.set(true);
    }
  }

  /** `value` comes from a `datetime-local` input, in the merchant's local time. */
  async schedule(value: string): Promise<void> {
    if (this.busy()) return;
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      this.notice.set({ tone: 'danger', text: 'Elige el día y la hora en que quieres publicar.' });
      return;
    }
    this.busy.set('schedule');
    this.notice.set(null);
    try {
      await this.flush();
      if (this.saveState() === 'error') throw new Error('save');
      const state = await this.api.scheduleDraft(date.toISOString(), this.savedAt);
      this.applyState(state);
      this.success(`Listo: el ${formatDate(date.toISOString())} se publicarán tus cambios.`);
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos programar la publicación. Inténtalo de nuevo.') });
    } finally {
      this.busy.set(null);
    }
  }

  async cancelSchedule(): Promise<void> {
    if (this.busy()) return;
    this.busy.set('schedule');
    this.notice.set(null);
    try {
      this.applyState(await this.api.cancelSchedule(this.savedAt));
      this.success('Programación cancelada. Tus cambios siguen guardados como borrador.');
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos cancelar la programación.') });
    } finally {
      this.busy.set(null);
    }
  }

  /** Restores content and release together, then reloads the matching editor schema. */
  async restoreVersion(version: StoreEditorVersion): Promise<void> {
    if (this.busy()) return;
    const confirmed = await this.confirmDialog.confirm({
      title: '¿Restaurar esta versión?',
      message: `El diseño publicado hasta el ${formatDate(version.replacedAt)} pasará a tu borrador y reemplazará tus cambios sin publicar. Tus clientes no verán nada hasta que publiques.`,
      confirmLabel: 'Restaurar',
    });
    if (!confirmed || this.busy()) return;
    this.busy.set('restore');
    this.notice.set(null);
    try {
      await this.stopSaving();
      const state = await this.api.restoreVersion(version.id, this.savedAt);
      this.history.record(this.content(), null);
      this.content.set(state.content);
      this.syncHistory();
      this.applyState(state);
      this.saveState.set('saved');
      this.push();
      this.success('Versión restaurada en tu borrador. Revísala y publícala cuando quieras.');
      await this.load();
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos restaurar esa versión.') });
    } finally {
      this.busy.set(null);
    }
  }

  private applyState(state: StoreEditorState): void {
    this.savedAt = state.savedAt;
    this.hasUnpublished.set(state.hasUnpublishedChanges);
    this.scheduledAt.set(state.scheduledAt);
  }

  /** Drops the pending autosave and waits for the one in flight. */
  private async stopSaving(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.dirty = false;
    await this.saving;
  }

  private field(section: string, field: string): StoreEditorField | undefined {
    return sectionSchema(this.view()?.sections ?? [], typeOf(section))?.fields.find((f) => f.id === field);
  }

  /**
   * Opens the content inspector on a section/field. When `mirror` is true (host-originated),
   * the preview scrolls/highlights to match; frame-originated selections already did that.
   */
  /** Cycles desktop → tablet → mobile → desktop (same control, Aloja-style). */
  cycleDevice(): void {
    const current = this.device();
    const next = DEVICE_ORDER[(DEVICE_ORDER.indexOf(current) + 1) % DEVICE_ORDER.length];
    this.device.set(next);
  }

  toggleStructure(): void {
    this.structureOpen.update((open) => !open);
  }

  toggleInspector(): void {
    this.inspectorOpen.update((open) => !open);
  }

  toggleAssistant(): void {
    if (this.assistantOpen()) {
      this.closeAssistant();
      return;
    }
    this.assistantOpen.set(true);
    this.assistantMode.set('dock');
    queueMicrotask(() => this.assistantPanel()?.focusInput());
  }

  closeAssistant(): void {
    this.assistantOpen.set(false);
    this.assistantDrafting.set(false);
    this.assistantMode.set('dock');
  }

  setAssistantMode(mode: AssistantPanelMode): void {
    this.assistantMode.set(mode);
  }

  resetAssistantChat(): void {
    this.assistantMessages.set([]);
    this.assistantDrafting.set(false);
    this.assistantTitle.set('Diseño de tu tienda');
    this.discardPageAi();
    queueMicrotask(() => this.assistantPanel()?.focusInput());
  }

  onRestoreConversation(conversation: AssistantConversation): void {
    this.assistantDrafting.set(false);
    this.assistantTitle.set(conversation.title || 'Diseño de tu tienda');
    this.assistantMessages.set(conversation.messages.map((m) => ({ ...m })));
    this.discardPageAi();
    queueMicrotask(() => this.assistantPanel()?.focusInput());
  }

  onAssistantSent(text: string): void {
    void this.runAssistantPrompt(text);
  }

  onAssistantPlus(id: string): void {
    this.onHomePlus(id);
  }

  openStructureFromChat(): void {
    this.structureOpen.set(true);
    this.homePlusOpen.set(false);
  }

  startHomeDictation(): void {
    if (this.homeDictating() || this.aiPageBusy()) return;
    this.homePlusOpen.set(false);
    this.composerActive.set(true);
    this.homeDictation.start({
      getText: () => this.prompt(),
      setText: (value) => this.prompt.set(value),
    });
  }

  cancelHomeDictation(): void {
    this.homeDictation.cancel();
  }

  confirmHomeDictation(): void {
    this.homeDictation.confirm();
  }

  onComposerActivate(): void {
    this.composerActive.set(true);
  }

  onComposerFocusIn(): void {
    this.composerActive.set(true);
  }

  onComposerFocusOut(event: FocusEvent): void {
    const root = event.currentTarget as HTMLElement | null;
    window.setTimeout(() => {
      if (!root?.contains(document.activeElement)) {
        this.composerActive.set(false);
        this.promptFocused.set(false);
        this.homePlusOpen.set(false);
      }
    }, 0);
  }

  onPromptFocus(): void {
    this.promptFocused.set(true);
    this.composerActive.set(true);
    this.homePlusOpen.set(false);
  }

  onPromptBlur(): void {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active?.id === 'editor-assistant-input') return;
      if (active?.closest?.('.home-assistant__suggestions')) return;
      this.promptFocused.set(false);
    }, 0);
  }

  toggleHomePlus(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.composerActive.set(true);
    this.promptFocused.set(false);
    this.homePlusOpen.update((open) => !open);
  }

  onHomePlus(id: string): void {
    this.homePlusOpen.set(false);
    if (id === 'fill') {
      void this.openAssistantWith('Rellenar los textos vacíos de mi tienda', 'fillEmpty');
      return;
    }
    if (id === 'rewrite') {
      void this.openAssistantWith('Crea la página de inicio de mi tienda con los datos del negocio.', 'rewrite');
      return;
    }
    if (id === 'structure') {
      this.openStructureFromChat();
    }
  }

  onPromptEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    this.submitPrompt();
  }

  onFloatComposerSubmitted(text: string): void {
    if (!this.view()?.aiText || this.aiPageBusy()) return;
    if (text.trim().length < 3) {
      this.aiPageError.set('Escribe qué quieres cambiar en tu tienda.');
      return;
    }
    this.prompt.set('');
    this.homePlusOpen.set(false);
    void this.openAssistantWith(text.trim(), 'rewrite');
  }

  submitPrompt(event?: Event): void {
    event?.preventDefault();
    if (!this.view()?.aiText || this.aiPageBusy()) return;
    const text = this.prompt().trim();
    if (text.length < 3) {
      this.aiPageError.set('Escribe qué quieres cambiar en tu tienda.');
      return;
    }
    this.prompt.set('');
    this.homePlusOpen.set(false);
    void this.openAssistantWith(text, 'rewrite');
  }

  /** Opens the home dock panel and runs a store page-AI proposal (preview before apply). */
  private async openAssistantWith(text: string, mode: StorePageAiMode): Promise<void> {
    this.assistantOpen.set(true);
    this.assistantMode.set('dock');
    this.assistantTitle.set(text.slice(0, 72) || 'Diseño de tu tienda');
    queueMicrotask(() => this.assistantPanel()?.focusInput());
    await this.runAssistantPrompt(text, mode);
  }

  private async runAssistantPrompt(text: string, mode: StorePageAiMode = 'rewrite'): Promise<void> {
    if (!this.view()?.aiText) return;
    const user: AssistantPanelMessage = { id: `u-${++this.messageSeq}`, role: 'user', text };
    this.assistantMessages.update((messages) => [...messages, user]);
    this.assistantDrafting.set(true);
    this.discardPageAi();
    this.aiPageOpen.set(true);
    this.aiPageMode.set(mode);
    this.aiPagePromptValue.set(mode === 'fillEmpty' ? '' : text);
    await this.generatePageWithAi();
    this.assistantDrafting.set(false);
    const draft = this.aiPageDraft();
    const n = this.aiPageChanges().length;
    const blocks = draft?.blocks.length ?? 0;
    const reply =
      this.aiPageError() ??
      (draft
        ? n || blocks
          ? `Propuesta lista${n ? `: ${n} texto${n === 1 ? '' : 's'}` : ''}${blocks ? ` y ${blocks} sección${blocks === 1 ? '' : 'es'} nueva${blocks === 1 ? '' : 's'}` : ''}. Revísala sobre la vista y aplícala cuando quieras.`
          : 'No encontré cambios que proponer. Prueba con otra indicación.'
        : 'No pudimos generar la propuesta.');
    this.assistantMessages.update((messages) => [
      ...messages,
      { id: `a-${++this.messageSeq}`, role: 'assistant', text: reply },
    ]);
  }

  private applySelection(sectionId: string, fieldId: string | null, mirror = true): void {
    if (![...this.bodySections(), ...this.fixedSections()].some((s) => s.id === sectionId)) return;
    this.inspectorOpen.set(true);
    this.panelTab.set('sections');
    this.sectionQuery.set('');
    this.selectedSection.set(sectionId);
    this.selectedField.set(fieldId);
    if (mirror) {
      const page = [...this.bodySections(), ...this.fixedSections()].find((s) => s.id === sectionId)?.page ?? undefined;
      this.post({ source: 'agopify-editor', type: 'select', section: sectionId, page, field: fieldId });
    }
    this.revealSelection(sectionId, fieldId);
  }

  /** Re-applies the current selection after the preview frame reconnects. */
  private syncFrameSelection(): void {
    const sectionId = this.selectedSection();
    if (!sectionId) return;
    const page = [...this.bodySections(), ...this.fixedSections()].find((s) => s.id === sectionId)?.page ?? undefined;
    this.post({
      source: 'agopify-editor',
      type: 'select',
      section: sectionId,
      page,
      field: this.selectedField(),
    });
  }

  /** Brings a panel element into view once the pending render (new section, opened library) is in the DOM. */
  private reveal(selector: string): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector(selector)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      { injector: this.injector },
    );
  }

  /** Scrolls structure + inspector to the active section/field without stealing canvas focus. */
  private revealSelection(sectionId: string, fieldId: string | null): void {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      root
        .querySelector(`.section[data-section="${CSS.escape(sectionId)}"] .section__bar`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const inspectorTarget = fieldId
        ? root.querySelector(`[data-inspector-field="${CSS.escape(fieldKey(sectionId, fieldId))}"]`)
        : root.querySelector('.inspector__heading') ?? root.querySelector('.inspector__content');
      inspectorTarget?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, { injector: this.injector });
  }

  private changeLayout(layout: StoreLayoutItem[]): void {
    const view = this.view();
    if (!view) return;
    this.change(withLayout(this.content(), view.template, layout), null);
    this.push();
  }

  private edit(section: string, field: string, value: string, push: boolean): void {
    if (!this.field(section, field)) return;
    this.change(withField(this.content(), section, field, value), fieldKey(section, field));
    if (push) this.push();
  }

  private change(next: StoreTemplateContent, key: string | null): void {
    this.history.record(this.content(), key);
    this.content.set(next);
    this.syncHistory();
    this.scheduleSave();
  }

  private apply(content: StoreTemplateContent): void {
    this.content.set(content);
    this.syncHistory();
    this.push();
    this.scheduleSave();
  }

  private syncHistory(): void {
    this.canUndo.set(this.history.canUndo);
    this.canRedo.set(this.history.canRedo);
  }

  private scheduleSave(): void {
    this.dirty = true;
    this.saveState.set('pending');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  /** Saves the latest content; edits made while saving trigger one more save. */
  private async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    while (this.saving) await this.saving;
    if (!this.dirty) return;
    this.dirty = false;
    this.saveState.set('saving');
    this.saving = this.api
      .saveDraft(this.content(), this.savedAt)
      .then((state) => {
        this.applyState(state);
        this.saveState.set(this.dirty ? 'pending' : 'saved');
      })
      .catch((error: unknown) => {
        this.dirty = true;
        this.saveState.set('error');
        this.notice.set({ tone: 'danger', text: this.messageFrom(error, 'No pudimos guardar. Revisa tu conexión y vuelve a intentarlo.') });
      })
      .finally(() => {
        this.saving = null;
      });
    await this.saving;
    if (this.dirty && this.saveState() === 'pending') await this.flush();
  }

  /** Success toasts close by themselves; errors stay until dismissed. */
  private success(text: string): void {
    const notice = { tone: 'success' as const, text };
    this.notice.set(notice);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      if (this.notice() === notice) this.notice.set(null);
    }, NOTICE_MS);
  }

  private startFrame(url: string): void {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) {
      this.frameSrc.set(null);
      this.frameReady.set(false);
      this.frameFailed.set(true);
      return;
    }
    this.frameReady.set(false);
    this.frameFailed.set(false);
    this.frameSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(parsed.toString()));
    if (this.frameTimer) clearTimeout(this.frameTimer);
    this.frameTimer = setTimeout(() => {
      if (!this.frameReady()) this.frameFailed.set(true);
    }, FRAME_TIMEOUT_MS);
  }

  private push(): void {
    this.post({ source: 'agopify-editor', type: 'content', content: this.content() });
  }

  private post(message: StoreEditorHostMessage): void {
    const target = this.frame()?.nativeElement.contentWindow;
    const view = this.view();
    if (!target || !view || !this.frameReady()) return;
    target.postMessage(message, new URL(view.frameUrl).origin);
  }

  private messageFrom(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && [400, 403, 409, 429, 503].includes(error.status)) {
      const message = error.error?.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    }
    return fallback;
  }
}
