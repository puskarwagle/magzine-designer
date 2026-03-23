import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const preloadSource = readFileSync(path.join(__dirname, '../preload.js'), 'utf8');

describe('preload.js bridge', () => {
  it('exposes api with pickFolder, loadSampleFolder, and getLayoutPresets', () => {
    expect(preloadSource).toContain("exposeInMainWorld('api'");
    expect(preloadSource).toContain('pickFolder');
    expect(preloadSource).toContain('loadSampleFolder');
    expect(preloadSource).toContain('getLayoutPresets');
  });

  it('api methods invoke the correct IPC channels', () => {
    expect(preloadSource).toContain("invoke('pick-folder')");
    expect(preloadSource).toContain("invoke('load-sample-folder')");
    expect(preloadSource).toContain("invoke('get-layout-presets')");
  });
});
