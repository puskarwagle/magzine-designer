import { describe, it, expect, vi, beforeEach } from 'vitest';

// Load layoutEngine first so window.LayoutEngine exists (same order as index.html).
import '../src/lib/layoutEngine.js';
import '../src/main.js';

const api = () => window.__rendererTestAPI;
const getFn = name => api()[name];

describe('renderer.js - unit/size math', () => {
  it('toPixels converts inches and centimeters correctly', () => {
    const toPixels = getFn('toPixels');
    const dpi = 100;
    expect(toPixels(2, 'in', dpi)).toBeCloseTo(200);
    const cmVal = 2.54; // 1 inch
    expect(toPixels(cmVal, 'cm', dpi)).toBeCloseTo(100);
  });

  it('fromUnitToUnit round-trips between inches and centimeters', () => {
    const fromUnitToUnit = getFn('fromUnitToUnit');
    const inches = 10;
    const cm = fromUnitToUnit(inches, 'in', 'cm');
    const back = fromUnitToUnit(cm, 'cm', 'in');
    expect(back).toBeCloseTo(inches);
  });

  it('getAlbumSize doubles width for spreads and returns correct pixels', () => {
    const getAlbumSize = getFn('getAlbumSize');
    const settings = {
      unit: 'in',
      dpi: 100,
      pageWidth: 10,
      pageHeight: 5,
    };
    const spread = getAlbumSize(settings, true);
    expect(spread.widthPhysical).toBe(20);
    expect(spread.heightPhysical).toBe(5);
    expect(spread.widthPx).toBe(2000);
    expect(spread.heightPx).toBe(500);

    const single = getAlbumSize(settings, false);
    expect(single.widthPhysical).toBe(10);
    expect(single.widthPx).toBe(1000);
  });
});

describe('renderer.js - state helpers & lock management', () => {
  it('getPageKey returns correct key for single vs spread mode', () => {
    const state = api().state;
    const getPageKey = getFn('getPageKey');

    state.currentSpreadIndex = 1;
    state.layoutMode = 'single';
    state.activePage = 'left';
    expect(getPageKey()).toBe('1-left');

    state.activePage = 'right';
    expect(getPageKey()).toBe('1-right');

    state.layoutMode = 'spread';
    expect(getPageKey()).toBe('1-spread');
  });

  it('getLockedSlots creates and returns a Set per page key', () => {
    const getLockedSlots = getFn('getLockedSlots');
    const getPageKey = getFn('getPageKey');
    const state = api().state;

    state.currentSpreadIndex = 0;
    state.layoutMode = 'single';
    state.activePage = 'left';

    const first = getLockedSlots();
    expect(first).toBeInstanceOf(Set);
    first.add(1);

    const key = getPageKey();
    expect(state.lockedSlots.get(key)).toBe(first);

    state.activePage = 'right';
    const second = getLockedSlots();
    expect(second).toBeInstanceOf(Set);
    expect(second).not.toBe(first);
  });

  it('toggleSlotLock adds/removes indices from lock set', () => {
    const toggleSlotLock = getFn('toggleSlotLock');
    const getLockedSlots = getFn('getLockedSlots');
    const state = api().state;

    state.currentSpreadIndex = 0;
    state.layoutMode = 'single';
    state.activePage = 'left';

    const locked = getLockedSlots();
    expect(locked.has(2)).toBe(false);
    toggleSlotLock(2);
    expect(locked.has(2)).toBe(true);
    toggleSlotLock(2);
    expect(locked.has(2)).toBe(false);
  });
});

describe('renderer.js - undo integration', () => {
  beforeEach(() => {
    // Reset minimal state.spreads and undo stack before each test
    const state = api().state;
    state.spreads = [
      {
        id: 1,
        leftPage: { imageIds: ['a'], currentPresetIndex: 0 },
        rightPage: { imageIds: [], currentPresetIndex: 0 },
        spreadPage: { imageIds: [], currentPresetIndex: 0 },
        useCustomMargins: false,
        margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
      },
    ];
    state.currentSpreadIndex = 0;
    state.layoutMode = 'single';
    state.activePage = 'left';

    // Reset undo stack
    window.LayoutEngine.layoutUndoStack.clear();
  });

  it('saveLayoutStateForUndo pushes deep copies to layoutUndoStack', () => {
    const saveLayoutStateForUndo = getFn('saveLayoutStateForUndo');
    const state = api().state;
    const stack = window.LayoutEngine.layoutUndoStack;

    expect(stack.canUndo()).toBe(false);
    saveLayoutStateForUndo();
    expect(stack.canUndo()).toBe(true);

    // Mutate state and ensure stored snapshot does not change
    const beforeUndoTop = stack.stack[stack.stack.length - 1];
    state.spreads[0].leftPage.imageIds.push('b');
    expect(beforeUndoTop.leftPage.imageIds).toEqual(['a']);
  });

  it('handleUndo/handleRedo update current spread pages according to stack', () => {
    const saveLayoutStateForUndo = getFn('saveLayoutStateForUndo');
    const handleUndo = getFn('handleUndo');
    const handleRedo = getFn('handleRedo');
    const state = api().state;
    const stack = window.LayoutEngine.layoutUndoStack;

    // initial snapshot
    saveLayoutStateForUndo();

    // change layout
    state.spreads[0].leftPage.imageIds.push('b');
    saveLayoutStateForUndo();
    state.spreads[0].leftPage.imageIds.push('c');

    expect(state.spreads[0].leftPage.imageIds).toEqual(['a', 'b', 'c']);
    expect(stack.canUndo()).toBe(true);

    handleUndo();
    expect(state.spreads[0].leftPage.imageIds).toEqual(['a', 'b']);

    handleRedo();
    expect(state.spreads[0].leftPage.imageIds).toEqual(['a', 'b', 'c']);
  });
});

describe('renderer.js - layout control behavior', () => {
  beforeEach(() => {
    const state = api().state;
    state.project.images = [
      { id: 'a', fileName: 'a.jpg', path: '/a.jpg' },
      { id: 'b', fileName: 'b.jpg', path: '/b.jpg' },
    ];
    state.spreads = [
      {
        id: 1,
        leftPage: { imageIds: ['a', 'b'], currentPresetIndex: 0 },
        rightPage: { imageIds: [], currentPresetIndex: 0 },
        spreadPage: { imageIds: [], currentPresetIndex: 0 },
        useCustomMargins: false,
        margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
      },
    ];
    state.currentSpreadIndex = 0;
    state.layoutMode = 'single';
    state.activePage = 'left';
    state.lockedSlots.clear();

    // stub renderPreview and updateLayoutInfo to avoid DOM requirements
    globalThis.renderPreview = vi.fn();
    globalThis.updateLayoutInfo = vi.fn();
  });

  it('handleNextLayout does nothing when imageIds is empty', () => {
    const handleNextLayout = getFn('handleNextLayout');
    const state = api().state;
    state.spreads[0].leftPage.imageIds = [];
    const originalIndex = state.spreads[0].leftPage.currentPresetIndex;
    handleNextLayout();
    expect(state.spreads[0].leftPage.currentPresetIndex).toBe(originalIndex);
  });

  it('handleNextLayout increments preset index modulo preset count and resets mirror fields', () => {
    const handleNextLayout = getFn('handleNextLayout');
    const state = api().state;
    const page = state.spreads[0].leftPage;
    page.currentPresetIndex = 0;
    page.isMirrored = true;
    page.mirroredPreset = { id: 'X' };

    const presets = window.LayoutEngine.getPresetsForCount(page.imageIds.length);
    handleNextLayout();
    // handleNextLayout replaces the page object on the spread, so read from state again
    const updatedPage = state.spreads[0].leftPage;
    expect(updatedPage.currentPresetIndex).toBe(1 % presets.length);
    expect(updatedPage.isMirrored).toBe(false);
    expect(updatedPage.mirroredPreset).toBeNull();
  });

  it('handleMirrorLayout toggles isMirrored and mirroredPreset using LayoutEngine.mirrorPreset', () => {
    const handleMirrorLayout = getFn('handleMirrorLayout');
    const state = api().state;
    const page = state.spreads[0].leftPage;

    handleMirrorLayout();
    expect(page.isMirrored).toBe(true);
    expect(page.mirroredPreset).toBeTruthy();

    const firstId = page.mirroredPreset.id;
    handleMirrorLayout();
    expect(page.isMirrored).toBe(false);
    expect(page.mirroredPreset).toBeNull();
  });

  it('handleShuffleImages does nothing with fewer than 2 images', () => {
    const handleShuffleImages = getFn('handleShuffleImages');
    const state = api().state;
    state.spreads[0].leftPage.imageIds = ['a'];
    handleShuffleImages();
    expect(state.spreads[0].leftPage.imageIds).toEqual(['a']);
  });

  it('handleShuffleImages shuffles unlocked images and respects locked indices', () => {
    const handleShuffleImages = getFn('handleShuffleImages');
    const getLockedSlots = getFn('getLockedSlots');
    const state = api().state;
    const page = state.spreads[0].leftPage;
    page.imageIds = ['a', 'b', 'c'];

    state.activePage = 'left';
    const locked = getLockedSlots();
    locked.add(1);

    handleShuffleImages();

    // Locked slot (index 1) must still contain 'b'
    expect(page.imageIds[1]).toBe('b');
    // Result must be a permutation of the same ids
    expect(page.imageIds).toHaveLength(3);
    expect([...page.imageIds].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('renderer.js - layout info computation', () => {
  beforeEach(() => {
    const existing = document.getElementById('layout-info');
    if (existing) existing.remove();
    const el = document.createElement('span');
    el.id = 'layout-info';
    document.body.appendChild(el);

    const state = api().state;
    state.project.images = [
      { id: 'a', fileName: 'a.jpg', path: '/a.jpg' },
      { id: 'b', fileName: 'b.jpg', path: '/b.jpg' },
    ];
    state.spreads = [
      {
        id: 1,
        leftPage: { imageIds: ['a', 'b'], currentPresetIndex: 0 },
        rightPage: { imageIds: [], currentPresetIndex: 0 },
        spreadPage: { imageIds: [], currentPresetIndex: 0 },
        useCustomMargins: false,
        margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
      },
    ];
    state.currentSpreadIndex = 0;
    state.activePage = 'left';

    // ensure metadata map is empty to use default dimensions
    state.imageMetadata.clear();
  });

  it('updateLayoutInfo writes preset ID, mirror indicator, score, and index/total', () => {
    const updateLayoutInfo = getFn('updateLayoutInfo');
    const state = api().state;
    const infoEl = document.getElementById('layout-info');
    state.currentSpreadIndex = 0;
    state.activePage = 'left';

    updateLayoutInfo();
    const text = infoEl.textContent;

    expect(text).toMatch(/P\d/);
    expect(text).toMatch(/\(\d+\/\d+ match\)/);
    expect(text).toMatch(/\(\d+\/\d+\)$/);

    state.spreads[0].leftPage.isMirrored = true;
    state.spreads[0].leftPage.mirroredPreset = window.LayoutEngine.mirrorPreset(
      window.LayoutEngine.getPresetsForCount(2)[0],
    );
    updateLayoutInfo();
    expect(infoEl.textContent).toMatch(/\[M\]/);
  });
});

