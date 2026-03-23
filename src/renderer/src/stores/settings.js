import { writable } from 'svelte/store';
import { DEFAULT_DPI, PAPER_THICKNESS_MM } from '../lib/utils.js';

export const albumSettingsStore = writable({
  unit: 'in',
  dpi: DEFAULT_DPI,
  pageWidth: 18,
  pageHeight: 12,
  presetId: '18x12',
  bindingType: 'lay-flat', // 'lay-flat' or 'standard'
  globalMargins: {
    top: 0.5,
    bottom: 0.5,
    inner: 0.5,
    outer: 0.5
  },
  includeCover: true,
  paperThickness: PAPER_THICKNESS_MM
});
