import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type DsBannerTone = 'info' | 'success' | 'warning' | 'critical';

/** Page-level notice with tonal edge; actions stay projected. */
@Component({
  selector: 'ds-banner',
  standalone: true,
  template: `
    <div class="ds-banner" role="status" [attr.data-tone]="tone()">
      <div class="ds-banner__body">
        @if (title()) {
          <strong class="ds-banner__title">{{ title() }}</strong>
        }
        <div class="ds-banner__content"><ng-content /></div>
      </div>
      <div class="ds-banner__action"><ng-content select="[dsBannerAction]" /></div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .ds-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--ds-space-3);
      padding: var(--ds-space-3) var(--ds-space-4);
      border: var(--ds-border-width) solid var(--ds-color-border);
      border-radius: var(--ds-radius-sm);
      border-left-width: 0.25rem;
      background: var(--ds-color-surface);
      color: var(--ds-color-text-primary);
    }
    .ds-banner[data-tone='info'] {
      border-left-color: var(--ds-color-info);
      background: color-mix(in srgb, var(--ds-color-info) 8%, var(--ds-color-surface));
    }
    .ds-banner[data-tone='success'] {
      border-left-color: var(--ds-color-success-text);
      background: color-mix(in srgb, var(--ds-color-success-text) 8%, var(--ds-color-surface));
    }
    .ds-banner[data-tone='warning'] {
      border-left-color: var(--ds-color-warning);
      background: color-mix(in srgb, var(--ds-color-warning) 12%, var(--ds-color-surface));
    }
    .ds-banner[data-tone='critical'] {
      border-left-color: var(--ds-color-danger);
      background: color-mix(in srgb, var(--ds-color-danger) 8%, var(--ds-color-surface));
    }
    .ds-banner__body {
      min-width: 0;
      flex: 1 1 14rem;
      display: grid;
      gap: var(--ds-space-1);
    }
    .ds-banner__title {
      font-size: var(--ds-type-sm);
      font-weight: 650;
    }
    .ds-banner__content {
      font-size: var(--ds-type-sm);
      color: var(--ds-color-text-primary);
    }
    .ds-banner__action {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ds-space-2);
      align-items: center;
    }
    .ds-banner__action:empty {
      display: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DsBannerComponent {
  readonly tone = input<DsBannerTone>('info');
  readonly title = input<string | null>(null);
}
