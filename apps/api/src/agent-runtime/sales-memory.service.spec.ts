import { ConfigService } from '@nestjs/config';
import { SalesMemoryService } from './sales-memory.service';
import { ExplicitFact, initialSalesState } from './sales-state';

describe('SalesMemoryService security', () => {
  const upsert = jest.fn();
  const findFirst = jest.fn();
  let service: SalesMemoryService;

  beforeEach(() => {
    upsert.mockReset();
    findFirst.mockReset();
    service = new SalesMemoryService(
      {
        salesCustomerMemory: { upsert, findFirst },
      } as never,
      { redis: null } as never,
      { get: (_key: string, value: unknown) => value } as ConfigService,
    );
  });

  it('customerKey is a stable hash and does not embed raw phone/thread plaintext', () => {
    const key = service.customerKey('ch-1', '+51999888777');
    expect(key).toHaveLength(64);
    expect(key).not.toContain('999');
    expect(key).not.toContain('ch-1');
    expect(service.customerKey('ch-1', '+51999888777')).toBe(key);
    expect(service.customerKey('ch-2', '+51999888777')).not.toBe(key);
  });

  it('saveCustomer persists only durable customer facts and scopes by tenantId', async () => {
    const state = initialSalesState();
    const stamp = (value: string, scope: ExplicitFact['scope']): ExplicitFact => ({
      value,
      source: 't',
      confidence: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      scope,
    });
    state.customerFacts = {
      name: stamp('Ana', 'customer'),
      destination: stamp('Miraflores, Lima, Lima', 'customer'),
      price: stamp('15000', 'customer'),
      stock: stamp('2', 'customer'),
    };
    state.requirements = { size: stamp('40', 'conversation') };
    await service.saveCustomer('tenant-a', 'key-a', state);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_customerKey: { tenantId: 'tenant-a', customerKey: 'key-a' } },
      }),
    );
    const created = upsert.mock.calls[0][0].create.facts as Record<
      string,
      ExplicitFact
    >;
    expect(Object.keys(created).sort()).toEqual(['destination', 'name']);
    expect(created.price).toBeUndefined();
    expect(created.stock).toBeUndefined();
  });

  it('loadCustomer always queries with tenantId and ignores expired rows', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.loadCustomer('tenant-b', 'key-a')).resolves.toEqual(
      {},
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-b',
        customerKey: 'key-a',
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });
});
