import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  decryptSecret,
  encryptSecret,
  parseCredentialsKey,
} from '../payments/credentials-cipher';
import type { IntegrationCredentials } from './commerce-platform.types';

@Injectable()
export class CommerceCredentialsService {
  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return Boolean(this.key(false));
  }

  seal(credentials: IntegrationCredentials): string {
    return `enc:${encryptSecret(this.requireKey(), JSON.stringify(credentials))}`;
  }

  open(payload: string): IntegrationCredentials {
    if (!payload.startsWith('enc:')) {
      throw new ServiceUnavailableException(
        'Las credenciales de la integración no están disponibles.',
      );
    }
    try {
      const parsed = JSON.parse(
        decryptSecret(this.requireKey(), payload.slice(4)),
      ) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid');
      }
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value ?? ''),
        ]),
      );
    } catch {
      throw new ServiceUnavailableException(
        'No pudimos recuperar las credenciales de la integración.',
      );
    }
  }

  private key(required: boolean): Buffer | null {
    const key = parseCredentialsKey(
      this.config.get<string>('INTEGRATION_CREDENTIALS_KEY'),
    );
    if (!key && required) {
      throw new ServiceUnavailableException(
        'Las integraciones de comercio no están disponibles. Contacta con soporte.',
      );
    }
    return key;
  }

  private requireKey(): Buffer {
    const key = this.key(true);
    if (!key) {
      throw new ServiceUnavailableException(
        'Las integraciones de comercio no están disponibles. Contacta con soporte.',
      );
    }
    return key;
  }
}
