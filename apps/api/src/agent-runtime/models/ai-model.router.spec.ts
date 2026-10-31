import { ConfigService } from '@nestjs/config';
import { AiModelRouter } from './ai-model.router';
import type { AiModelProvider } from './ai-model.provider';
import type { AiGenerateRequest, AiGenerateResult } from './ai-model.types';

function provider(
  id: string,
  generate: AiModelProvider['generate'],
): AiModelProvider {
  return {
    id,
    getCapabilities: () => ({
      provider: id,
      chat: true,
      structuredJson: true,
      tools: true,
      streaming: false,
    }),
    generate,
  };
}

describe('AiModelRouter', () => {
  const ok = (name: string): AiGenerateResult => ({
    provider: name,
    model: 'm',
    message: { role: 'assistant', content: '{"ok":true}' },
  });

  it('uses the configured primary provider', async () => {
    const primary = provider('openai', jest.fn(async () => ok('openai')));
    const router = new AiModelRouter(
      {
        get: (key: string, fallback?: string) =>
          key === 'SALES_MODEL_PROVIDER' ? 'openai' : fallback,
      } as ConfigService,
      [primary],
    );
    const request: AiGenerateRequest = {
      task: 'sales_reply',
      messages: [{ role: 'user', content: 'hola' }],
    };
    await expect(router.generate(request)).resolves.toMatchObject({
      provider: 'openai',
    });
    expect(primary.generate).toHaveBeenCalledWith(request);
  });

  it('falls back when the primary throws and a fallback is configured', async () => {
    const primary = provider('openai', jest.fn(async () => {
      throw new Error('down');
    }));
    const backup = provider('backup', jest.fn(async () => ok('backup')));
    const router = new AiModelRouter(
      {
        get: (key: string, fallback?: string) => {
          if (key === 'SALES_MODEL_PROVIDER') return 'openai';
          if (key === 'SALES_MODEL_FALLBACK_PROVIDER') return 'backup';
          return fallback;
        },
      } as ConfigService,
      [primary, backup],
    );
    await expect(
      router.generate({
        task: 'structured_json',
        messages: [{ role: 'user', content: '{}' }],
      }),
    ).resolves.toMatchObject({ provider: 'backup', degraded: true });
    expect(primary.generate).toHaveBeenCalledTimes(1);
    expect(backup.generate).toHaveBeenCalledTimes(1);
  });

  it('L: skips incompatible fallback and degrades without a second attempt', async () => {
    const primary = provider('openai', jest.fn(async () => {
      throw new Error('down');
    }));
    const backup: AiModelProvider = {
      id: 'backup',
      getCapabilities: () => ({
        provider: 'backup',
        chat: true,
        structuredJson: false,
        tools: false,
        streaming: false,
      }),
      generate: jest.fn(async () => ok('backup')),
    };
    const router = new AiModelRouter(
      {
        get: (key: string, fallback?: string) => {
          if (key === 'SALES_MODEL_PROVIDER') return 'openai';
          if (key === 'SALES_MODEL_FALLBACK_PROVIDER') return 'backup';
          return fallback;
        },
      } as ConfigService,
      [primary, backup],
    );
    await expect(
      router.generate({
        task: 'structured_json',
        jsonObject: true,
        messages: [{ role: 'user', content: '{}' }],
      }),
    ).resolves.toBeNull();
    expect(backup.generate).not.toHaveBeenCalled();
  });
});
