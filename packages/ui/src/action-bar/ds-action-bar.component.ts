import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

/** A shared sticky container; projected actions keep their native form semantics. */
@Component({
  selector: 'ds-action-bar',
  templateUrl: './ds-action-bar.component.html',
  styleUrl: './ds-action-bar.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.ds-action-bar--bottom]': 'placement() === "bottom"',
    '[class.ds-action-bar--capsule]': 'layout() === "capsule"',
    '[class.ds-action-bar--dock]': 'layout() === "dock"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsActionBarComponent {
  readonly placement = input<'top' | 'bottom'>('top');
  /**
   * dock = full-width ink strip (form/section CTAs).
   * capsule = dark centered save pill — prefer `ds-save-bar`; not for page chrome.
   * Page chrome actions belong in `ds-page-header` `[dsPageActions]` (Admin `.actions`).
   */
  readonly layout = input<'dock' | 'capsule'>('dock');
  readonly label = input('Acciones de esta vista');
}
