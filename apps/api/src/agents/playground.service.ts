import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildAgentContext, HISTORY_LIMIT } from '../agent-runtime/conversation-context';
import {
  type AgentProductImage,
  SalesAgentRuntimeService,
} from '../agent-runtime/sales-agent-runtime.service';
import type { AgentToolTrace } from '../agent-runtime/sales-agent-tools.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { readSalesState } from '../agent-runtime/sales-state';

/** Tool name used so playground history tracks photos like live image messages. */
export const PLAYGROUND_IMAGE_TOOL = 'send_product_image';

@Injectable()
export class PlaygroundService {
  private readonly logger = new Logger(PlaygroundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentRuntime: SalesAgentRuntimeService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  async createSession(tenantId: string, title?: string) {
    return this.prisma.playgroundSession.create({
      data: {
        tenantId,
        title: title?.trim() || 'Prueba del vendedor',
      },
      include: { messages: true },
    });
  }

  async getLatestOrCreate(tenantId: string) {
    const existing = await this.prisma.playgroundSession.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
      },
    });
    if (existing) {
      return existing;
    }
    return this.createSession(tenantId);
  }

  async getSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.playgroundSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!session) {
      throw new NotFoundException('Playground session not found');
    }
    return session;
  }

  async resetSession(tenantId: string, sessionId: string) {
    const session = await this.ensureOwnership(tenantId, sessionId);
    await this.prisma.playgroundMessage.deleteMany({
      where: { sessionId: session.id },
    });
    await this.prisma.playgroundSession.update({
      where: { id: session.id, tenantId },
      data: { salesState: {} },
    });
    return this.getSession(tenantId, session.id);
  }

  /**
   * Same SalesAgentRuntimeService path as WhatsApp/Instagram turns.
   * Commerce stays dry-run (`mode: playground`); buyer-facing copy matches production.
   */
  async sendMessage(
    tenantId: string,
    sessionId: string,
    text: string,
    agentId?: string,
  ) {
    const session = await this.ensureOwnership(tenantId, sessionId);
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        session: await this.getSession(tenantId, session.id),
        lastAgentReply: {
          replyText: '',
          escalate: false,
          usedCatalog: false,
          tools: [],
          images: [],
          dryRun: true,
        },
      };
    }
    const earlier = await this.prisma.playgroundMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { authorType: true, body: true, toolTraces: true },
    });
    const context = buildAgentContext(
      earlier.reverse().map((message) => ({
        authorType: message.authorType,
        body: message.body,
        metadata: { tools: message.toolTraces },
      })),
    );

    await this.prisma.playgroundMessage.create({
      data: {
        sessionId: session.id,
        direction: 'INBOUND',
        authorType: 'BUYER',
        body: trimmed,
      },
    });

    const channelId = await this.resolveChannelId(tenantId, agentId);

    let agentResult: Awaited<
      ReturnType<SalesAgentRuntimeService['generateReply']>
    >;
    try {
      agentResult = await this.agentRuntime.generateReply({
        tenantId,
        agentId,
        channelId,
        conversationId: null,
        inboundText: trimmed,
        // Dry-run commerce only — prompt and pause rules match production.
        mode: 'playground',
        customerName: 'Comprador de prueba',
        customerPhone: null,
        history: context.history,
        shownImageProductIds: context.shownImageProductIds,
        allowAi: await this.planLimits.canUseAi(tenantId),
        salesState: readSalesState(session.salesState),
        messageId: `playground:${session.id}`,
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'playground_turn_failed',
          tenantId,
          sessionId: session.id,
          errorClass: error instanceof Error ? error.name : 'unknown',
        }),
      );
      agentResult = {
        replyText:
          'No pude completar esa respuesta de prueba. Intenta de nuevo o reinicia la conversación.',
        escalate: false,
        usedCatalog: false,
        pauseOnHandoff: false,
        tools: [
          {
            name: 'escalate',
            status: 'error',
            summary: 'Error interno en la prueba',
          },
        ],
        images: [],
        salesState: readSalesState(session.salesState),
      };
    }

    if (agentResult.usedAi) {
      await this.planLimits.recordAiReply(tenantId);
    }

    const tools = this.withImageTraces(
      agentResult.tools ?? [],
      agentResult.images ?? [],
    );

    await this.prisma.playgroundMessage.create({
      data: {
        sessionId: session.id,
        direction: 'OUTBOUND',
        authorType: 'SALES_AGENT',
        body: agentResult.replyText,
        toolTraces: tools as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.playgroundSession.update({
      where: { id: session.id, tenantId },
      data: {
        updatedAt: new Date(),
        salesState: (agentResult.salesState ??
          readSalesState(session.salesState)) as unknown as Prisma.InputJsonValue,
      },
    });

    const refreshed = await this.getSession(tenantId, session.id);
    return {
      session: refreshed,
      lastAgentReply: {
        replyText: agentResult.replyText,
        escalate: agentResult.escalate,
        usedCatalog: agentResult.usedCatalog,
        tools,
        images: agentResult.images ?? [],
        orderId: agentResult.orderId,
        orderRef: agentResult.orderRef,
        checkoutUrl: agentResult.checkoutUrl,
        dryRun: true,
      },
    };
  }

  /** Prefer a WhatsApp/Instagram channel assigned to this agent (same resolve path as live). */
  private async resolveChannelId(
    tenantId: string,
    agentId?: string,
  ): Promise<string | null> {
    if (!agentId) {
      const primary = await this.prisma.channel.findFirst({
        where: {
          tenantId,
          type: { in: ['WHATSAPP', 'INSTAGRAM'] },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      return primary?.id ?? null;
    }
    const assigned = await this.prisma.channel.findFirst({
      where: {
        tenantId,
        salesAgentId: agentId,
        type: { in: ['WHATSAPP', 'INSTAGRAM'] },
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (assigned) return assigned.id;
    const any = await this.prisma.channel.findFirst({
      where: {
        tenantId,
        type: { in: ['WHATSAPP', 'INSTAGRAM'] },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return any?.id ?? null;
  }

  private withImageTraces(
    tools: AgentToolTrace[],
    images: AgentProductImage[],
  ): AgentToolTrace[] {
    if (!images.length) return tools;
    return [
      ...tools,
      ...images.map(
        (image): AgentToolTrace => ({
          name: PLAYGROUND_IMAGE_TOOL,
          status: 'ok',
          summary: image.caption || 'Foto de producto',
          data: {
            productId: image.productId,
            imageUrl: image.imageUrl,
            caption: image.caption,
          },
        }),
      ),
    ];
  }

  private async ensureOwnership(tenantId: string, sessionId: string) {
    const session = await this.prisma.playgroundSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) {
      throw new NotFoundException('Playground session not found');
    }
    return session;
  }
}
