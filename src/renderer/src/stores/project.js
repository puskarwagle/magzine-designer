import { writable } from 'svelte/store';
import { LayoutEngine } from '../lib/layoutEngine.js';

export const projectStore = writable({
  folderPath: '/mock/photos',
  images: [
    { id: '1', path: 'https://picsum.photos/800/600?1', width: 800, height: 600 },
    { id: '2', path: 'https://picsum.photos/600/800?2', width: 600, height: 800 },
    { id: '3', path: 'https://picsum.photos/800/800?3', width: 800, height: 800 },
    { id: '4', path: 'https://picsum.photos/1200/800?4', width: 1200, height: 800 },
    { id: '5', path: 'https://picsum.photos/800/1200?5', width: 800, height: 1200 },
  ]
});

export const presetsStore = writable([]);

export async function initPresets() {
  if (window.api && window.api.getLayoutPresets) {
    const presets = await window.api.getLayoutPresets();
    if (presets) {
      presetsStore.set(presets);
      LayoutEngine.loadPresetsFromData(presets);
    }
  }
}
