import { writable } from 'svelte/store';
import { LayoutEngine } from '../lib/layoutEngine.js';

export const projectStore = writable({
  folderPath: null,
  images: [
    { id: '1', path: 'https://picsum.photos/800/600?1', width: 800, height: 600, source: 'Picsum Cloud' },
    { id: '2', path: 'https://picsum.photos/600/800?2', width: 600, height: 800, source: 'Picsum Cloud' },
    { id: '3', path: 'https://picsum.photos/800/800?3', width: 800, height: 800, source: 'Picsum Cloud' },
    { id: '4', path: 'https://picsum.photos/1200/800?4', width: 1200, height: 800, source: 'Picsum Cloud' },
    { id: '5', path: 'https://picsum.photos/800/1200?5', width: 800, height: 1200, source: 'Picsum Cloud' },
  ]
});

export const addImagesToProject = (newFolderData) => {
  if (newFolderData.folderPath) {
    localStorage.setItem('lastFolderPath', newFolderData.folderPath);
  }

  projectStore.update(state => {
    // Tag new images with their folder name
    const folderName = newFolderData.folderPath.split(/[/\\]/).pop();
    const taggedImages = newFolderData.images.map(img => ({
      ...img,
      source: folderName
    }));

    // Filter out duplicates based on path if necessary, or just append
    const existingPaths = new Set(state.images.map(img => img.path));
    const uniqueNewImages = taggedImages.filter(img => !existingPaths.has(img.path));

    return {
      ...state,
      folderPath: newFolderData.folderPath,
      images: [...state.images, ...uniqueNewImages]
    };
  });
};

export const presetsStore = writable([]);

export async function initProject() {
  // Load saved folder
  const savedPath = localStorage.getItem('lastFolderPath');
  if (savedPath && window.api && window.api.getImagesInFolder) {
    const result = await window.api.getImagesInFolder(savedPath);
    if (result && result.folderPath) {
      addImagesToProject(result);
    }
  }

  // Load presets
  if (window.api && window.api.getLayoutPresets) {
    const presets = await window.api.getLayoutPresets();
    if (presets) {
      presetsStore.set(presets);
      LayoutEngine.loadPresetsFromData(presets);
    }
  }
}

// Keep initPresets for compatibility but prefer initProject
export const initPresets = initProject;
