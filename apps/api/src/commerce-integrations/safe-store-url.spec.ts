import { BadRequestException } from '@nestjs/common';
import { assertSafeStoreBaseUrl } from './safe-store-url';

describe('assertSafeStoreBaseUrl', () => {
  it('rejects non-https URLs', async () => {
    await expect(assertSafeStoreBaseUrl('http://shop.example.com')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects private IPs', async () => {
    await expect(assertSafeStoreBaseUrl('https://127.0.0.1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects credentials in the URL', async () => {
    await expect(
      assertSafeStoreBaseUrl('https://user:pass@shop.example.com'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
