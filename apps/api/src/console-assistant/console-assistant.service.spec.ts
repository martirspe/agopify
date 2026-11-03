import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsoleAssistantService } from './console-assistant.service';

describe('ConsoleAssistantService', () => {
  const userId = 'user-1';
  const tenantId = 'tenant-1';

  function setup(overrides?: {
    preference?: { memoryEnabled: boolean } | null;
    conversations?: Array<{
      id: string;
      title: string;
      messages: unknown;
      updatedAt: Date;
      userId?: string;
      tenantId?: string;
    }>;
  }) {
    const preference = overrides?.preference ?? null;
    const conversations = overrides?.conversations ?? [];
    const prisma = {
      consoleAssistantPreference: {
        findUnique: jest.fn().mockResolvedValue(preference),
        upsert: jest.fn().mockImplementation(({ create, update }) =>
          Promise.resolve({ memoryEnabled: update?.memoryEnabled ?? create.memoryEnabled }),
        ),
      },
      consoleAssistantConversation: {
        findMany: jest.fn().mockResolvedValue(conversations),
        findFirst: jest.fn().mockResolvedValue(conversations[0] ? { id: conversations[0].id } : null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: data.id,
            title: data.title,
            messages: data.messages,
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: conversations[0]!.id,
            title: data.title,
            messages: data.messages ?? conversations[0]!.messages,
            updatedAt: new Date('2026-01-03T00:00:00.000Z'),
          }),
        ),
        deleteMany: jest.fn().mockResolvedValue({ count: conversations.length ? 1 : 0 }),
        count: jest.fn().mockResolvedValue(conversations.length),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const service = new ConsoleAssistantService(prisma as never);
    return { service, prisma };
  }

  it('returns default memory and empty history when nothing is stored', async () => {
    const { service } = setup();
    await expect(service.getState(userId, tenantId)).resolves.toEqual({
      memoryEnabled: true,
      conversations: [],
    });
  });

  it('maps stored conversations for the current user and tenant', async () => {
    const { service } = setup({
      preference: { memoryEnabled: false },
      conversations: [
        {
          id: 'c-10000001',
          title: 'Portada',
          messages: [{ id: 'm1', role: 'user', text: 'Hola' }],
          updatedAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ],
    });
    const state = await service.getState(userId, tenantId);
    expect(state.memoryEnabled).toBe(false);
    expect(state.conversations).toEqual([
      {
        id: 'c-10000001',
        title: 'Portada',
        updatedAt: Date.parse('2026-01-01T12:00:00.000Z'),
        messages: [{ id: 'm1', role: 'user', text: 'Hola' }],
      },
    ]);
  });

  it('rejects empty conversation upserts', async () => {
    const { service } = setup();
    await expect(
      service.upsertConversation(userId, tenantId, 'c-10000001', {
        title: 'Vacía',
        messages: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a conversation owned by the caller', async () => {
    const { service, prisma } = setup();
    const row = await service.upsertConversation(userId, tenantId, 'c-10000001', {
      title: 'Portada',
      messages: [{ id: 'm1', role: 'user', text: 'Hola' }],
    });
    expect(prisma.consoleAssistantConversation.create).toHaveBeenCalled();
    expect(row.id).toBe('c-10000001');
    expect(row.messages[0]?.text).toBe('Hola');
  });

  it('deletes only when the conversation belongs to the caller', async () => {
    const { service } = setup();
    await expect(service.deleteConversation(userId, tenantId, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
