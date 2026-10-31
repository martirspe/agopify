import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { KnowledgeTopic } from '@prisma/client';
import { SalesSearchService } from '../agent-runtime/sales-search.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplyKnowledgeTemplatesDto,
  CreateJourneyTemplateDto,
  CreateKnowledgeFaqDto,
  ImportKnowledgePasteDto,
  UpdateJourneyTemplateDto,
  UpdateKnowledgeFaqDto,
} from './dto/knowledge.dto';
import {
  KNOWLEDGE_POLICY_TEMPLATES,
  KNOWLEDGE_TOPIC_META,
  topicLabel,
} from './knowledge-topics';

export type KnowledgeFaqView = {
  id: string;
  question: string;
  answer: string;
  topic: string;
  tags: string[];
  source: string;
  reviewStatus: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly semantic?: SalesSearchService) {}

  listFaqs(tenantId: string) {
    return this.prisma.knowledgeFaq.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createFaq(tenantId: string, dto: CreateKnowledgeFaqDto) {
    return this.prisma.knowledgeFaq.create({
      data: {
        tenantId,
        question: dto.question.trim(),
        answer: dto.answer.trim(),
        topic: (dto.topic ?? 'GENERAL') as KnowledgeTopic,
        tags: this.normalizeTags(dto.tags),
        isPublished: dto.isPublished ?? true,
        reviewStatus: 'APPROVED',
        source: 'MANUAL',
      },
    });
  }

  async updateFaq(
    tenantId: string,
    faqId: string,
    dto: UpdateKnowledgeFaqDto,
  ) {
    await this.requireFaq(tenantId, faqId);
    return this.prisma.knowledgeFaq.update({
      where: { id: faqId },
      data: {
        question: dto.question?.trim(),
        answer: dto.answer?.trim(),
        topic: dto.topic as KnowledgeTopic | undefined,
        tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
        isPublished: dto.isPublished,
        reviewStatus: dto.reviewStatus,
      },
    });
  }

  /** Catalog of topics + starter policies (no secrets, no tenant data). */
  listPolicyCatalog() {
    return {
      topics: KNOWLEDGE_TOPIC_META,
      templates: KNOWLEDGE_POLICY_TEMPLATES.map((item) => ({
        ...item,
        topicLabel: topicLabel(item.topic),
      })),
    };
  }

  /**
   * Publishes starter policy FAQs for the selected topics, skipping questions
   * the tenant already has (case-insensitive). Does not overwrite merchant copy.
   */
  async applyPolicyTemplates(
    tenantId: string,
    dto: ApplyKnowledgeTemplatesDto,
  ) {
    const wanted = new Set(dto.topics);
    const starters = KNOWLEDGE_POLICY_TEMPLATES.filter((item) =>
      wanted.has(item.topic),
    );
    const existing = await this.prisma.knowledgeFaq.findMany({
      where: { tenantId },
      select: { question: true },
    });
    const known = new Set(
      existing.map((item) => this.normalizeQuestion(item.question)),
    );
    const toCreate = starters.filter(
      (item) => !known.has(this.normalizeQuestion(item.question)),
    );
    if (!toCreate.length) {
      return { created: [] as KnowledgeFaqView[], skipped: starters.length };
    }
    const created = await this.prisma.$transaction(
      toCreate.map((item, index) =>
        this.prisma.knowledgeFaq.create({
          data: {
            tenantId,
            question: item.question,
            answer: item.answer,
            topic: item.topic as KnowledgeTopic,
            tags: [item.topic.toLowerCase(), 'plantilla'],
            source: 'TEMPLATE',
            reviewStatus: 'APPROVED',
            isPublished: true,
            sortOrder: index,
          },
        }),
      ),
    );
    return {
      created,
      skipped: starters.length - created.length,
    };
  }

  async deleteFaq(tenantId: string, faqId: string) {
    await this.requireFaq(tenantId, faqId);
    await this.prisma.knowledgeFaq.delete({ where: { id: faqId } });
    return { ok: true };
  }

  async approveFaq(tenantId: string, faqId: string) {
    await this.requireFaq(tenantId, faqId);
    return this.prisma.knowledgeFaq.update({
      where: { id: faqId },
      data: {
        reviewStatus: 'APPROVED',
        isPublished: true,
      },
    });
  }

  /**
   * Human-reviewed import: creates DRAFT FAQs from pasted Q/A blocks.
   * Does not publish until the merchant approves.
   */
  async importPaste(tenantId: string, dto: ImportKnowledgePasteDto) {
    const pairs = this.parsePaste(dto.rawText);
    if (!pairs.length) {
      return { created: [] as KnowledgeFaqView[], skipped: true };
    }

    const topic = (dto.topic ?? 'GENERAL') as KnowledgeTopic;
    const created = await this.prisma.$transaction(
      pairs.slice(0, 40).map((pair, index) =>
        this.prisma.knowledgeFaq.create({
          data: {
            tenantId,
            question: pair.question,
            answer: pair.answer,
            topic,
            tags: ['import', topic.toLowerCase()],
            source: 'PASTE_IMPORT',
            reviewStatus: 'DRAFT',
            isPublished: false,
            sortOrder: index,
          },
        }),
      ),
    );

    return { created, skipped: false };
  }

  listJourneys(tenantId: string) {
    return this.prisma.journeyTemplate.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  createJourney(tenantId: string, dto: CreateJourneyTemplateDto) {
    return this.prisma.journeyTemplate.create({
      data: {
        tenantId,
        title: dto.title.trim(),
        stage: dto.stage,
        scriptText: dto.scriptText.trim(),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateJourney(
    tenantId: string,
    journeyId: string,
    dto: UpdateJourneyTemplateDto,
  ) {
    await this.requireJourney(tenantId, journeyId);
    return this.prisma.journeyTemplate.update({
      where: { id: journeyId },
      data: {
        title: dto.title?.trim(),
        stage: dto.stage,
        scriptText: dto.scriptText?.trim(),
        isActive: dto.isActive,
      },
    });
  }

  async deleteJourney(tenantId: string, journeyId: string) {
    await this.requireJourney(tenantId, journeyId);
    await this.prisma.journeyTemplate.delete({ where: { id: journeyId } });
    return { ok: true };
  }

  async getRuntimeKnowledge(tenantId: string, query?: string) {
    const semanticIds = query ? await this.semantic?.candidates(tenantId, query, 'faq') ?? [] : [];
    const [faqs, journeys] = await Promise.all([
      this.prisma.knowledgeFaq.findMany({
        where: {
          tenantId,
          isPublished: true,
          reviewStatus: 'APPROVED',
        },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 80,
      }),
      this.prisma.journeyTemplate.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        take: 12,
      }),
    ]);
    const retrieved = semanticIds.length ? await this.prisma.knowledgeFaq.findMany({ where: { tenantId, id: { in: semanticIds }, isPublished: true, reviewStatus: 'APPROVED' }, take: 12 }) : [];
    return { faqs: [...new Map([...retrieved, ...faqs].map((faq) => [faq.id, faq])).values()], journeys, retrievedFaqIds: retrieved.map((faq) => faq.id) };
  }

  async getQualityExtras(tenantId: string) {
    const [publishedFaqs, activeJourneys, draftFaqs] = await Promise.all([
      this.prisma.knowledgeFaq.count({
        where: {
          tenantId,
          isPublished: true,
          reviewStatus: 'APPROVED',
        },
      }),
      this.prisma.journeyTemplate.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.knowledgeFaq.count({
        where: { tenantId, reviewStatus: 'DRAFT' },
      }),
    ]);
    return { publishedFaqs, activeJourneys, draftFaqs };
  }

  private async requireFaq(tenantId: string, faqId: string) {
    const faq = await this.prisma.knowledgeFaq.findFirst({
      where: { id: faqId, tenantId },
    });
    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }
    return faq;
  }

  private async requireJourney(tenantId: string, journeyId: string) {
    const journey = await this.prisma.journeyTemplate.findFirst({
      where: { id: journeyId, tenantId },
    });
    if (!journey) {
      throw new NotFoundException('Journey template not found');
    }
    return journey;
  }

  private normalizeTags(tags?: string[]) {
    return (tags ?? [])
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 12);
  }

  private normalizeQuestion(question: string) {
    return question.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private parsePaste(
    raw: string,
  ): Array<{ question: string; answer: string }> {
    const text = raw.replace(/\r\n/g, '\n').trim();
    if (!text) return [];

    const qaLinePairs: Array<{ question: string; answer: string }> = [];
    const lines = text.split('\n');
    let pendingQ: string | null = null;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const qMatch = trimmed.match(/^(?:q|pregunta)\s*[:\-]\s*(.+)$/i);
      const aMatch = trimmed.match(/^(?:a|respuesta)\s*[:\-]\s*(.+)$/i);
      if (qMatch) {
        pendingQ = qMatch[1].trim();
        continue;
      }
      if (aMatch && pendingQ) {
        qaLinePairs.push({
          question: pendingQ,
          answer: aMatch[1].trim(),
        });
        pendingQ = null;
      }
    }
    if (qaLinePairs.length) {
      return qaLinePairs.filter(
        (item) => item.question.length >= 4 && item.answer.length >= 4,
      );
    }

    return text
      .split(/\n{2,}/)
      .map((block) => {
        const parts = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        if (parts.length < 2) return null;
        return {
          question: parts[0].replace(/^\d+[\).\-\s]+/, '').slice(0, 300),
          answer: parts.slice(1).join(' ').slice(0, 2000),
        };
      })
      .filter(
        (item): item is { question: string; answer: string } =>
          Boolean(item && item.question.length >= 4 && item.answer.length >= 4),
      );
  }
}
