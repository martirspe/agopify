import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { DsButtonComponent } from '../button/ds-button.component';
import { DsActionBarComponent } from '../action-bar/ds-action-bar.component';

@Component({
  selector: 'ds-save-bar',
  imports: [DsButtonComponent, DsActionBarComponent],
  templateUrl: './ds-save-bar.component.html',
  styleUrl: './ds-save-bar.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.ds-save-bar--top]': 'placement() === "top"',
    '[class.ds-save-bar--bottom]': 'placement() === "bottom"',
    '[class.ds-save-bar--capsule]': 'layout() === "capsule"',
    '[class.ds-save-bar--dock]': 'layout() === "dock"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsSaveBarComponent {
  readonly pending = input(false);
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly label = input('Guardar cambios');
  readonly pendingText = input('Cambios sin guardar');
  readonly formId = input<string | null>(null);
  /** Top: contextual sticky (editors). Bottom: sticky footer for long forms. */
  readonly placement = input<'top' | 'bottom'>('top');
  /**
   * dock = full-width ink strip (legacy/settings footers).
   * capsule = centered floating pill for dirty editors (Admin contextual save; console default).
   */
  readonly layout = input<'dock' | 'capsule'>('capsule');
}
