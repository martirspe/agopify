import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { HomeBlockComponent, sharedBlockType } from '../../components/home-block.component';
import { MoneyPipe } from '../../core/money.pipe';
import { SeoService } from '../../core/seo.service';
import { STORE_EDITOR, StoreEditorBridge } from '../../core/store-editor';
import { HomeBlock, homeBlock, storeHomeSections } from '../../core/store-layout';
import { StoreStateService } from '../../core/store-state.service';
import { whatsappUrl } from '../../core/whatsapp';
import { Product, SelectaCatalog, bagLine, maxUnits, category, photos, scarcity, setSaving } from './selecta-catalog';
import { wholeMoney } from '../../core/store-faq';
import { selectaCopy } from './selecta-copy';
import { SelectaIcon } from './selecta-icon';
import { SelectaProductImage } from './selecta-photo';

/** Home sections of the template in default order (API `TEMPLATE_SECTIONS.selecta`). */
const BUILTINS = ['hero', 'collection', 'banner', 'faq'];

@Component({
  selector: 'selecta-home',
  imports: [RouterLink, MoneyPipe, SelectaIcon, SelectaProductImage, HomeBlockComponent, STORE_EDITOR],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectaHomePage {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  readonly buying = signal(false);

  async buyNow(product: Product): Promise<void> {
    if (!this.directBuy(product) || this.buying()) return;
    this.buying.set(true);
    try {
      await this.cart.add(bagLine(product), 1, maxUnits(product));
      await this.router.navigate(['/checkout']);
    } finally {
      this.buying.set(false);
    }
  }

  private readonly catalog = inject(SelectaCatalog);
  readonly store = inject(StoreStateService).store;
  readonly products = this.catalog.products;
  readonly failed = this.catalog.failed;
  readonly hasPickup = computed(() => Boolean(this.store()?.shipping.options.some((o) => o.mode === 'PICKUP')));
  readonly copy = computed(() => {
    const store = this.store();
    return store ? selectaCopy(store) : null;
  });
  readonly sections = computed(() => {
    const store = this.store();
    return store ? storeHomeSections(store, BUILTINS) : [];
  });
  readonly editing = inject(StoreEditorBridge).active;
  readonly sharedType = sharedBlockType;
  readonly online = computed(() => this.store()?.checkout.mode === 'online');
  readonly freeLabel = computed(() => {
    const store = this.store();
    const free = store?.shipping.freeShippingFromCents;
    return store && free ? wholeMoney(store, free) : '';
  });
  /** Merchant image, else the store cover, else the first product photo; '' means no image. */
  readonly heroImage = computed(() => {
    const own = this.copy()?.heroImage;
    if (own !== undefined) return own || null;
    return this.store()?.heroImageUrl ?? this.products().flatMap((p) => photos(p))[0]?.url ?? null;
  });
  readonly bannerImage = computed(() => {
    const own = this.copy()?.bannerImage;
    if (own !== undefined) return own || null;
    return (
      this.products().flatMap((p) => p.media.filter((m) => m.kind === 'related'))[0]?.url ??
      this.products().flatMap((p) => photos(p))[1]?.url ??
      null
    );
  });

  /** Home selection stays editorial (not the full shop); denser on large screens without claiming curation. */
  readonly featured = computed(() => this.products().slice(0, 6));
  readonly categoryLinks = computed(() => [...new Set(this.products().map(category))].slice(0, 6).map(value => ({ value, label: value.split(/\s*[>/]\s*/).at(-1) || value, image: photos(this.products().find(p => category(p) === value)!)[0]?.url })));
  private readonly savings = computed(
    () =>
      new Map(
        this.products()
          .filter((p) => p.format === 'set')
          .map((p) => [p.handle, setSaving(p, this.products())]),
      ),
  );

  readonly whatsapp = computed(() => {
    const store = this.store();
    return store?.whatsappPhone
      ? whatsappUrl(store.whatsappPhone, `Hola, tengo una pregunta antes de comprar en ${store.displayName}.`)
      : null;
  });

  readonly categoryOf = category;
  readonly scarcity = scarcity;

  block(id: string): HomeBlock {
    return homeBlock(this.store()?.templateContent ?? { version: 1, sections: {} }, id);
  }

  constructor() {
    const editor = inject(StoreEditorBridge);
    effect(() => editor.registerFaq(this.copy()?.faq ?? []));
    const store = this.store();
    inject(SeoService).set({
      title: store?.seoTitle || store?.displayName || 'Tienda',
      description: store?.seoDescription || this.copy()?.heroText,
      path: '/',
    });
  }

  saving(p: Product): number {
    return this.savings().get(p.handle) ?? 0;
  }

  /** Products with variants are chosen on their page first. */
  directBuy(p: Product): boolean {
    return this.online() && p.isAvailable && !p.hasVariants;
  }
}
