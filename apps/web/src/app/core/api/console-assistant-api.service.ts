import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthApiService } from '../auth/auth-api.service';
import type {
  AssistantConversation,
  AssistantPanelMessage,
} from '../../features/get-started/assistant-types';

export type ConsoleAssistantState = {
  memoryEnabled: boolean;
  conversations: AssistantConversation[];
};

type JwtIdentity = { userId: string; tenantId: string };

const LEGACY_MEMORY_KEY = 'agopify.assistant.memory';
const LEGACY_CONVERSATIONS_KEY = 'agopify.assistant.conversations';
const MAX_CONVERSATIONS = 40;
const UPSERT_DEBOUNCE_MS = 450;

/**
 * Server-backed console assistant memory + chat history (per staff member × tenant).
 * Keeps a device cache for instant paint; the API is the source of truth across browsers.
 */
@Injectable({ providedIn: 'root' })
export class ConsoleAssistantApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthApiService);
  private readonly base = `${environment.apiBaseUrl}/console-assistant`;

  readonly memoryEnabled = signal(true);
  readonly conversations = signal<AssistantConversation[]>([]);
  readonly ready = signal(false);

  private loadPromise: Promise<void> | null = null;
  private upsertTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private identityKey: string | null = null;

  /** Load (or reuse) the signed-in user's assistant state. Safe to call often. */
  ensureLoaded(): Promise<void> {
    const identity = this.readIdentity();
    if (!identity) {
      this.ready.set(false);
      return Promise.resolve();
    }
    const key = `${identity.userId}:${identity.tenantId}`;
    if (this.identityKey !== key) {
      this.identityKey = key;
      this.loadPromise = null;
      this.ready.set(false);
      this.hydrateFromCache(identity);
    }
    this.loadPromise ??= this.refresh(identity);
    return this.loadPromise;
  }

  async setMemoryEnabled(enabled: boolean): Promise<void> {
    this.memoryEnabled.set(enabled);
    this.writeCache();
    try {
      const res = await firstValueFrom(
        this.http.patch<{ memoryEnabled: boolean }>(`${this.base}/preferences`, {
          memoryEnabled: enabled,
        }),
      );
      this.memoryEnabled.set(res.memoryEnabled);
      this.writeCache();
    } catch {
      /* keep optimistic value; next refresh reconciles */
    }
  }

  /** Optimistic list replace + persist each changed conversation. */
  replaceConversations(items: AssistantConversation[]): void {
    const trimmed = items.slice(0, MAX_CONVERSATIONS);
    this.conversations.set(trimmed);
    this.writeCache();
  }

  scheduleUpsert(conversation: AssistantConversation): void {
    const list = this.conversations().filter((c) => c.id !== conversation.id);
    list.unshift(conversation);
    this.replaceConversations(list);

    const prev = this.upsertTimers.get(conversation.id);
    if (prev) clearTimeout(prev);
    this.upsertTimers.set(
      conversation.id,
      setTimeout(() => {
        this.upsertTimers.delete(conversation.id);
        void this.persistConversation(conversation);
      }, UPSERT_DEBOUNCE_MS),
    );
  }

  async renameConversation(id: string, title: string): Promise<void> {
    const nextTitle = title.trim().slice(0, 72) || 'Nueva conversación';
    const next = this.conversations().map((c) =>
      c.id === id ? { ...c, title: nextTitle, updatedAt: Date.now() } : c,
    );
    this.replaceConversations(next);
    try {
      await firstValueFrom(
        this.http.patch<AssistantConversation>(`${this.base}/conversations/${encodeURIComponent(id)}`, {
          title: nextTitle,
        }),
      );
    } catch {
      /* optimistic */
    }
  }

  async deleteConversation(id: string): Promise<void> {
    const timer = this.upsertTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.upsertTimers.delete(id);
    }
    this.replaceConversations(this.conversations().filter((c) => c.id !== id));
    try {
      await firstValueFrom(
        this.http.delete<void>(`${this.base}/conversations/${encodeURIComponent(id)}`),
      );
    } catch {
      /* optimistic */
    }
  }

  clearLocal(): void {
    for (const timer of this.upsertTimers.values()) clearTimeout(timer);
    this.upsertTimers.clear();
    this.loadPromise = null;
    this.identityKey = null;
    this.memoryEnabled.set(true);
    this.conversations.set([]);
    this.ready.set(false);
  }

  private async refresh(identity: JwtIdentity): Promise<void> {
    try {
      let state = await firstValueFrom(this.http.get<ConsoleAssistantState>(this.base));
      if (!state.conversations.length) {
        const legacy = readLegacyConversations();
        if (legacy.length) {
          state = await firstValueFrom(
            this.http.post<ConsoleAssistantState>(`${this.base}/conversations/import`, {
              conversations: legacy.map((c) => ({
                id: c.id,
                title: c.title,
                updatedAt: c.updatedAt,
                messages: c.messages.map(stripMessage),
              })),
            }),
          );
          clearLegacyStorage();
        } else {
          const legacyMemory = readLegacyMemory();
          if (legacyMemory !== null && legacyMemory !== state.memoryEnabled) {
            await this.setMemoryEnabled(legacyMemory);
            clearLegacyStorage();
            state = { ...state, memoryEnabled: legacyMemory };
          }
        }
      } else {
        clearLegacyStorage();
      }

      this.memoryEnabled.set(state.memoryEnabled);
      this.conversations.set(normalizeConversations(state.conversations));
      this.writeCache(identity);
      this.ready.set(true);
    } catch {
      this.ready.set(true);
    } finally {
      this.loadPromise = null;
    }
  }

  private async persistConversation(conversation: AssistantConversation): Promise<void> {
    try {
      const saved = await firstValueFrom(
        this.http.put<AssistantConversation>(
          `${this.base}/conversations/${encodeURIComponent(conversation.id)}`,
          {
            title: conversation.title,
            messages: conversation.messages.map(stripMessage),
          },
        ),
      );
      const list = this.conversations().map((c) =>
        c.id === saved.id
          ? {
              ...c,
              title: saved.title,
              updatedAt: saved.updatedAt,
              messages: normalizeMessages(saved.messages),
            }
          : c,
      );
      this.replaceConversations(list);
    } catch {
      /* keep local optimistic copy */
    }
  }

  private hydrateFromCache(identity: JwtIdentity): void {
    try {
      const raw = localStorage.getItem(cacheKey(identity));
      if (!raw) return;
      const parsed = JSON.parse(raw) as ConsoleAssistantState;
      if (typeof parsed.memoryEnabled === 'boolean') this.memoryEnabled.set(parsed.memoryEnabled);
      if (Array.isArray(parsed.conversations)) {
        this.conversations.set(normalizeConversations(parsed.conversations));
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  private writeCache(identity = this.readIdentity()): void {
    if (!identity || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        cacheKey(identity),
        JSON.stringify({
          memoryEnabled: this.memoryEnabled(),
          conversations: this.conversations(),
        } satisfies ConsoleAssistantState),
      );
    } catch {
      /* private mode / quota */
    }
  }

  private readIdentity(): JwtIdentity | null {
    const token = this.auth.getAccessToken();
    const payload = token?.split('.')[1];
    if (!payload) return null;
    try {
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
        sub?: string;
        tenantId?: string;
      };
      if (!json.sub || !json.tenantId) return null;
      return { userId: json.sub, tenantId: json.tenantId };
    } catch {
      return null;
    }
  }
}

function cacheKey(identity: JwtIdentity): string {
  return `agopify.assistant.v1:${identity.userId}:${identity.tenantId}`;
}

function stripMessage(message: AssistantPanelMessage): {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  bullets?: string[];
} {
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    ...(message.status ? { status: message.status } : {}),
    ...(message.bullets?.length ? { bullets: [...message.bullets] } : {}),
  };
}

function normalizeConversations(items: AssistantConversation[]): AssistantConversation[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages))
    .map((c) => ({
      id: c.id,
      title: typeof c.title === 'string' ? c.title : 'Nueva conversación',
      updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      messages: normalizeMessages(c.messages),
    }))
    .slice(0, MAX_CONVERSATIONS);
}

function normalizeMessages(messages: AssistantPanelMessage[]): AssistantPanelMessage[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    ...(m.status ? { status: m.status } : {}),
    ...(m.bullets?.length ? { bullets: [...m.bullets] } : {}),
  }));
}

function readLegacyConversations(): AssistantConversation[] {
  try {
    const raw = localStorage.getItem(LEGACY_CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssistantConversation[];
    return normalizeConversations(parsed).filter((c) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/.test(c.id));
  } catch {
    return [];
  }
}

function readLegacyMemory(): boolean | null {
  try {
    const raw = localStorage.getItem(LEGACY_MEMORY_KEY);
    if (raw === null) return null;
    return raw === '1' || raw === 'true';
  } catch {
    return null;
  }
}

function clearLegacyStorage(): void {
  try {
    localStorage.removeItem(LEGACY_MEMORY_KEY);
    localStorage.removeItem(LEGACY_CONVERSATIONS_KEY);
  } catch {
    /* ignore */
  }
}
