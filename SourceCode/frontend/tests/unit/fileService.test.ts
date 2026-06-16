import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileService } from '../../src/services/fileService';

describe('FileService (browser mode)', () => {
  beforeEach(() => {
    localStorage.clear();
    // @ts-expect-error - clearing electronAPI for browser mode tests
    window.electronAPI = undefined;
  });

  it('returns empty recent files by default', () => {
    const service = createFileService();
    expect(service.getRecentFiles()).toEqual([]);
  });

  it('remembers saved file names', async () => {
    const service = createFileService();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob://x'),
      revokeObjectURL: vi.fn(),
    });

    await service.saveSld('style.sld', '<xml/>');

    expect(service.getRecentFiles()).toContain('style.sld');
    createElementSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('FileService (electron mode)', () => {
  const mockOpenAndRead = vi.fn();
  const mockSaveAndWrite = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // @ts-expect-error - mocking electronAPI for electron mode tests
    window.electronAPI = {
      openAndRead: mockOpenAndRead,
      saveAndWrite: mockSaveAndWrite,
    };
  });

  it('openGeoJson uses electron dialog and returns file content', async () => {
    mockOpenAndRead.mockResolvedValue({
      path: '/data/map.geojson',
      content: '{"type":"FeatureCollection"}',
    });

    const service = createFileService();
    const result = await service.openGeoJson();

    expect(mockOpenAndRead).toHaveBeenCalledWith({
      title: 'Open GeoJSON',
      filters: [{ name: 'GeoJSON', extensions: ['geojson', 'json'] }],
    });
    expect(result).toEqual({
      path: '/data/map.geojson',
      content: '{"type":"FeatureCollection"}',
    });
    expect(service.getRecentFiles()).toContain('/data/map.geojson');
  });

  it('openGeoJson returns undefined when canceled', async () => {
    mockOpenAndRead.mockResolvedValue(undefined);

    const service = createFileService();
    const result = await service.openGeoJson();

    expect(result).toBeUndefined();
  });

  it('openSld uses electron dialog with SLD filters', async () => {
    mockOpenAndRead.mockResolvedValue({
      path: '/data/style.sld',
      content: '<sld/>',
    });

    const service = createFileService();
    const result = await service.openSld();

    expect(mockOpenAndRead).toHaveBeenCalledWith({
      title: 'Open SLD',
      filters: [{ name: 'SLD', extensions: ['sld', 'xml'] }],
    });
    expect(result).toEqual({ path: '/data/style.sld', content: '<sld/>' });
  });

  it('saveSld uses electron dialog and returns saved path', async () => {
    mockSaveAndWrite.mockResolvedValue('/output/style.sld');

    const service = createFileService();
    const result = await service.saveSld('style.sld', '<sld/>');

    expect(mockSaveAndWrite).toHaveBeenCalledWith(
      {
        title: 'Save SLD',
        defaultPath: 'style.sld',
        filters: [{ name: 'SLD', extensions: ['sld', 'xml'] }],
      },
      '<sld/>',
    );
    expect(result).toBe('/output/style.sld');
    expect(service.getRecentFiles()).toContain('/output/style.sld');
  });

  it('saveSld returns undefined when canceled', async () => {
    mockSaveAndWrite.mockResolvedValue(undefined);

    const service = createFileService();
    const result = await service.saveSld('style.sld', '<sld/>');

    expect(result).toBeUndefined();
  });
});
