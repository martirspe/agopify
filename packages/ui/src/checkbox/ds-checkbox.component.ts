import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/**
 * Projects a native checkbox styled as a console switch.
 * Preserves Angular forms, label click, disabled/fieldset and indeterminate.
 */
@Component({
  selector: 'ds-checkbox',
  templateUrl: './ds-checkbox.component.html',
  styleUrl: './ds-checkbox.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsCheckboxComponent {
  /** `panel` = setting row (switch trailing); `inline` = compact labeled switch. */
  readonly variant = input<'panel' | 'inline'>('panel');
  readonly description = input('');
}
