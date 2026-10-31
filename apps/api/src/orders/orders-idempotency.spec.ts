import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService chat idempotency', () => {
  let service: OrdersService;
  let prisma: {
    conversation: { findFirst: jest.Mock };
    product: { findFirst: jest.Mock };
    tenant: { findUniqueOrThrow: jest.Mock };
    order: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    message: { create: jest.Mock };
  };
  const createPaymentLink = jest.fn();

  beforeEach(() => {
    prisma = {
      conversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conv-1',
          contactName: 'Ana',
          contactPhone: null,
          channel: { type: 'WHATSAPP' },
        }),
      },
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          kind: 'PHYSICAL',
          digitalAccessUrl: null,
        }),
      },
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ currency: 'PEN' }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      message: { create: jest.fn() },
    };
    service = new OrdersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { publish: jest.fn() } as never,
      {} as never,
    );
    createPaymentLink.mockReset();
    jest
      .spyOn(service, 'createPaymentLink')
      .mockImplementation(createPaymentLink);
  });

  it('replays the same draft without creating a second order', async () => {
    const existing = {
      id: 'ord-1',
      tenantId: 'tenant-a',
      requestHash: 'hash-1',
      checkoutKey: 'chat:tenant-a:conv-1:hash-1',
      payments: [{ checkoutUrl: 'https://pay.example/1' }],
      totalCents: 15000,
      currency: 'PEN',
    };
    prisma.order.findUnique.mockResolvedValue(existing);
    const result = await service.create(
      'tenant-a',
      {
        conversationId: 'conv-1',
        items: [
          {
            productId: 'p1',
            title: 'Zapatilla',
            quantity: 1,
            unitCents: 15000,
          },
        ],
        createPaymentLink: true,
      },
      undefined,
      {
        checkoutKey: 'chat:tenant-a:conv-1:hash-1',
        requestHash: 'hash-1',
      },
    );
    expect(result).toBe(existing);
    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(createPaymentLink).not.toHaveBeenCalled();
  });

  it('rejects a checkoutKey reuse with a different requestHash (tenant-safe)', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      tenantId: 'tenant-a',
      requestHash: 'hash-1',
      checkoutKey: 'chat:tenant-a:conv-1:hash-1',
      payments: [],
    });
    await expect(
      service.create(
        'tenant-a',
        {
          conversationId: 'conv-1',
          items: [
            {
              productId: 'p1',
              title: 'Zapatilla',
              quantity: 1,
              unitCents: 15000,
            },
          ],
        },
        undefined,
        {
          checkoutKey: 'chat:tenant-a:conv-1:hash-1',
          requestHash: 'hash-2',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never returns another tenant order for the same checkoutKey', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'ord-x',
      tenantId: 'tenant-b',
      requestHash: 'hash-1',
      checkoutKey: 'chat:tenant-a:conv-1:hash-1',
      payments: [],
    });
    await expect(
      service.create(
        'tenant-a',
        {
          conversationId: 'conv-1',
          items: [
            {
              productId: 'p1',
              title: 'Zapatilla',
              quantity: 1,
              unitCents: 15000,
            },
          ],
        },
        undefined,
        {
          checkoutKey: 'chat:tenant-a:conv-1:hash-1',
          requestHash: 'hash-1',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('on unique race (P2002) reloads the winning order', async () => {
    const existing = {
      id: 'ord-race',
      tenantId: 'tenant-a',
      requestHash: 'hash-1',
      checkoutKey: 'chat:tenant-a:conv-1:hash-1',
      payments: [{ checkoutUrl: 'https://pay.example/race' }],
    };
    prisma.order.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    prisma.order.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const result = await service.create(
      'tenant-a',
      {
        conversationId: 'conv-1',
        items: [
          {
            productId: 'p1',
            title: 'Zapatilla',
            quantity: 1,
            unitCents: 15000,
          },
        ],
        createPaymentLink: true,
      },
      undefined,
      {
        checkoutKey: 'chat:tenant-a:conv-1:hash-1',
        requestHash: 'hash-1',
      },
    );
    expect(result).toBe(existing);
  });
});
