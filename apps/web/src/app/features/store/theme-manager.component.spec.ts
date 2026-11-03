import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { latestThemes } from '@agopify/themes/catalog';
import { ThemeManagerComponent } from './theme-manager.component';
import { StoreApiService, type StoreThemeCatalog } from '../../core/api/store-api.service';

const themes = latestThemes();
const classic = themes.find(theme => theme.slug === 'classic')!;
const rosaline = themes.find(theme => theme.slug === 'rosaline')!;

const catalog: StoreThemeCatalog = {
  savedAt: '2026-10-08T12:00:00Z',
  status: {
    active: { template: 'classic', version: classic.version },
    editing: { template: 'rosaline', version: rosaline.version },
    activeCompatibility: { status: 'compatible', issues: [] },
    compatibility: { status: 'compatible', issues: [] },
    update: null,
  },
  themes: [classic, rosaline],
};

async function setup() {
  const publishDraft = vi.fn(async () => ({
    template: 'rosaline',
    themeVersion: rosaline.version,
    content: { version: 1, sections: {} },
    hasUnpublishedChanges: false,
    scheduledAt: null,
    savedAt: '2026-10-08T12:01:00Z',
  }));
  const themesApi = vi.fn()
    .mockResolvedValueOnce(catalog)
    .mockResolvedValue({
      ...catalog,
      status: {
        ...catalog.status,
        active: { template: 'rosaline', version: rosaline.version },
        editing: { template: 'rosaline', version: rosaline.version },
      },
      savedAt: '2026-10-08T12:01:00Z',
    });
  TestBed.configureTestingModule({
    imports: [ThemeManagerComponent],
    providers: [
      provideRouter([]),
      { provide: StoreApiService, useValue: { themes: themesApi, publishDraft, stageTheme: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(ThemeManagerComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
  fixture.detectChanges();
  return { page: fixture.componentInstance, fixture, publishDraft };
}

afterEach(() => TestBed.resetTestingModule());

describe('theme manager publish', () => {
  it('publishes a staged theme draft to the live storefront', async () => {
    const { page, publishDraft, fixture } = await setup();
    expect(page.pending()).toBe(true);
    expect(page.canPublish()).toBe(true);
    await page.publish();
    expect(publishDraft).toHaveBeenCalledWith('2026-10-08T12:00:00Z');
    expect(page.pending()).toBe(false);
    expect(page.notice()).toContain('Diseño publicado');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Rosaline');
  });
});
