import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import type { PublicCatalogCard } from "@vendedoria/contracts";
import { STORE_EDITOR } from "../../core/store-editor";
import { MoneyPipe } from "../../core/money.pipe";
import { TemplateDemo } from "../../core/template-demo";
import { ProductCardComponent } from "../../components/product-card.component";
import { RosalineProductCard } from "./product-card";
@Directive()
export class RosalineOriginalSection {
  readonly id = input.required<string>();
  readonly fields = input.required<Record<string, string>>();
  readonly products = input<PublicCatalogCard[]>([]);
  readonly demo = inject(TemplateDemo);
  readonly selected = signal("");
  readonly step = signal(1);
  readonly reveal = signal(50);
  readonly categories = computed(() => [
    ...new Set(this.products().flatMap((p) => p.categories)),
  ]);
  readonly visibleProducts = computed(() =>
    this.products().filter(
      (p) =>
        this.demo.active ||
        !this.selected() ||
        p.categories.includes(this.selected()),
    ),
  );
  field(key: string, fallback = "") {
    return this.fields()[key] ?? fallback;
  }
  categoryCount(category: string) {
    return this.products().filter((p) => p.categories.includes(category))
      .length;
  }
  changeStep(delta: number) {
    this.step.update((value) => ((value - 1 + delta + 5) % 5) + 1);
  }
  updateReveal(event: Event) {
    this.reveal.set(Number((event.target as HTMLInputElement).value));
  }
  sampleVideo(index: number) {
    return (
      "/themes/rosaline/source/assets/images/video/" +
      ["video-prd.mp4", "watch-shop-1.mp4", "watch-shop-2.mp4"][index % 3]
    );
  }
}

@Component({
  selector: "rosaline-original-hero",
  imports: [STORE_EDITOR, RouterLink],
  templateUrl: "./original-hero.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineHero extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-facts",
  imports: [STORE_EDITOR],
  templateUrl: "./original-facts.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineFacts extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-selection",
  imports: [STORE_EDITOR, RouterLink, RosalineProductCard],
  templateUrl: "./original-selection.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineSelection extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-explore",
  imports: [STORE_EDITOR, RouterLink],
  templateUrl: "./original-explore.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineExplore extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-brands",
  imports: [STORE_EDITOR],
  templateUrl: "./original-brands.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineBrands extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-trusted",
  imports: [STORE_EDITOR],
  templateUrl: "./original-trusted.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineTrusted extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-ritual",
  imports: [STORE_EDITOR, RosalineProductCard],
  templateUrl: "./original-ritual.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineRitual extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-compare",
  imports: [STORE_EDITOR],
  templateUrl: "./original-compare.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineCompare extends RosalineOriginalSection {
  constructor() {
    super();
    this.reveal.set(99);
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        this.reveal.set(50);
        return;
      }
      let frame = 0;
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          const started = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - started) / 1000, 1);
            this.reveal.set(99 + (50 - 99) * (1 - Math.pow(1 - progress, 3)));
            if (progress < 1) frame = requestAnimationFrame(animate);
          };
          frame = requestAnimationFrame(animate);
        },
        { threshold: 0.5 },
      );
      observer.observe(element);
      destroy.onDestroy(() => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      });
    });
  }
}

@Component({
  selector: "rosaline-original-closing",
  imports: [STORE_EDITOR, RouterLink],
  templateUrl: "./original-closing.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineClosing extends RosalineOriginalSection {}

@Component({
  selector: "rosaline-original-shop",
  imports: [STORE_EDITOR, RouterLink, MoneyPipe],
  templateUrl: "./original-shop.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineShop extends RosalineOriginalSection {}
