import { writable } from 'svelte/store';

export const currentMenuStore = writable('size');
export const uiSettingsStore = writable({
  menuPosition: 'left',
  menuCollapsed: false
});

// Preview Zoom & Fitting Stores
export const zoomStore = writable(1.0);
export const isAutoFitStore = writable(true); // Default to true
export const autoFitScaleStore = writable(1.0);
