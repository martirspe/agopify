import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SalesAgent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import {
  buildAgentPrompt,
  buildGuidedPersona,
  toPersonality,
} from '../agent-runtime/sales-playbook';
import { describeModeChange } from '../agent-runtime/migration-policy';
import { recordSecurityEvent } from '../agent-runtime/security-events';
import { assertManager } from '../common/roles';
import type { AuthUserPayload } from '../common/types/auth-user';
import { computeAgentQuality } from './agent-quality';
import { aggregateSalesTurnAnalytics } from './agent-analytics';
import {
  CreateSalesAgentDto,
  UpdateSalesAgentDto,
} from './dto/update-sales-agent.dto';

export const MAX_AGENTS_PER_TENANT = 10;

type AgentWithChannels = SalesAgent & { channels: Array<{ id: string }> };

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async list(tenantId: string) {
    const agents = await this.prisma.salesAgent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        isActive: true,
        promptMode: true,
        aiRuntimeMode: true,
        channels: { select: { id: true } },
      },
    });
    return agents.map((agent, index) => ({
      id: agent.id,
      name: agent.name,
      isActive: agent.isActive,
      promptMode: agent.promptMode,
      aiRuntimeMode: agent.aiRuntimeMode,
      isPrimary: index === 0,
      channelIds: agent.channels.map((channel) => channel.id),
    }));
  }

  async getPrimary(tenantId: string) {
    return this.toResponse(tenantId, await this.findPrimary(tenantId));
  }

  async updatePrimary(user: AuthUserPayload, dto: UpdateSalesAgentDto) {
    const agent = await this.findPrimary(user.tenantId);
    return this.update(user, agent.id, dto);
  }

  async get(tenantId: string, id: string) {
    return this.toResponse(tenantId, await this.findOwned(tenantId, id));
  }

  /**
   * Per-agent operational metrics from durable sales turns (tenant-scoped).
   * Does not expose message bodies or contact PII.
   */
  async analytics(tenantId: string, id: string, days = 7) {
    await this.findOwned(tenantId, id);
    const windowDays = Math.min(90, Math.max(1, Math.trunc(days) || 7));
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const turns = await this.prisma.salesEngineTurn.findMany({
      where: {
        tenantId,
        createdAt: { gte: since },
        conversation: { channel: { salesAgentId: id } },
      },
      select: { status: true, trace: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return aggregateSalesTurnAnalytics(turns, windowDays);
  }

  async create(tenantId: string, dto: CreateSalesAgentDto) {
    const count = await this.prisma.salesAgent.count({ where: { tenantId } });
    if (count >= MAX_AGENTS_PER_TENANT) {
      throw new BadRequestException(
        `Puedes tener hasta ${MAX_AGENTS_PER_TENANT} vendedores.`,
      );
    }
    // Fresh agent = blank slate (no persona copy) unless the merchant explicitly clones.
    const source = dto.copyFromId
      ? await this.findOwned(tenantId, dto.copyFromId)
      : null;
    const created = await this.prisma.salesAgent.create({
      data: source
        ? { ...this.copyableFields(source), tenantId, name: dto.name.trim() }
        : {
            tenantId,
            name: dto.name.trim(),
            // Empty techniques → only the hard-coded sales method until configured.
            salesTechniques: [],
            aiRuntimeMode: 'ai_core',
          },
      include: { channels: { select: { id: true } } },
    });
    return this.toResponse(tenantId, created);
  }

  async update(user: AuthUserPayload, id: string, dto: UpdateSalesAgentDto) {
    const tenantId = user.tenantId;
    const current = await this.findOwned(tenantId, id);
    if (
      dto.aiRuntimeMode !== undefined &&
      dto.aiRuntimeMode !== current.aiRuntimeMode
    ) {
      // Motor changes are ops/migration controls — not day-to-day AGENT work.
      assertManager(
        user,
        'Solo el dueño o un administrador puede cambiar el motor de inteligencia.',
      );
    }
    const updated = await this.prisma.salesAgent.update({
      where: { id },
      data: dto,
      include: { channels: { select: { id: true } } },
    });
    if (
      dto.aiRuntimeMode !== undefined &&
      dto.aiRuntimeMode !== current.aiRuntimeMode
    ) {
      const change = describeModeChange(
        current.aiRuntimeMode,
        dto.aiRuntimeMode,
      );
      recordSecurityEvent({
        code: 'ai_runtime_mode_changed',
        tenantId,
        resource: 'sales_agent',
        detail: `${change.from}->${change.to}:${change.risk}:${user.membershipRole}`,
      });
    }
    return this.toResponse(tenantId, updated);
  }

  async remove(tenantId: string, id: string) {
    const [agent, primary] = await Promise.all([
      this.findOwned(tenantId, id),
      this.findPrimary(tenantId),
    ]);
    if (agent.id === primary.id) {
      throw new BadRequestException(
        'El vendedor principal no se puede eliminar.',
      );
    }
    await this.prisma.salesAgent.delete({ where: { id: agent.id } });
    return { deleted: true };
  }

  /** The agent answers exactly these channels; channels it leaves go back to the primary agent. */
  async assignChannels(tenantId: string, id: string, channelIds: string[]) {
    const agent = await this.findOwned(tenantId, id);
    const unique = [...new Set(channelIds)];
    const owned = await this.prisma.channel.count({
      where: { tenantId, id: { in: unique } },
    });
    if (owned !== unique.length) {
      throw new NotFoundException('Channel not found');
    }
    await this.prisma.$transaction([
      this.prisma.channel.updateMany({
        where: { tenantId, salesAgentId: agent.id, id: { notIn: unique } },
        data: { salesAgentId: null },
      }),
      this.prisma.channel.updateMany({
        where: { tenantId, id: { in: unique } },
        data: { salesAgentId: agent.id },
      }),
    ]);
    return this.get(tenantId, agent.id);
  }

  /** Compiled prompt so advanced users can audit it or start a custom prompt from it. */
  async promptPreview(tenantId: string, id: string) {
    const personality = toPersonality(await this.findOwned(tenantId, id));
    return {
      guidedPersona: buildGuidedPersona(personality),
      effectivePrompt: buildAgentPrompt(personality),
    };
  }

  private async findPrimary(tenantId: string): Promise<AgentWithChannels> {
    const agent = await this.prisma.salesAgent.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { channels: { select: { id: true } } },
    });
    if (!agent) {
      throw new NotFoundException('Sales agent not found');
    }
    return agent;
  }

  private async findOwned(tenantId: string, id: string): Promise<AgentWithChannels> {
    const agent = await this.prisma.salesAgent.findFirst({
      where: { id, tenantId },
      include: { channels: { select: { id: true } } },
    });
    if (!agent) {
      throw new NotFoundException('Sales agent not found');
    }
    return agent;
  }

  private copyableFields(source: AgentWithChannels) {
    const {
      id: _id,
      tenantId: _tenantId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      channels: _channels,
      ...fields
    } = source;
    return fields;
  }

  private async toResponse(tenantId: string, agent: AgentWithChannels) {
    const [extras, primary] = await Promise.all([
      this.knowledge.getQualityExtras(tenantId),
      this.prisma.salesAgent.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
    ]);
    const { channels, ...fields } = agent;
    return {
      ...fields,
      isPrimary: primary?.id === agent.id,
      channelIds: channels.map((channel) => channel.id),
      quality: computeAgentQuality(agent, extras),
    };
  }
}
