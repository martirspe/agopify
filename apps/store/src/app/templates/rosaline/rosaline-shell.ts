import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Renderer2,
  inject,
  signal,
  effect,
  viewChild,
} from "@angular/core";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { STORE_EDITOR } from "../../core/store-editor";
import { StoreThemeTokens } from "../../core/theme-tokens.directive";
import { StoreShellLayout } from "../../layout/store-shell.layout";
import { ThemeSocialLinksComponent } from "../../components/theme-social-links.component";
import { RosalineSourceMotion } from "./source-motion";
import { RosalineSearch } from "./search";
import type { PublicCatalogCard } from "@vendedoria/contracts";
import { StoreApiService } from "../../core/store-api.service";
import { TemplateDemo } from "../../core/template-demo";
import { RosalineCartOverlay } from "./cart-overlay";
import { RosalineCartDrawer } from "./cart-drawer";
@Component({
  providers: [RosalineCartOverlay],
  selector: "rosaline-shell",
  imports: [
    RosalineSearch,
    RosalineCartDrawer,
    RosalineSourceMotion,
    RouterLink,
    RouterOutlet,
    STORE_EDITOR,
    StoreThemeTokens,
    ThemeSocialLinksComponent,
  ],
  templateUrl: "./rosaline-shell.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosalineShell extends StoreShellLayout {
  readonly cartOverlay = inject(RosalineCartOverlay);
  readonly cartDrawer = viewChild<ElementRef<HTMLDialogElement>>("cartDrawer");
  openCart(event: Event) {
    event.preventDefault();
    this.closeMenu();
    this.cartOverlay.opened.set(true);
  }
  readonly showTop = signal(false);
  readonly progress = signal(0);
  readonly headerSticky = signal(false);
  readonly headerTop = signal<string>("unset");
  private readonly sourceDocument = inject(DOCUMENT);
  goTop(): void {
    this.sourceDocument.defaultView?.scrollTo({ top: 0, behavior: "instant" });
  }
  readonly menuOpen = signal(false);
  readonly searchOpen = signal(false);
  readonly demo = inject(TemplateDemo);
  footerText(key: string, fallback = ""): string {
    return this.store()?.templateContent.sections["footer"]?.[key] ?? fallback;
  }
  readonly mobileMenu = viewChild<ElementRef<HTMLDialogElement>>("mobileMenu");
  readonly searchDialog =
    viewChild<ElementRef<HTMLDialogElement>>("searchDialog");
  readonly searchProducts = signal<PublicCatalogCard[]>([]);
  private readonly sourceApi = inject(StoreApiService);
  openMenu() {
    this.menuOpen.set(true);
    this.mobileMenu()?.nativeElement.showModal();
  }
  async openSearch() {
    this.closeMenu();
    this.searchOpen.set(true);
    this.searchDialog()?.nativeElement.showModal();
    try {
      this.searchProducts.set(
        (await this.sourceApi.products({ sort: "featured", pageSize: 6 }))
          .items,
      );
    } catch {
      this.searchProducts.set([]);
    }
  }
  readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>("menuToggle");

  closeMenu(): void {
    this.mobileMenu()?.nativeElement.close();
    this.menuOpen.set(false);
    this.menuToggle()?.nativeElement.focus();
  }
  constructor() {
    super();
    effect(() => {
      const dialog = this.cartDrawer()?.nativeElement;
      if (!dialog || typeof dialog.showModal !== "function") return;
      if (this.cartOverlay.opened()) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) dialog.close();
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const view = this.sourceDocument.defaultView;
      if (!view) return;
      let last = 0;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const scroll = () => {
        const top = view.scrollY;
        this.showTop.set(top > 100);
        const height =
          this.sourceDocument.documentElement.scrollHeight - view.innerHeight;
        this.progress.set(height > 0 ? (top / height) * 360 : 0);
        if (timeout) return;
        timeout = setTimeout(() => {
          timeout = undefined;
          const current = view.scrollY;
          const height =
            this.sourceDocument.querySelector("header")?.getBoundingClientRect()
              .height ?? 0;
          if (current > height) {
            if (current > last + 5) this.headerTop.set("-" + height + "px");
            else if (current < last - 5) {
              this.headerTop.set("15px");
              this.headerSticky.set(true);
            }
          } else {
            this.headerTop.set("unset");
            this.headerSticky.set(false);
          }
          last = current;
        }, 250);
      };
      view.addEventListener("scroll", scroll, { passive: true });
      destroy.onDestroy(() => {
        view.removeEventListener("scroll", scroll);
        if (timeout) clearTimeout(timeout);
      });
    });
    const document = inject(DOCUMENT),
      renderer = inject(Renderer2);
    renderer.addClass(document.body, "tpl-rosaline");
    if (!document.head.querySelector('link[href="/rosaline.css"]')) {
      const link = renderer.createElement("link");
      renderer.setAttribute(link, "rel", "stylesheet");
      renderer.setAttribute(link, "href", "/rosaline.css");
      renderer.appendChild(document.head, link);
    }
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.cartOverlay.opened.set(false);
          this.mobileMenu()?.nativeElement.close();
          this.menuOpen.set(false);
          this.searchDialog()?.nativeElement.close();
        }
      });
    inject(DestroyRef).onDestroy(() =>
      renderer.removeClass(document.body, "tpl-rosaline"),
    );
  }
}
