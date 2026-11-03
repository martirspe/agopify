import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DsIconComponent, type DsIconName } from '../icon/ds-icon.component';
import { DsStickyEdgeDirective } from '../sticky-edge/ds-sticky-edge.directive';

/**
 * Console main page chrome — measured against Admin `s-internal-page` `.page-header`:
 * sticky 52px strip, toolbar 28px content row.
 *
 * Index: optional icon + title + actions.
 * Nested/detail: circular 28px back, icon + parent crumb, `/`, current title (h1).
 * Dirty save chrome stays in `ds-page-frame` + `ds-save-bar` capsule (not this strip).
 */
@Component({
  selector: 'ds-page-header',
  standalone: true,
  imports: [DsIconComponent, DsStickyEdgeDirective, RouterLink],
  encapsulation: ViewEncapsulation.None,
  template: `
    <header class="ds-page-header" dsStickyEdge>
      <div class="ds-page-header__toolbar">
        <div
          class="ds-page-header__heading"
          [class.ds-page-header__heading--crumbs]="!!parentTitle()"
        >
          @if (showBackControl()) {
            @if (backHref(); as href) {
              <a
                class="ds-page-header__back"
                [routerLink]="href"
                [attr.aria-label]="resolvedBackLabel()"
                [attr.aria-disabled]="backDisabled() ? 'true' : null"
                [class.is-disabled]="backDisabled()"
                (click)="onBackLinkClick($event)"
              >
                <span class="ds-page-header__back-fill" aria-hidden="true"></span>
                <span class="ds-page-header__back-ring" aria-hidden="true"></span>
                <span class="ds-page-header__back-content" aria-hidden="true">
                  <ds-icon name="chevronLeft" [size]="1.25" />
                </span>
              </a>
            } @else {
              <button
                type="button"
                class="ds-page-header__back"
                [attr.aria-label]="resolvedBackLabel()"
                [disabled]="backDisabled()"
                (click)="back.emit()"
              >
                <span class="ds-page-header__back-fill" aria-hidden="true"></span>
                <span class="ds-page-header__back-ring" aria-hidden="true"></span>
                <span class="ds-page-header__back-content" aria-hidden="true">
                  <ds-icon name="chevronLeft" [size]="1.25" />
                </span>
              </button>
            }
          }

          @if (parentTitle(); as parent) {
            <!-- Admin trail: icon+parent / title — single flex row after the 12px gap from back -->
            <div class="ds-page-header__trail">
              <nav class="ds-page-header__crumbs" [attr.aria-label]="crumbsLabel()">
                @if (parentHref(); as href) {
                  <a
                    class="ds-page-header__crumb"
                    [routerLink]="href"
                    [attr.aria-disabled]="backDisabled() ? 'true' : null"
                    [class.is-disabled]="backDisabled()"
                    (click)="onParentLinkClick($event)"
                  >
                    @if (icon(); as iconName) {
                      <span class="ds-page-header__crumb-icon" aria-hidden="true">
                        <ds-icon [name]="iconName" [size]="1.25" />
                      </span>
                    }
                    <span class="ds-page-header__crumb-label">{{ parent }}</span>
                  </a>
                } @else {
                  <button
                    type="button"
                    class="ds-page-header__crumb"
                    [disabled]="backDisabled()"
                    (click)="back.emit()"
                  >
                    @if (icon(); as iconName) {
                      <span class="ds-page-header__crumb-icon" aria-hidden="true">
                        <ds-icon [name]="iconName" [size]="1.25" />
                      </span>
                    }
                    <span class="ds-page-header__crumb-label">{{ parent }}</span>
                  </button>
                }
              </nav>
              <span class="ds-page-header__crumb-divider" aria-hidden="true">/</span>
              <h1 class="ds-page-header__title">{{ title() }}</h1>
            </div>
          } @else {
            @if (icon(); as iconName) {
              <span class="ds-page-header__icon" aria-hidden="true">
                <ds-icon [name]="iconName" [size]="1.25" />
              </span>
            }
            <h1 class="ds-page-header__title">{{ title() }}</h1>
          }
        </div>
        <div class="ds-page-header__actions">
          <ng-content select="[dsPageActions]" />
        </div>
      </div>
    </header>
  `,
  styles: `
    ds-page-header {
      display: block;
      min-width: 0;
      /* Full-bleed against console-workspace-scroll padding (1rem). */
      margin: calc(-1 * var(--ds-space-4)) calc(-1 * var(--ds-space-4)) var(--ds-space-3);
      padding: 0;
    }

    /*
     * Admin .page-header (admin-next, measured): sticky 52px, transparent host,
     * ::before workspace fill + ::after 1px hairline only when scrolled
     * (dsStickyEdge ↔ Shopify scroll() timeline on ::after).
     */
    .ds-page-header {
      /* Defeat console touch-target 2rem so header controls stay Admin 28px. */
      --ds-touch-target: 1.75rem;
      --ds-console-control-height: 1.75rem;
      position: sticky;
      top: 0;
      z-index: calc(var(--ds-z-sticky) + 2);
      display: flex;
      align-items: center;
      width: 100%;
      height: 3.25rem; /* 52px */
      min-height: 3.25rem;
      max-height: 3.25rem;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      background: transparent;
      overflow: visible;
      border-block-end: 0;
    }

    .ds-page-header::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 0;
      background: var(--ds-console-workspace-bg, #fff);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--ds-motion-fast, 120ms) var(--ds-ease-out, ease);
    }

    .ds-page-header::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      top: 3.1875rem; /* 51px — hairline under 52px strip */
      height: 1px;
      z-index: 1;
      background: rgb(0 0 0 / 7%);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--ds-motion-fast, 120ms) var(--ds-ease-out, ease);
    }

    .ds-page-header.ds-sticky-edge--scrolled::before,
    .ds-page-header.ds-sticky-edge--scrolled::after {
      opacity: 1;
    }

    /* Prefer ::after hairline; keep class border transparent. */
    .ds-page-header.ds-sticky-edge,
    .ds-page-header.ds-sticky-edge--scrolled {
      border-block-end-color: transparent;
    }

    /* Admin .toolbar: height 28px, padding 0 4px 0 16px */
    .ds-page-header__toolbar {
      position: relative;
      z-index: 2;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem; /* 8px — Admin header-content gap */
      width: 100%;
      min-width: 0;
      height: 1.75rem; /* 28px */
      min-height: 1.75rem;
      padding: 0 0.25rem 0 var(--ds-space-4); /* 0 4px 0 16px */
      color: var(--ds-color-text-secondary);
    }

    .ds-page-header__heading {
      display: flex;
      align-items: center;
      gap: 0.5rem; /* index: icon → title */
      min-width: 0;
      flex: 1 1 0%;
      height: 1.75rem;
    }

    /* Nested: only gap is back → trail (12px). Trail owns crumb / title spacing. */
    .ds-page-header__heading--crumbs {
      gap: 0.75rem; /* 12px — measured Admin back→breadcrumb-icon-content */
    }

    /*
     * Admin trail: [icon+parent] [ / ] [h1], gap 4px between items
     * (breadcrumb-links → heading). Divider itself is pad 0 4px, lh 20.
     */
    .ds-page-header__trail {
      display: inline-flex;
      flex: 1 1 auto;
      align-items: center;
      gap: 0.25rem; /* 4px */
      min-width: 0;
      height: 1.75rem;
    }

    /*
     * Admin circular back: secondary icon-only 28×28, pad 4, icon 20,
     * white fill + soft ring shadow. !important beats console touch min-height.
     */
    .ds-page-header__back {
      position: relative;
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 1.75rem !important; /* 28px */
      height: 1.75rem !important;
      min-width: 1.75rem !important;
      min-height: 1.75rem !important;
      max-width: 1.75rem !important;
      max-height: 1.75rem !important;
      padding: 0.25rem; /* 4px */
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--ds-console-text, var(--ds-color-text-primary));
      font-size: 0.75rem; /* Admin icon-only 12px */
      font-weight: 500;
      line-height: 1rem;
      text-decoration: none;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
    }

    .ds-page-header__back-fill,
    .ds-page-header__back-ring {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
    }

    .ds-page-header__back-fill {
      background: #fff;
    }

    .ds-page-header__back-ring {
      box-shadow:
        rgb(0 0 0 / 7%) 0 0 0 1px,
        rgb(0 0 0 / 3%) 0 2px 20px 0,
        rgb(0 0 0 / 3%) 0 5px 20px 0,
        rgb(0 0 0 / 3%) 0 8px 60px 0;
    }

    .ds-page-header__back-content {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
    }

    .ds-page-header__back-content ds-icon,
    .ds-page-header__back-content .ds-icon,
    .ds-page-header__back-content svg {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
    }

    .ds-page-header__back:hover:not(:disabled):not(.is-disabled) .ds-page-header__back-fill {
      background: #f7f7f7;
    }

    .ds-page-header__back:focus-visible {
      outline: 2px solid var(--ds-color-focus-ring, var(--ds-color-brand, #111));
      outline-offset: 2px;
    }

    .ds-page-header__back:disabled,
    .ds-page-header__back.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .ds-page-header__crumbs {
      display: inline-flex;
      flex: 0 1 auto;
      align-items: center;
      min-width: 0;
      height: 1.25rem; /* 20px — Admin breadcrumb-icon-content */
    }

    .ds-page-header__crumb {
      /* Any touch-target min-height on buttons resolves to crumb 20px, not 28. */
      --ds-touch-target: 1.25rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem; /* 4px icon → label — measured Admin */
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      height: 1.25rem !important; /* 20px */
      min-height: 1.25rem !important;
      max-height: 1.25rem !important;
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      color: rgb(74 74 74);
      font-family: var(--ds-font-console, var(--ds-font-ui));
      font-size: 0.8125rem; /* 13px */
      font-weight: 500;
      line-height: 1.25rem; /* 20px */
      letter-spacing: -0.01em;
      text-decoration: none;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
    }

    .ds-page-header__crumb:hover:not(:disabled):not(.is-disabled) {
      color: var(--ds-console-text, var(--ds-color-text-primary));
    }

    .ds-page-header__crumb:disabled,
    .ds-page-header__crumb.is-disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    .ds-page-header__crumb-icon {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
      color: inherit;
    }

    .ds-page-header__crumb-icon ds-icon,
    .ds-page-header__crumb-icon .ds-icon,
    .ds-page-header__crumb-icon svg {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
    }

    .ds-page-header__crumb-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ds-page-header__crumb-divider {
      flex-shrink: 0;
      box-sizing: border-box;
      height: 1.25rem; /* 20px */
      padding: 0 0.25rem; /* 0 4px — measured Admin breadcrumb-divider */
      color: rgb(74 74 74);
      font-family: var(--ds-font-console, var(--ds-font-ui));
      font-size: 0.8125rem; /* 13px */
      font-weight: 400;
      line-height: 1.25rem; /* 20px */
    }

    .ds-page-header__icon {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
      color: var(--ds-console-text, var(--ds-color-text-primary));
    }

    .ds-page-header__icon ds-icon,
    .ds-page-header__icon .ds-icon,
    .ds-page-header__icon svg {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
    }

    /* Admin h1.heading.has-breadcrumbs: 13px / 500 / line-height 28px */
    .ds-page-header__title {
      margin: 0;
      min-width: 0;
      overflow: hidden;
      font-family: var(--ds-font-console, var(--ds-font-ui));
      font-size: 0.8125rem; /* 13px */
      font-weight: 500;
      line-height: 1.75rem; /* 28px */
      letter-spacing: -0.01em;
      color: rgb(16 16 16);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Admin .actions: flex, gap 6px, right of heading (heading flex 1). */
    .ds-page-header__actions {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem; /* 6px */
      flex: 0 1 auto;
      min-width: 0;
      max-width: min(70%, 100%);
      height: 1.75rem;
      max-height: 1.75rem;
      margin-inline-end: 0.25rem; /* toolbar pad end 4px */
    }

    /* Projected [dsPageActions] must stay one row with the title (no wrap). */
    .ds-page-header__actions > * {
      display: inline-flex;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem;
      min-width: 0;
      max-width: 100%;
      height: 1.75rem;
    }

    .ds-page-header__actions:empty {
      display: none;
    }

    @media (max-width: 40rem) {
      .ds-page-header__actions {
        max-width: min(62%, 100%);
      }

      .ds-page-header__title {
        font-size: 0.8125rem;
      }
    }

    /*
     * Admin .icon-action-group — light floating pill for icon-only chrome actions
     * (detail editors). Not the dark save capsule.
     */
    .ds-page-header__action-group {
      display: inline-flex;
      align-items: center;
      height: 1.75rem;
      padding: 0;
      border: 0;
      border-radius: var(--ds-radius-pill);
      background: #fff;
      box-shadow:
        rgb(0 0 0 / 7%) 0 0 0 1px,
        rgb(0 0 0 / 3%) 0 2px 20px 0,
        rgb(0 0 0 / 3%) 0 5px 20px 0,
        rgb(0 0 0 / 3%) 0 8px 60px 0;
    }

    .ds-page-header__action-group .ds-button,
    .ds-page-header__action-group .ds-button-host .ds-button,
    .ds-page-header__action-group button {
      width: 1.75rem;
      min-width: 1.75rem;
      height: 1.75rem;
      min-height: 1.75rem;
      padding: 0.25rem;
      border: 0;
      border-radius: var(--ds-radius-pill);
      background: transparent;
      box-shadow: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsPageHeaderComponent {
  readonly title = input.required<string>();
  /**
   * Accepted for API compatibility with older callers; not rendered in the sticky
   * strip (Productos / Admin index chrome). Put helper copy in the page body.
   */
  readonly description = input<string | null>(null);
  /** Optional leading glyph (20×20). With parentTitle, sits on the parent crumb. */
  readonly icon = input<DsIconName | null>(null);
  /**
   * Parent section label shown before `/` (e.g. Productos). When set, renders the
   * nested chrome: circular back + crumb + current title.
   */
  readonly parentTitle = input<string | null>(null);
  /** Router link for the parent crumb. Falls back to a back-emitting control. */
  readonly parentHref = input<string | null>(null);
  /** Router link for the circular back control. Without it, emits `back`. */
  readonly backHref = input<string | null>(null);
  /** Accessible name for the back control (defaults to parentTitle or «Volver»). */
  readonly backLabel = input<string | null>(null);
  /** Force the circular back without a parent crumb (rare). */
  readonly showBack = input(false);
  readonly backDisabled = input(false);
  /** Accessible name for the crumbs nav. */
  readonly crumbsLabel = input('Ubicación');
  /** Emitted when back/parent controls are activated without an href navigation. */
  readonly back = output<void>();

  protected showBackControl(): boolean {
    return this.showBack() || !!this.backHref() || !!this.parentTitle();
  }

  protected resolvedBackLabel(): string {
    return this.backLabel() || this.parentTitle() || 'Volver';
  }

  protected onBackLinkClick(event: Event): void {
    if (this.backDisabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.back.emit();
  }

  protected onParentLinkClick(event: Event): void {
    if (this.backDisabled()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.back.emit();
  }
}
