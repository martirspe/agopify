import {
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  input,
} from '@angular/core';

/**
 * -style condensed-rail tooltip (dark chip + optional KeyboardKey badges).
 * Positions to the right of the host; delays like console (~100ms).
 */
@Directive({
  selector: '[consoleRailTooltip]',
  standalone: true,
})
export class ConsoleRailTooltipDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Visible label. */
  readonly consoleRailTooltip = input.required<string>();
  /** Comma-separated shortcut keys, e.g. `CTRL,B`. */
  readonly consoleRailTooltipKeys = input<string>('');
  /** When false, native behavior stays quiet (expanded labels visible). */
  readonly consoleRailTooltipWhen = input(true);

  private tip: HTMLElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly delayMs = 100;

  @HostListener('pointerenter')
  onEnter(): void {
    if (!this.consoleRailTooltipWhen()) return;
    this.clearTimer();
    this.showTimer = setTimeout(() => this.show(), this.delayMs);
  }

  @HostListener('pointerleave')
  @HostListener('pointerdown')
  onLeave(): void {
    this.clearTimer();
    this.hide();
  }

  @HostListener('focus')
  onFocus(): void {
    if (!this.consoleRailTooltipWhen()) return;
    this.show();
  }

  @HostListener('blur')
  onBlur(): void {
    this.hide();
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.hide();
  }

  private clearTimer(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private show(): void {
    const label = this.consoleRailTooltip().trim();
    if (!label) return;
 // One tip at a time ( popover behavior).
    document.querySelectorAll('[data-console-rail-tooltip]').forEach((node) => node.remove());
    this.tip = null;

    const tip = document.createElement('div');
    tip.className = 'console-rail-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('data-console-rail-tooltip', '');

    const text = document.createElement('span');
    text.className = 'console-rail-tooltip__label';
    text.textContent = label;
    tip.appendChild(text);

    const keys = this.consoleRailTooltipKeys()
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length) {
      const row = document.createElement('span');
      row.className = 'console-rail-tooltip__keys';
      for (const key of keys) {
        const kbd = document.createElement('kbd');
        kbd.className = 'console-rail-tooltip__key';
        kbd.textContent = key;
        row.appendChild(kbd);
      }
      tip.appendChild(row);
    }

    document.body.appendChild(tip);
    this.tip = tip;
    this.position(tip);
  }

  private position(tip: HTMLElement): void {
    const rect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    /*
 anchors past the full rail column (60px), not the 32px control:
 tip x≈65 → gap ≈5px after rail.right. Positioning from control.right
 (e.g. 46+8=54) overlaps the rail and “chocan”.
 */
    const rail = this.host.nativeElement.closest('#console-navigation');
    const railRight = rail?.getBoundingClientRect().right ?? rect.right;
 const gap = 5; /* : tip at 65 after rail 60 */
    let left = Math.max(rect.right, railRight) + gap;
    let top = rect.top + (rect.height - tipRect.height) / 2;

    const maxLeft = window.innerWidth - tipRect.width - 8;
    if (left > maxLeft) {
      left = Math.max(8, Math.min(rect.left, rail?.getBoundingClientRect().left ?? rect.left) - tipRect.width - gap);
    }
    top = Math.min(Math.max(8, top), window.innerHeight - tipRect.height - 8);

    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  private hide(): void {
    this.tip?.remove();
    this.tip = null;
  }
}
