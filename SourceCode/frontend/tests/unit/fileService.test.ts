import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFileService } from '../../src/services/fileService';

describe('FileService', () => {
  beforeEach(() => {
    localStorage.clear();
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
