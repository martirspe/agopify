import { isManualPublicApiReady, isMetaPublicApiReady } from './whatsapp-public-api';

describe('whatsapp public API readiness', () => {
  it('accepts HTTPS for both Meta and customer-owned modes', () => {
    expect(isMetaPublicApiReady('https://app.example.pe/api/v1')).toBe(true);
    expect(isManualPublicApiReady('https://app.example.pe/api/v1', 'production')).toBe(true);
  });

  it('rejects plain HTTP in production for customer-owned credentials', () => {
    expect(isManualPublicApiReady('http://localhost:3100/api/v1', 'production')).toBe(false);
    expect(isMetaPublicApiReady('http://localhost:3100/api/v1')).toBe(false);
  });

  it('allows localhost HTTP for customer-owned credentials outside production', () => {
    expect(isManualPublicApiReady('http://localhost:3100/api/v1', 'development')).toBe(true);
    expect(isManualPublicApiReady('http://127.0.0.1:3100/api/v1', 'test')).toBe(true);
    expect(isMetaPublicApiReady('http://localhost:3100/api/v1')).toBe(false);
  });
});
