import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PendingTasks,
  signal,
} from "@angular/core";
import type { StoreCatalogProduct } from "@vendedoria/contracts";
import { ProductCardComponent } from "../../components/product-card.component";
import { MoneyPipe } from "../../core/money.pipe";
import { StoreApiService } from "../../core/store-api.service";
import { TemplateDemo } from "../../core/template-demo";
import { RosalineCartOverlay } from "./cart-overlay";
@Component({
  selector: "rosaline-spotlight",
  imports: [MoneyPipe],
  templateUrl: "./original-spotlight.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineSpotlight extends ProductCardComponent {
  readonly cartOverlay = inject(RosalineCartOverlay);
  readonly demo = inject(TemplateDemo);
  readonly catalog = signal<StoreCatalogProduct | null>(null);
  private readonly catalogApi = inject(StoreApiService);
  private readonly pending = inject(PendingTasks);
  readonly quantity = signal(1);
  readonly activeImage = signal(0);
  readonly detailOpen = signal(1);
  readonly images = computed(() =>
    [
      ...new Set([
        this.imageUrl(),
        ...(this.catalog()
          ?.media.filter((item) => item.kind === "image")
          .map((item) => item.url) ?? []),
        this.purchase()?.secondaryImageUrl,
      ]),
    ].filter((url): url is string => !!url),
  );
  constructor() {
    super();
    effect((cleanup) => {
      const handle = this.product().handle;
      let active = true;
      cleanup(() => (active = false));
      this.pending.run(async () => {
        try {
          const item = await this.catalogApi.catalogProduct(handle);
          if (active) this.catalog.set(item);
        } catch {
          if (active) this.catalog.set(null);
        }
      });
    });
    effect(() => {
      const first = this.options().find((option) => option.isAvailable);
      this.selectVariant(first?.id ?? "");
    });
  }
  stepImage(delta: number) {
    const count = this.images().length;
    if (count) this.activeImage.update((n) => (n + delta + count) % count);
  }
  adjustQuantity(delta: number) {
    this.quantity.update((n) => Math.min(99, Math.max(1, n + delta)));
  }
  addQuantity(event: Event) {
    event.preventDefault();
    if (this.canAdd())
      for (let n = 0; n < this.quantity(); n++) super.addToCart();
    if (this.canAdd()) this.cartOverlay.opened.set(true);
  }
}
