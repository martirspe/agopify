import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { DsIconComponent, DsLinkComponent } from '@agopify/ui';
import { MarketingDemoComponent } from './marketing-demo.component';
import { MarketingFeaturesComponent } from './marketing-features.component';
import { MarketingPricingComponent } from './marketing-pricing.component';
import { installMarketingSeo } from './marketing-seo';

@Component({
  selector: 'app-marketing-home',
  imports: [
    DsIconComponent,
    DsLinkComponent,
    MarketingDemoComponent,
    MarketingFeaturesComponent,
    MarketingPricingComponent,
  ],
  templateUrl: './marketing-home.page.html',
  styleUrl: './marketing-home.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketingHomePage implements OnDestroy {
  private readonly removeSeo = installMarketingSeo();
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private menuCloseTimer: ReturnType<typeof setTimeout> | undefined;

  readonly scrolled = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    const sync = () => this.scrolled.set(window.scrollY > 12);
    sync();
    fromEvent(window, 'scroll', { passive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(sync);
  }

  closeMobileMenu(menu: HTMLDetailsElement): void {
    // Keep the link rendered until the browser completes its native anchor navigation.
    clearTimeout(this.menuCloseTimer);
    this.menuCloseTimer = setTimeout(() => {
      menu.open = false;
    }, 0);
  }

  ngOnDestroy(): void {
    clearTimeout(this.menuCloseTimer);
    this.removeSeo();
  }
}
