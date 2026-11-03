import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ImportConsoleAssistantConversationsDto,
  RenameConsoleAssistantConversationDto,
  UpdateConsoleAssistantPreferencesDto,
  UpsertConsoleAssistantConversationDto,
} from './dto/console-assistant.dto';

const MAX_CONVERSATIONS = 40;

export type ConsoleAssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  bullets?: string[];
};

export type ConsoleAssistantConversationView = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ConsoleAssistantMessage[];
};

export type ConsoleAssistantState = {
  memoryEnabled: boolean;
  conversations: ConsoleAssistantConversationView[];
};

@Injectable()
export class ConsoleAssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(userId: string, tenantId: string): Promise<ConsoleAssistantState> {
    const [preference, rows] = await Promise.all([
      this.prisma.consoleAssistantPreference.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        select: { memoryEnabled: true },
      }),
      this.prisma.consoleAssistantConversation.findMany({
        where: { userId, tenantId },
        orderBy: { updatedAt: 'desc' },
        take: MAX_CONVERSATIONS,
        select: { id: true, title: true, messages: true, updatedAt: true },
      }),
    ]);

    return {
      memoryEnabled: preference?.memoryEnabled ?? true,
      conversations: rows.map(mapConversation),
    };
  }

  async updatePreferences(
    userId: string,
    tenantId: string,
    dto: UpdateConsoleAssistantPreferencesDto,
  ): Promise<{ memoryEnabled: boolean }> {
    const row = await this.prisma.consoleAssistantPreference.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      create: { userId, tenantId, memoryEnabled: dto.memoryEnabled },
      update: { memoryEnabled: dto.memoryEnabled },
      select: { memoryEnabled: true },
    });
    return { memoryEnabled: row.memoryEnabled };
  }

  async upsertConversation(
    userId: string,
    tenantId: string,
    id: string,
    dto: UpsertConsoleAssistantConversationDto,
  ): Promise<ConsoleAssistantConversationView> {
    const messages = sanitizeMessages(dto.messages);
    if (!messages.length) {
      throw new BadRequestException('La conversación necesita al menos un mensaje.');
    }
    const title = dto.title.trim().slice(0, 72) || 'Nueva conversación';
    const payload = {
      title,
      messages: messages as Prisma.InputJsonValue,
    };

    const owned = await this.prisma.consoleAssistantConversation.findFirst({
      where: { id, userId, tenantId },
      select: { id: true },
    });

    let row: {
      id: string;
      title: string;
      messages: Prisma.JsonValue;
      updatedAt: Date;
    };

    if (owned) {
      row = await this.prisma.consoleAssistantConversation.update({
        where: { id },
        data: payload,
        select: { id: true, title: true, messages: true, updatedAt: true },
      });
    } else {
      const taken = await this.prisma.consoleAssistantConversation.findUnique({
        where: { id },
        select: { id: true },
      });
      if (taken) {
        throw new BadRequestException('No se pudo guardar esa conversación.');
      }
      row = await this.prisma.consoleAssistantConversation.create({
        data: { id, userId, tenantId, ...payload },
        select: { id: true, title: true, messages: true, updatedAt: true },
      });
    }

    await this.trimExcess(userId, tenantId);
    return mapConversation(row);
  }

  async renameConversation(
    userId: string,
    tenantId: string,
    id: string,
    dto: RenameConsoleAssistantConversationDto,
  ): Promise<ConsoleAssistantConversationView> {
    const existing = await this.prisma.consoleAssistantConversation.findFirst({
      where: { id, userId, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('No encontramos esa conversación.');
    }
    const title = dto.title.trim().slice(0, 72) || 'Nueva conversación';
    const row = await this.prisma.consoleAssistantConversation.update({
      where: { id },
      data: { title },
      select: { id: true, title: true, messages: true, updatedAt: true },
    });
    return mapConversation(row);
  }

  async deleteConversation(userId: string, tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.consoleAssistantConversation.deleteMany({
      where: { id, userId, tenantId },
    });
    if (!result.count) {
      throw new NotFoundException('No encontramos esa conversación.');
    }
  }

  /**
   * One-shot import of device-local history when the account has none yet.
   * Skips ids that already exist for this user+tenant.
   */
  async importConversations(
    userId: string,
    tenantId: string,
    dto: ImportConsoleAssistantConversationsDto,
  ): Promise<ConsoleAssistantState> {
    const existing = await this.prisma.consoleAssistantConversation.count({
      where: { userId, tenantId },
    });
    if (existing > 0) {
      return this.getState(userId, tenantId);
    }

    const items = dto.conversations
      .slice(0, MAX_CONVERSATIONS)
      .map((item) => {
        const messages = sanitizeMessages(item.messages);
        if (!messages.length) return null;
        const updatedAt =
          typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) && item.updatedAt > 0
            ? new Date(item.updatedAt)
            : new Date();
        return {
          id: item.id,
          userId,
          tenantId,
          title: item.title.trim().slice(0, 72) || 'Nueva conversación',
          messages: messages as Prisma.InputJsonValue,
          updatedAt,
          createdAt: updatedAt,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (items.length) {
      await this.prisma.consoleAssistantConversation.createMany({
        data: items,
        skipDuplicates: true,
      });
    }

    return this.getState(userId, tenantId);
  }

  private async trimExcess(userId: string, tenantId: string): Promise<void> {
    const keep = await this.prisma.consoleAssistantConversation.findMany({
      where: { userId, tenantId },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CONVERSATIONS,
      select: { id: true },
    });
    const keepIds = keep.map((row) => row.id);
    if (keepIds.length < MAX_CONVERSATIONS) return;
    await this.prisma.consoleAssistantConversation.deleteMany({
      where: { userId, tenantId, id: { notIn: keepIds } },
    });
  }
}

function mapConversation(row: {
  id: string;
  title: string;
  messages: Prisma.JsonValue;
  updatedAt: Date;
}): ConsoleAssistantConversationView {
  return {
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.getTime(),
    messages: sanitizeMessages(row.messages),
  };
}

function sanitizeMessages(raw: unknown): ConsoleAssistantMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ConsoleAssistantMessage[] = [];
  for (const item of raw.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = typeof record['id'] === 'string' ? record['id'].slice(0, 64) : '';
    const role = record['role'] === 'user' || record['role'] === 'assistant' ? record['role'] : null;
    const text = typeof record['text'] === 'string' ? record['text'].slice(0, 8000) : '';
    if (!id || !role || !text) continue;
    const message: ConsoleAssistantMessage = { id, role, text };
    if (typeof record['status'] === 'string' && record['status'].trim()) {
      message.status = record['status'].slice(0, 240);
    }
    if (Array.isArray(record['bullets'])) {
      const bullets = record['bullets']
        .filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
        .slice(0, 20)
        .map((b) => b.slice(0, 500));
      if (bullets.length) message.bullets = bullets;
    }
    out.push(message);
  }
  return out;
}
