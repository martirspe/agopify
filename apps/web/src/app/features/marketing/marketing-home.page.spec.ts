import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketingHomePage } from './marketing-home.page';

afterEach(() => {
  TestBed.resetTestingModule();
  vi.useRealTimers();
});
describe('Marketing commercial landing', () => {
  it('renders brand-first hero, platform pillars and product demo stage', async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHomePage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(MarketingHomePage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.hero__brand')?.textContent?.trim()).toBe('Agopify');
    expect(host.querySelector('#hero-title')?.textContent).toContain('Tu vendedor IA');
    expect(host.querySelector('.manifesto')).toBeTruthy();
    expect(host.querySelector('#demo')).toBeTruthy();
    expect(host.querySelector('#plataforma')).toBeTruthy();
    expect(host.querySelector('#tienda')).toBeTruthy();
    expect(host.querySelector('#casos')).toBeTruthy();
    expect(host.querySelector('#planes')).toBeTruthy();
    fixture.destroy();
  });
});

describe('Marketing mobile navigation', () => {
  it('lets native anchor activation complete before hiding the menu', async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHomePage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(MarketingHomePage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const menu = host.querySelector<HTMLDetailsElement>('.mobile-menu')!;
    const link = menu.querySelector<HTMLAnchorElement>('a[href="#planes"]')!;
    menu.open = true;
    vi.useFakeTimers();
    let openDuringActivation = false;
    let prevented = true;
    link.addEventListener('click', (event) => {
      openDuringActivation = menu.open;
      prevented = event.defaultPrevented;
    });
    link.click();
    expect(openDuringActivation).toBe(true);
    expect(prevented).toBe(false);
    vi.runAllTimers();
    expect(menu.open).toBe(false);
    fixture.destroy();
  });
  it('closes with Escape and returns focus to the summary', async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingHomePage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(MarketingHomePage);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    document.body.append(host);
    const menu = host.querySelector<HTMLDetailsElement>('.mobile-menu')!;
    const summary = menu.querySelector('summary')!;
    menu.open = true;
    menu.querySelector<HTMLAnchorElement>('a')!.focus();
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    fixture.destroy();
    host.remove();
  });
});
