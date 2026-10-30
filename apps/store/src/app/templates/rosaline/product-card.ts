import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { ProductCardComponent } from "../../components/product-card.component";
import { MoneyPipe } from "../../core/money.pipe";
import { TemplateDemo } from "../../core/template-demo";
import { RosalineQuickview } from "./quickview";
import { RosalineCartOverlay } from "./cart-overlay";
@Component({
  selector: "rosaline-product-card",
  imports: [RouterLink, MoneyPipe, RosalineQuickview],
  templateUrl: "./original-card.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineProductCard extends ProductCardComponent {
  readonly quickOpen = signal(false);
  private readonly sourceInjector = inject(Injector);
  readonly cartOverlay = inject(RosalineCartOverlay);
  readonly demo = inject(TemplateDemo);
  readonly quickView = viewChild<ElementRef<HTMLDialogElement>>("quickView");
  openQuickView(event: Event) {
    event.preventDefault();
    this.quickOpen.set(true);
    afterNextRender(() => this.quickView()?.nativeElement.showModal(), {
      injector: this.sourceInjector,
    });
  }
  quickAdd(event: Event) {
    event.preventDefault();
    if (this.product().hasVariants) this.openQuickView(event);
    else if (this.canAdd()) {
      super.addToCart();
      this.cartOverlay.opened.set(true);
    }
  }
  onBackdrop(event: Event) {
    if (event.target === this.quickView()?.nativeElement)
      this.quickView()?.nativeElement.close();
  }
}
