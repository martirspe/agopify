import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { PublicProductList } from '@vendedoria/contracts';
import { STORE_PROXY_PREFIX } from './store-context';
import { TemplateDemo } from './template-demo';
import { templateDemoInterceptor } from './template-demo.interceptor';

describe('Template demo catalog queries', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideHttpClient(withInterceptors([templateDemoInterceptor])),
    { provide: TemplateDemo, useValue: { template: 'selecta', origin: 'http://localhost' } },
  ] }));

  it('applies category parameters supplied through HttpClient', async () => {
    const result = await firstValueFrom(TestBed.inject(HttpClient).get<PublicProductList>(`${STORE_PROXY_PREFIX}/products`, {
      params: { category: 'Fragancias > Sets' },
    }));
    expect(result.total).toBe(2);
    expect(result.items.map(p => p.handle)).toEqual(['set-icono', 'set-osadia']);
  });

  it('applies sorting and page size together', async () => {
    const result = await firstValueFrom(TestBed.inject(HttpClient).get<PublicProductList>(`${STORE_PROXY_PREFIX}/products`, {
      params: { sort: 'price-asc', pageSize: '1' },
    }));
    expect(result.total).toBe(4);
    expect(result.items.map(p => p.handle)).toEqual(['locion-icono']);
  });
});
