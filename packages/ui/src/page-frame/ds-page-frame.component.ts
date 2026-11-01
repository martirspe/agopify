import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Console main frame — same geometry as Productos publish shell / Admin s-page:
 * absolute overlay for the dark save capsule; sibling scroll owns sticky header + body.
 *
 * Project save chrome with `[dsPageFrameSave]`; everything else (header + content)
 * goes into the default slot inside the scrollport.
 */
@Component({
  selector: 'ds-page-frame',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="ds-page-frame">
      <div class="ds-page-frame__overlay" aria-live="polite">
        <ng-content select="[dsPageFrameSave]" />
      </div>
      <div class="ds-page-frame__scroll">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    ds-page-frame,
    .ds-page-frame-host {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }

    .ds-page-frame {
      position: relative;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .ds-page-frame__overlay {
      position: absolute;
      inset: 0;
      z-index: calc(var(--ds-z-sticky) + 5);
      pointer-events: none;
    }

    .ds-page-frame__overlay > * {
      pointer-events: auto;
    }

    /* Admin contextual save: absolute, top 8px, centered max-content. */
    .ds-page-frame__save,
    .ds-page-frame__save.ds-save-bar--capsule,
    .ds-page-frame__save.ds-action-bar--capsule,
    .ds-page-frame__overlay > ds-save-bar.ds-save-bar--capsule,
    .ds-page-frame__overlay > ds-action-bar.ds-action-bar--capsule {
      position: absolute;
      inset-block-start: var(--ds-space-2);
      inset-inline: 0;
      top: var(--ds-space-2);
      display: block;
      width: max-content;
      max-width: calc(100% - 2 * var(--ds-space-4));
      margin-inline: auto;
      margin-block-start: 0;
      margin-block-end: 0;
      pointer-events: auto;
      white-space: nowrap;
      animation: ds-page-frame-save-in var(--ds-motion-fast, 120ms) var(--ds-ease-out, ease);
    }

    @keyframes ds-page-frame-save-in {
      from {
        opacity: 0;
        transform: translateY(-0.25rem);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ds-page-frame__save,
      .ds-page-frame__overlay > ds-save-bar.ds-save-bar--capsule {
        animation: none;
      }
    }

    .ds-page-frame__scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-block-end: var(--ds-space-10);
    }

    /* Sticky page header flush to the top of the frame (Productos parity). */
    ds-page-frame .ds-page-frame__scroll > ds-page-header {
      margin: 0;
    }

    .ds-page-frame__body {
      padding-inline: var(--ds-space-4);
      padding-block-start: var(--ds-space-3);
      padding-block-end: 0;
    }
  `,
  host: { class: 'ds-page-frame-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsPageFrameComponent {}
