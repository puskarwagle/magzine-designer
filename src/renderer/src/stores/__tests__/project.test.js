import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { projectStore, addImagesToProject, presetsStore, initProject } from '../project.js';
import { LayoutEngine } from '../../lib/layoutEngine.js';

describe('project store', () => {
  beforeEach(() => {
    projectStore.set({
      folderPath: null,
      images: []
    });
    presetsStore.set([]);
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('addImagesToProject adds new images and tags them with folder name', () => {
    const newFolderData = {
      folderPath: '/path/to/my-photos',
      images: [
        { id: 'img1', path: '/path/to/my-photos/1.jpg' },
        { id: 'img2', path: '/path/to/my-photos/2.jpg' }
      ]
    };

    addImagesToProject(newFolderData);

    const state = get(projectStore);
    expect(state.folderPath).toBe('/path/to/my-photos');
    expect(state.images).toHaveLength(2);
    expect(state.images[0].source).toBe('my-photos');
    expect(localStorage.getItem('lastFolderPath')).toBe('/path/to/my-photos');
  });

  it('addImagesToProject avoids duplicate images based on path', () => {
    projectStore.set({
      folderPath: '/old',
      images: [{ id: 'old1', path: '/path/1.jpg', source: 'old' }]
    });

    const newFolderData = {
      folderPath: '/new',
      images: [
        { id: 'new1', path: '/path/1.jpg' }, // duplicate path
        { id: 'new2', path: '/path/2.jpg' }
      ]
    };

    addImagesToProject(newFolderData);

    const state = get(projectStore);
    expect(state.images).toHaveLength(2);
    expect(state.images.map(img => img.path)).toEqual(['/path/1.jpg', '/path/2.jpg']);
  });

  it('initProject loads saved folder and presets', async () => {
    localStorage.setItem('lastFolderPath', '/saved/path');
    
    // Mock window.api
    window.api = {
      getImagesInFolder: vi.fn().mockResolvedValue({
        folderPath: '/saved/path',
        images: [{ id: 'img1', path: '/saved/path/1.jpg' }]
      }),
      getLayoutPresets: vi.fn().mockResolvedValue([
        { id: 'P1', imageCount: 1, slots: [] }
      ])
    };

    const spyLoadPresets = vi.spyOn(LayoutEngine, 'loadPresetsFromData');

    await initProject();

    expect(window.api.getImagesInFolder).toHaveBeenCalledWith('/saved/path');
    expect(window.api.getLayoutPresets).toHaveBeenCalled();
    
    const projectState = get(projectStore);
    expect(projectState.images).toHaveLength(1);
    
    const presetsState = get(presetsStore);
    expect(presetsState).toHaveLength(1);
    expect(spyLoadPresets).toHaveBeenCalled();

    delete window.api;
  });
});
