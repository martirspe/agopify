import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DsIconComponent, type DsIconName } from '../icon/ds-icon.component';

/** Console page chrome: optional leading icon, title, description, projected actions. */
@Component({
  selector: 'ds-page-header',
  standalone: true,
  imports: [DsIconComponent],
  template: `
    <header class="ds-page-header">
      <div class="ds-page-header__copy">
        <div class="ds-page-header__heading">
          @if (icon(); as iconName) {
            <span class="ds-page-header__icon" aria-hidden="true">
              <ds-icon [name]="iconName" [size]="1.25" />
            </span>
          }
          <h1 class="ds-page-header__title">{{ title() }}</h1>
        </div>
        @if (description()) {
          <p class="ds-page-header__description">{{ description() }}</p>
        }
      </div>
      <div class="ds-page-header__actions">
        <ng-content select="[dsPageActions]" />
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      margin-bottom: var(--ds-space-4);
    }
    .ds-page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--ds-space-3);
      min-width: 0;
    }
    .ds-page-header__copy {
      min-width: 0;
      flex: 1 1 12rem;
    }
    .ds-page-header__heading {
      display: flex;
      align-items: center;
      gap: 0.5rem; /* 8px */
      min-width: 0;
      min-height: 1.75rem; /* 28px title row */
    }
    .ds-page-header__icon {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
      color: var(--ds-color-text-primary);
    }
    .ds-page-header__icon ds-icon,
    .ds-page-header__icon .ds-icon,
    .ds-page-header__icon svg {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
    }
    .ds-page-header__title {
      margin: 0;
      font-family: var(--ds-font-ui);
      font-size: var(--ds-type-page);
      font-weight: var(--ds-console-type-page-weight, 650);
      line-height: 1.75rem; /* 28px */
      letter-spacing: -0.005em;
      color: var(--ds-color-text-primary);
      overflow-wrap: anywhere;
    }
    .ds-page-header__description {
      margin: var(--ds-space-1) 0 0;
      color: var(--ds-color-text-secondary);
      font-size: var(--ds-type-sm);
      overflow-wrap: anywhere;
    }
    .ds-page-header__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--ds-space-2);
      min-width: 0;
    }
    .ds-page-header__actions:empty {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsPageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  /** Optional leading glyph (20×20). */
  readonly icon = input<DsIconName | null>(null);
}
