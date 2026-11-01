import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';

/**
 * Marks a sticky chrome strip as scrolled so borders/shadows appear only after
 * the page leaves the top (Admin page-header parity).
 */
@Directive({
  selector: '[dsStickyEdge]',
  standalone: true,
  host: {
    class: 'ds-sticky-edge',
    '[class.ds-sticky-edge--scrolled]': 'scrolled()',
    '[attr.data-scrolled]': 'scrolled() ? "" : null',
  },
})
export class DsStickyEdgeDirective {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  readonly scrolled = signal(false);

  constructor() {
    afterNextRender(() => this.attach());
  }

  private attach(): void {
    const el = this.host.nativeElement;
    const parent = el.parentElement;
    if (!parent || typeof IntersectionObserver === 'undefined') return;

    const sentinel = document.createElement('div');
    sentinel.className = 'ds-sticky-edge-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    parent.insertBefore(sentinel, el);

    const root = this.scrollRoot(el);
    const observer = new IntersectionObserver(
      ([entry]) => {
        this.scrolled.set(!(entry?.isIntersecting ?? true));
      },
      { root, threshold: 0 },
    );
    observer.observe(sentinel);

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      sentinel.remove();
    });
  }

  private scrollRoot(el: HTMLElement): Element | null {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const { overflowY } = getComputedStyle(node);
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }
}
