import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AccountApiService } from '../../core/api/account-api.service';
import { AgentsApiService } from '../../core/api/agents-api.service';
import { CatalogApiService } from '../../core/api/catalog-api.service';
import { IntegrationsApiService } from '../../core/api/integrations-api.service';
import { MessagingApiService } from '../../core/api/messaging-api.service';
import { OrdersApiService } from '../../core/api/orders-api.service';
import { PaymentsApiService } from '../../core/api/payments-api.service';
import { ShippingApiService } from '../../core/api/shipping-api.service';
import { StoreApiService } from '../../core/api/store-api.service';
import { GetStartedPage } from './get-started.page';

async function setup(healthStatus = 'CONNECTED', isActive = true, fail = false, missingSeller = false) {
  const catalog = { list: vi.fn(async () => {
    if (fail) throw new Error('unavailable');
    return [{ isAvailable: true }];
  }) };
  TestBed.configureTestingModule({ imports: [GetStartedPage], providers: [
    provideRouter([]),
    { provide: AccountApiService, useValue: { profile: () => ({ business: { name: 'Mi tienda' } }), load: async () => ({ business: { name: 'Mi tienda' } }) } },
    { provide: AgentsApiService, useValue: { getPrimary: async () => {
      if (missingSeller) throw new HttpErrorResponse({ status: 404 });
      return { quality: { score: 240, max: 240 }, isActive, initialMessage: 'Hola', handoffMessage: 'Te atendemos' };
    } } },
    { provide: CatalogApiService, useValue: catalog },
    { provide: MessagingApiService, useValue: { listChannels: async () => [{ type: 'WHATSAPP', healthStatus, externalId: 'qa-channel' }], listConversations: async () => [{}] } },
    { provide: OrdersApiService, useValue: { list: async () => [{}] } },
    { provide: StoreApiService, useValue: { get: async () => ({ storefront: { status: 'PUBLISHED', logoUrl: 'https://cdn.example/logo.png' }, checklist: [], themeStatus: { active: { template: 'classic', version: '1' }, editing: { template: 'classic', version: '1' } } }) } },
    { provide: PaymentsApiService, useValue: { get: async () => ({ connected: true }) } },
    { provide: ShippingApiService, useValue: { get: async () => ({ shippingOriginUbigeo: '150101', pickupEnabled: false, deliveryEnabled: true, carrierRates: { olva: [1] } }) } },
    { provide: IntegrationsApiService, useValue: { getCustomDomain: async () => ({ status: 'active', domain: 'mi-tienda.pe' }) } },
  ] });
  const fixture = TestBed.createComponent(GetStartedPage);
  fixture.detectChanges();
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, catalog };
}

afterEach(() => TestBed.resetTestingModule());

describe('onboarding readiness and recovery', () => {
  it('renders the seller score against the API maximum', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.textContent).toContain('240/240 puntos');
    expect(fixture.nativeElement.textContent).not.toContain('/200');
  });

  it('keeps setup priority order and hides completed cards', async () => {
    const { fixture, page } = await setup('DISCONNECTED');
    expect(page.nextStepId()).toBe('channel');
    expect(fixture.nativeElement.querySelector('#setup-next-title').textContent).toBe('Conecta WhatsApp');
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.home-card:not(.home-card--optimize)')) as HTMLElement[];
    expect(cards.map((card) => card.querySelector('.home-card__title')?.textContent?.trim())).toEqual([
      'Conecta WhatsApp',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Agrega tu primer producto');
    expect(fixture.nativeElement.textContent).not.toContain('Elige el diseño de tu tienda');
    expect(fixture.nativeElement.textContent).toContain('tareas completadas');
  });

  it('surfaces setup cards first when the store is empty', async () => {
    const catalog = { list: vi.fn(async () => []) };
    TestBed.configureTestingModule({ imports: [GetStartedPage], providers: [
      provideRouter([]),
      { provide: AccountApiService, useValue: { profile: () => ({ business: { name: 'Mi tienda' } }), load: async () => ({ business: { name: 'Mi tienda' } }) } },
      { provide: AgentsApiService, useValue: { getPrimary: async () => { throw new HttpErrorResponse({ status: 404 }); } } },
      { provide: CatalogApiService, useValue: catalog },
      { provide: MessagingApiService, useValue: { listChannels: async () => [], listConversations: async () => [] } },
      { provide: OrdersApiService, useValue: { list: async () => [] } },
      { provide: StoreApiService, useValue: { get: async () => ({ storefront: { status: 'DRAFT', logoUrl: null }, checklist: [], themeStatus: { active: { template: 'classic', version: '1' }, editing: { template: 'classic', version: '1' } } }) } },
      { provide: PaymentsApiService, useValue: { get: async () => ({ connected: false }) } },
      { provide: ShippingApiService, useValue: { get: async () => ({ shippingOriginUbigeo: null, pickupEnabled: false, deliveryEnabled: false, carrierRates: null }) } },
      { provide: IntegrationsApiService, useValue: { getCustomDomain: async () => ({ status: 'none', domain: null }) } },
    ] });
    const fixture = TestBed.createComponent(GetStartedPage);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    fixture.detectChanges();
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.home-card:not(.home-card--optimize)')) as HTMLElement[];
    expect(cards.map((card) => card.querySelector('.home-card__title')?.textContent?.trim())).toEqual([
      'Agrega tu primer producto',
      'Elige el diseño de tu tienda',
      'Configura los pagos',
      'Obtén un dominio personalizado',
      'Revisa las tarifas de envío',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Optimiza Mi tienda');
  });

  it('treats a missing seller as an incomplete step rather than a failed dashboard', async () => {
    const { page } = await setup('CONNECTED', true, false, true);
    expect(page.errorMessage()).toBeNull();
    expect(page.agentReady()).toBe(false);
    expect(page.nextStepId()).toBe('seller');
    expect(page.progressPercent()).toBe(89);
  });
  it.each(['PENDING', 'DEGRADED', 'DISCONNECTED'])('does not treat %s with an external ID as ready', async (health) => {
    const { page } = await setup(health);
    expect(page.progressPercent()).toBe(89);
    expect(page.channelReady()).toBe(false);
    expect(page.readyToSell()).toBe(false);
  });

  it('requires an active seller before announcing readiness', async () => {
    const { page } = await setup('CONNECTED', false);
    expect(page.agentReady()).toBe(false);
    expect(page.readyToSell()).toBe(false);
  });

  it('hides unknown progress on a failed request and recovers from the visible retry', async () => {
    const { fixture, page, catalog } = await setup('CONNECTED', true, true);
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('0%');
    expect(fixture.nativeElement.textContent).not.toContain('Agrega tu primer producto');
    catalog.list.mockResolvedValue([{ isAvailable: true }]);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    fixture.detectChanges();
    expect(page.errorMessage()).toBeNull();
    expect(page.readyToSell()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('100');
  });
});
