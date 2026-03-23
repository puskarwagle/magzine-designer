import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const ipcHandlers = new Map();
const mockIpcMain = {
  handle: vi.fn((channel, handler) => {
    ipcHandlers.set(channel, handler);
  }),
};
const mockDialog = {
  showOpenDialog: vi.fn(),
};
const mockApp = {
  getAppPath: vi.fn(() => '/app'),
};
const mockFs = {
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
};

const { registerIpcHandlers } = await import('../ipcHandlers.js');

registerIpcHandlers({
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  app: mockApp,
  fs: mockFs,
  getMainWindow: () => null,
});

describe('main IPC handlers', () => {
  beforeEach(() => {
    mockDialog.showOpenDialog.mockReset();
    mockFs.promises.readdir.mockReset();
    mockFs.promises.readFile.mockReset();
    mockApp.getAppPath.mockReturnValue('/app');
  });

  it('pick-folder returns null and empty images when dialog is canceled', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = ipcHandlers.get('pick-folder');
    const result = await handler();
    expect(result).toEqual({ folderPath: null, images: [] });
  });

  it('pick-folder returns filtered image list with stable ids when folder chosen', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/photos'] });
    mockFs.promises.readdir.mockResolvedValue(['a.jpg', 'b.PNG', 'notes.txt']);

    const handler = ipcHandlers.get('pick-folder');
    const result = await handler();

    expect(mockFs.promises.readdir).toHaveBeenCalledWith('/photos');
    expect(result.folderPath).toBe('/photos');
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toMatchObject({
      id: 'img-0',
      fileName: 'a.jpg',
      path: path.join('/photos', 'a.jpg'),
    });
    expect(result.images[1].id).toBe('img-1');
  });

  it('get-layout-presets reads presets.json and returns array when valid', async () => {
    const data = JSON.stringify([{ id: 'P1', imageCount: 1, slots: [] }]);
    mockFs.promises.readFile.mockResolvedValue(data);
    mockApp.getAppPath.mockReturnValue('/app-root');

    const handler = ipcHandlers.get('get-layout-presets');
    const result = await handler();

    expect(mockFs.promises.readFile).toHaveBeenCalledWith('/app-root/presets.json', 'utf8');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe('P1');
  });

  it('get-layout-presets returns null for missing file, invalid JSON, or non-array', async () => {
    const handler = ipcHandlers.get('get-layout-presets');

    mockFs.promises.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    let result = await handler();
    expect(result).toBeNull();

    mockFs.promises.readFile.mockResolvedValueOnce('not json');
    result = await handler();
    expect(result).toBeNull();

    mockFs.promises.readFile.mockResolvedValueOnce(JSON.stringify({ foo: 'bar' }));
    result = await handler();
    expect(result).toBeNull();
  });

  it('load-sample-folder returns images from sample-images directory', async () => {
    mockFs.promises.readdir.mockResolvedValue(['x.jpeg', 'y.png', 'z.txt']);
    mockApp.getAppPath.mockReturnValue('/app-root');

    const handler = ipcHandlers.get('load-sample-folder');
    const result = await handler();

    expect(mockFs.promises.readdir).toHaveBeenCalledWith('/app-root/sample-images');
    expect(result.folderPath).toBe('/app-root/sample-images');
    expect(result.images).toHaveLength(2);
    expect(result.images[0].id).toBe('img-0');
  });

  it('load-sample-folder returns null folderPath and empty images on error', async () => {
    mockFs.promises.readdir.mockRejectedValueOnce(new Error('fail'));
    const handler = ipcHandlers.get('load-sample-folder');
    const result = await handler();
    expect(result).toEqual({ folderPath: null, images: [] });
  });
});
