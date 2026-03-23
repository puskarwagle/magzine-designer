import { describe, it, expect, vi, beforeEach } from 'vitest';

// LayoutEngine is now a standard ESM export.
import { LayoutEngine } from '../src/lib/layoutEngine.js';

const LE = () => LayoutEngine;

describe('LayoutEngine - preset validation & registry', () => {
  it('detects mismatched slot count vs imageCount', () => {
    const badPreset = {
      id: 'BAD-1',
      imageCount: 2,
      slots: [{ x: 0, y: 0, w: 1, h: 1, priority: 1 }],
    };
    const { valid, errors } = LE().validatePreset(badPreset);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('Slot count'))).toBe(true);
  });

  it('flags overlapping slots and duplicate priorities', () => {
    const badPreset = {
      id: 'BAD-2',
      imageCount: 2,
      slots: [
        { x: 0, y: 0, w: 1, h: 1, priority: 1 },
        { x: 0.5, y: 0.5, w: 0.6, h: 0.6, priority: 1 },
      ],
    };
    const { valid, errors } = LE().validatePreset(badPreset);
    expect(valid).toBe(false);
    expect(errors.some(e => e.includes('Duplicate priority'))).toBe(true);
    expect(errors.some(e => e.includes('overlaps'))).toBe(true);
  });

  it('validates all built-in presets without errors', () => {
    const { valid, results } = LE().validateAllPresets();
    expect(results.size).toBeGreaterThan(0);
    expect(valid).toBe(true);
    for (const r of results.values()) {
      expect(r.valid).toBe(true);
      expect(r.errors).toEqual([]);
    }
  });
});

describe('LayoutEngine - geometry & unit math', () => {
  it('computeMarginBox uses inner/outer correctly for left and right pages', () => {
    const margins = { top: 1, bottom: 1, inner: 2, outer: 3 }; // inches
    const pageWidthPx = 1000;
    const pageHeightPx = 800;
    const dpi = 100; // so 1 in = 100px

    const left = LE().computeMarginBox(margins, pageWidthPx, pageHeightPx, 'in', dpi, true);
    const right = LE().computeMarginBox(margins, pageWidthPx, pageHeightPx, 'in', dpi, false);

    // outer margin on the outside edges
    expect(left.left).toBeCloseTo(3 * dpi);
    expect(right.left).toBeCloseTo(2 * dpi);
    expect(left.width + left.left).toBeCloseTo(pageWidthPx - 2 * dpi);
    expect(right.width + right.left).toBeCloseTo(pageWidthPx - 3 * dpi);
  });

  it('computeSpreadMarginBox converts cm to pixels and applies outer margins', () => {
    const margins = { top: 2, bottom: 2, inner: 0, outer: 1 }; // cm
    const dpi = 100;
    const spreadWidthPx = 2000;
    const spreadHeightPx = 1000;

    const box = LE().computeSpreadMarginBox(margins, spreadWidthPx, spreadHeightPx, 'cm', dpi);
    const cmToPx = v => (v / 2.54) * dpi;

    expect(box.left).toBeCloseTo(cmToPx(1));
    expect(box.top).toBeCloseTo(cmToPx(2));
    expect(box.width).toBeCloseTo(spreadWidthPx - 2 * cmToPx(1));
    expect(box.height).toBeCloseTo(spreadHeightPx - cmToPx(2) - cmToPx(2));
  });

  it('generateGenericGrid creates n slots that tile the page', () => {
    const n = 7;
    const preset = LE().generateGenericGrid(n);
    expect(preset.imageCount).toBe(n);
    expect(preset.slots).toHaveLength(n);

    // ensure all slots are within bounds and non-empty
    for (const slot of preset.slots) {
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.x + slot.w).toBeLessThanOrEqual(1.0001);
      expect(slot.y + slot.h).toBeLessThanOrEqual(1.0001);
      expect(slot.w).toBeGreaterThan(0);
      expect(slot.h).toBeGreaterThan(0);
    }
  });
});

describe('LayoutEngine - slot mapping & rectangles', () => {
  it('mapImagesToSlots assigns higher-priority slots to earlier images', () => {
    const imageIds = ['a', 'b', 'c'];
    const slots = [
      { x: 0, y: 0, w: 1, h: 1, priority: 1 },
      { x: 0, y: 0, w: 1, h: 1, priority: 3 },
      { x: 0, y: 0, w: 1, h: 1, priority: 2 },
    ];

    const mapping = LE().mapImagesToSlots(imageIds, slots);
    // slot with priority 3 goes to first image
    expect(mapping[0].slot.priority).toBe(3);
    expect(mapping[1].slot.priority).toBe(2);
    expect(mapping[2].slot.priority).toBe(1);
  });

  it('mapImagesToSlots assigns null slots for extra images', () => {
    const imageIds = ['a', 'b', 'c', 'd'];
    const slots = [
      { x: 0, y: 0, w: 1, h: 1, priority: 2 },
      { x: 0, y: 0, w: 1, h: 1, priority: 1 },
    ];

    const mapping = LE().mapImagesToSlots(imageIds, slots);
    expect(mapping[2].slot).toBeNull();
    expect(mapping[3].slot).toBeNull();
  });

  it('computeSlotRectangles correctly scales slots into the margin box', () => {
    const preset = {
      id: 'T1',
      imageCount: 2,
      slots: [
        { x: 0, y: 0, w: 0.5, h: 1, priority: 2 },
        { x: 0.5, y: 0, w: 0.5, h: 1, priority: 1 },
      ],
    };
    const marginBox = { left: 10, top: 20, width: 100, height: 50 };
    const rects = LE().computeSlotRectangles({
      imageIds: ['a', 'b'],
      preset,
      marginBox,
    });

    expect(rects[0]).toMatchObject({ x: 10, y: 20, w: 50, h: 50, visible: true });
    expect(rects[1]).toMatchObject({ x: 60, y: 20, w: 50, h: 50, visible: true });
  });
});

describe('LayoutEngine - fit/fill math', () => {
  it('fitImageInSlot maintains aspect ratio and never overflows', () => {
    const slotW = 200;
    const slotH = 100;
    const imgW = 400;
    const imgH = 100;

    const result = LE().fitImageInSlot(imgW, imgH, slotW, slotH, 0, 0);
    expect(result.w).toBeLessThanOrEqual(slotW + 1e-6);
    expect(result.h).toBeLessThanOrEqual(slotH + 1e-6);
    expect(result.overflow).toBe(false);
    // horizontally scaled down to fit width, centered vertically
    expect(result.y).toBeCloseTo((slotH - result.h) / 2);
  });

  it('fillImageInSlot covers the slot and sets overflow flag', () => {
    const slotW = 200;
    const slotH = 100;
    const imgW = 100;
    const imgH = 400;

    const result = LE().fillImageInSlot(imgW, imgH, slotW, slotH, 0, 0);
    expect(result.w).toBeGreaterThanOrEqual(slotW - 1e-6);
    expect(result.h).toBeGreaterThanOrEqual(slotH - 1e-6);
    expect(result.overflow).toBe(true);
  });
});

describe('LayoutEngine - preset selection & orientation', () => {
  it('getImageOrientation classifies landscape, portrait, square', () => {
    expect(LE().getImageOrientation(200, 100)).toBe('landscape');
    expect(LE().getImageOrientation(100, 200)).toBe('portrait');
    expect(LE().getImageOrientation(100, 105)).toBe('square');
  });

  it('inferSlotRatio respects preferredRatio when present', () => {
    const slot = { x: 0, y: 0, w: 1, h: 1, priority: 1, preferredRatio: 'portrait' };
    expect(LE().inferSlotRatio(slot)).toBe('portrait');
  });

  it('orientationMatches treats square as compatible with anything', () => {
    expect(LE().orientationMatches('square', 'landscape')).toBe(true);
    expect(LE().orientationMatches('portrait', 'square')).toBe(true);
  });

  it('scorePresetMatch counts orientation matches and getPresetsForCountSorted sorts by score', () => {
    const presets = LE().getPresetsForCount(2);
    expect(presets.length).toBeGreaterThan(0);

    const images = [
      { width: 400, height: 300 },
      { width: 300, height: 400 },
    ];

    const withScores = presets.map(p => ({
      id: p.id,
      score: LE().scorePresetMatch(p, images).score,
    }));

    const sorted = LE().getPresetsForCountSorted(2, images);
    const sortedScores = sorted.map(p => LE().scorePresetMatch(p, images).score);

    for (let i = 1; i < sortedScores.length; i++) {
      expect(sortedScores[i - 1]).toBeGreaterThanOrEqual(sortedScores[i]);
    }
  });
});

describe('LayoutEngine - spread/gutter behavior', () => {
  it('isSlotInGutter detects slots crossing the gutter zone', () => {
    const { GUTTER_START, GUTTER_END, isSlotInGutter } = LE();

    const leftSlot = { x: 0, y: 0, w: GUTTER_START - 0.01, h: 0.5 };
    const rightSlot = { x: GUTTER_END + 0.01, y: 0, w: 0.5, h: 0.5 };
    const crossingSlot = { x: GUTTER_START - 0.01, y: 0, w: (GUTTER_END - GUTTER_START) + 0.02, h: 0.5 };

    expect(isSlotInGutter(leftSlot)).toBe(false);
    expect(isSlotInGutter(rightSlot)).toBe(false);
    expect(isSlotInGutter(crossingSlot)).toBe(true);
  });

  it('applyPresetToSpread produces pixel rects and crossesGutter flags', () => {
    const spreadState = LE().createPageLayoutState(['a', 'b']);
    const images = [
      { id: 'a', path: '/a.jpg', width: 800, height: 600 },
      { id: 'b', path: '/b.jpg', width: 600, height: 800 },
    ];
    const margins = { top: 1, bottom: 1, inner: 1, outer: 1 };
    const spreadWidthPx = 2000;
    const spreadHeightPx = 1000;

    const result = LE().applyPresetToSpread({
      spreadState,
      images,
      margins,
      spreadWidthPx,
      spreadHeightPx,
      unit: 'in',
      dpi: 100,
    });

    expect(result.length).toBe(2);
    for (const item of result) {
      expect(item.slotRect.w).toBeGreaterThan(0);
      expect(item.slotRect.h).toBeGreaterThan(0);
      expect(typeof item.crossesGutter).toBe('boolean');
    }
  });
});

describe('LayoutEngine - page layout state helpers', () => {
  it('createPageLayoutState initializes with imageIds and preset index 0', () => {
    const state = LE().createPageLayoutState(['a', 'b']);
    expect(state.imageIds).toEqual(['a', 'b']);
    expect(state.currentPresetIndex).toBe(0);
  });

  it('nextPreset cycles within bounds of presets', () => {
    const state = LE().createPageLayoutState(['a', 'b']);
    const presets = LE().getPresetsForCount(2);
    let current = state;
    for (let i = 0; i < presets.length * 2; i++) {
      current = LE().nextPreset(current);
      expect(current.currentPresetIndex).toBeGreaterThanOrEqual(0);
      expect(current.currentPresetIndex).toBeLessThan(presets.length);
    }
  });

  it('getCurrentPreset returns preset matching current index', () => {
    const state = LE().createPageLayoutState(['a', 'b']);
    const presets = LE().getPresetsForCount(2);
    const s2 = { ...state, currentPresetIndex: 1 };
    const current = LE().getCurrentPreset(s2);
    expect(current).toEqual(presets[1 % presets.length]);
  });

  it('updatePageImages resets preset index when count changes and preserves when only order changes', () => {
    const state = { imageIds: ['a', 'b'], currentPresetIndex: 2 };
    const sameCount = LE().updatePageImages(state, ['b', 'a']);
    expect(sameCount.currentPresetIndex).toBe(2);

    const diffCount = LE().updatePageImages(state, ['a', 'b', 'c']);
    expect(diffCount.currentPresetIndex).toBe(0);
  });
});

describe('LayoutEngine - preset transformations & shuffling', () => {
  it('mirrorPreset mirrors x coordinate using x\' = 1 - (x + w)', () => {
    const preset = {
      id: 'P',
      imageCount: 1,
      slots: [{ x: 0.1, y: 0, w: 0.3, h: 1, priority: 1 }],
    };
    const mirrored = LE().mirrorPreset(preset);
    expect(mirrored.id).toBe('P-M');
    const original = preset.slots[0];
    const mirroredSlot = mirrored.slots[0];
    expect(mirroredSlot.x).toBeCloseTo(1 - (original.x + original.w));
    expect(mirroredSlot.w).toBeCloseTo(original.w);
  });

  it('shuffleImagesInPreset respects locked indices and shuffles unlocked ones', () => {
    const imageIds = ['a', 'b', 'c', 'd'];
    const locked = new Set([1, 3]);

    const mockRandomValues = [0.1, 0.9, 0.4, 0.7];
    let idx = 0;
    const origRandom = Math.random;
    Math.random = () => mockRandomValues[idx++ % mockRandomValues.length];

    try {
      const result = LE().shuffleImagesInPreset(imageIds, locked);
      expect(result[1]).toBe('b');
      expect(result[3]).toBe('d');
      expect(result.join('')).not.toBe(imageIds.join(''));
    } finally {
      Math.random = origRandom;
    }
  });
});

describe('LayoutEngine - UndoStack', () => {
  let UndoStack;

  beforeEach(() => {
    UndoStack = LE().UndoStack;
  });

  it('push stores deep copies and respects maxSize', () => {
    const stack = new UndoStack(2);
    const state1 = { value: 1, nested: { a: 1 } };
    stack.push(state1);
    state1.nested.a = 999;
    const state2 = { value: 2 };
    const state3 = { value: 3 };
    stack.push(state2);
    stack.push(state3);

    expect(stack.stack.length).toBeLessThanOrEqual(2);
    const last = stack.stack[stack.stack.length - 1];
    expect(last.nested?.a).not.toBe(999);
  });

  it('undo/redo move between stacks and update canUndo/canRedo', () => {
    const stack = new UndoStack(10);
    const s1 = { value: 1 };
    const s2 = { value: 2 };
    const s3 = { value: 3 };
    stack.push(s1);
    stack.push(s2);
    stack.push(s3);

    expect(stack.canUndo()).toBe(true);
    const current = { value: 4 };
    const prev = stack.undo(current);
    expect(prev.value).toBe(3);
    expect(stack.canRedo()).toBe(true);

    const next = stack.redo(current);
    expect(next.value).toBe(4);
  });

  it('clear empties both stacks', () => {
    const stack = new UndoStack();
    stack.push({ v: 1 });
    stack.push({ v: 2 });
    stack.undo({ v: 3 });
    expect(stack.stack.length).toBeGreaterThan(0);
    expect(stack.redoStack.length).toBeGreaterThan(0);
    stack.clear();
    expect(stack.stack.length).toBe(0);
    expect(stack.redoStack.length).toBe(0);
  });
});

describe('LayoutEngine - loadPresetsFromData', () => {
  it('loads valid presets and skips invalid ones with error reporting', () => {
    const validPreset = {
      id: 'CUSTOM-1',
      imageCount: 1,
      slots: [{ x: 0, y: 0, w: 1, h: 1, priority: 1 }],
    };
    const invalidPreset = {
      id: 'CUSTOM-BAD',
      imageCount: 2,
      slots: [{ x: -1, y: 0, w: 3, h: 1, priority: 1 }],
    };

    const result = LE().loadPresetsFromData([validPreset, invalidPreset]);
    expect(result.loaded).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors.length).toBe(1);

    const presets = LE().getPresetsForCount(1);
    expect(presets.some(p => p.id === 'CUSTOM-1')).toBe(true);
  });
});

