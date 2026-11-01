import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { DsIconComponent, type DsIconName } from '../icon/ds-icon.component';
import { DsStickyEdgeDirective } from '../sticky-edge/ds-sticky-edge.directive';

/**
 * Console main page chrome — measured against Admin `s-internal-page` `.page-header`:
 * sticky 52px strip, toolbar 28px content row, title 13px/500/28px, no description in the strip.
 */
@Component({
  selector: 'ds-page-header',
  standalone: true,
  imports: [DsIconComponent, DsStickyEdgeDirective],
  encapsulation: ViewEncapsulation.None,
  template: `
    <header class="ds-page-header" dsStickyEdge>
      <div class="ds-page-header__toolbar">
        <div class="ds-page-header__heading">
          @if (icon(); as iconName) {
            <span class="ds-page-header__icon" aria-hidden="true">
              <ds-icon [name]="iconName" [size]="1.25" />
            </span>
          }
          <h1 class="ds-page-header__title">{{ title() }}</h1>
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
     * Admin .page-header: sticky, height 52px, padding 0, flex + align center,
     * border only via dsStickyEdge when scrolled.
     */
    .ds-page-header {
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
      background: var(--ds-console-workspace-bg, var(--ds-color-canvas, var(--ds-color-surface)));
      overflow: hidden;
    }

    /* Admin .toolbar: height 28px, padding 0 4px 0 16px */
    .ds-page-header__toolbar {
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
      gap: 0.5rem; /* Admin icon→title gap small-200 */
      min-width: 0;
      flex: 1 1 0%; /* Admin .heading-and-accessory */
      height: 1.75rem;
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

    /* Admin h1.heading: 13px / 500 / line-height 28px */
    .ds-page-header__title {
      margin: 0;
      min-width: 0;
      overflow: hidden;
      font-family: var(--ds-font-console, var(--ds-font-ui));
      font-size: var(--ds-console-type-page, 0.8125rem);
      font-weight: var(--ds-console-type-page-weight, 500);
      line-height: 1.75rem; /* 28px */
      letter-spacing: -0.01em;
      color: var(--ds-console-text, var(--ds-color-text-primary));
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
      flex: 0 0 auto;
      min-width: 0;
      max-width: 70%;
      margin-inline-end: 0.25rem; /* toolbar pad end 4px */
    }

    .ds-page-header__actions:empty {
      display: none;
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
  /** Optional leading glyph (20×20). */
  readonly icon = input<DsIconName | null>(null);
}
