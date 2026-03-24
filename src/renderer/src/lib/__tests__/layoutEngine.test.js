import { describe, it, expect } from 'vitest';
import { LayoutEngine } from '../layoutEngine.js';

describe('LayoutEngine - Dynamic Layout', () => {
  const images = [
    { id: '1', width: 1000, height: 1000 }, // Square
    { id: '2', width: 1500, height: 1000 }, // Landscape
    { id: '3', width: 666, height: 1000 },  // Portrait
  ];

  it('generates a dynamic preset with the correct number of slots', () => {
    const preset = LayoutEngine.generateDynamicPreset(images, false);
    expect(preset.imageCount).toBe(3);
    expect(preset.slots.length).toBe(3);
    expect(preset.pageType).toBe('single');
  });

  it('generates slots within 0..1 bounds for single page', () => {
    const preset = LayoutEngine.generateDynamicPreset(images, false);
    preset.slots.forEach(slot => {
      expect(slot.x).toBeGreaterThanOrEqual(-0.01); // Precision
      expect(slot.y).toBeGreaterThanOrEqual(-0.01);
      expect(slot.x + slot.w).toBeLessThanOrEqual(1.01);
      expect(slot.y + slot.h).toBeLessThanOrEqual(1.01);
    });
  });

  it('generates slots within 0..2 bounds for spread', () => {
    const preset = LayoutEngine.generateDynamicPreset(images, true);
    expect(preset.pageType).toBe('spread');
    preset.slots.forEach(slot => {
      expect(slot.x).toBeGreaterThanOrEqual(-0.01);
      expect(slot.y).toBeGreaterThanOrEqual(-0.01);
      expect(slot.x + slot.w).toBeLessThanOrEqual(2.01);
      expect(slot.y + slot.h).toBeLessThanOrEqual(1.01);
    });
  });

  it('computeSlotRectangles generates slots on-the-fly for DYNAMIC presets', () => {
    const marginBox = { left: 0, top: 0, width: 1000, height: 1000 };
    const presets = LayoutEngine.getPresetsForCount(3);
    const dynamicPreset = presets.find(p => p.id.startsWith('DYNAMIC'));
    
    expect(dynamicPreset).toBeDefined();
    
    const rects = LayoutEngine.computeSlotRectangles({
      imageIds: ['1', '2', '3'],
      preset: dynamicPreset,
      marginBox,
      images
    });

    expect(rects.length).toBe(3);
    expect(rects[0].w).toBeGreaterThan(0);
    expect(rects[1].w).toBeGreaterThan(0);
    expect(rects[2].w).toBeGreaterThan(0);
  });

  it('computeSlotRectangles handles spread scaling correctly', () => {
    const marginBox = { left: 0, top: 0, width: 2000, height: 1000 };
    const dynamicSpreadPreset = LayoutEngine.getSpreadPresetsForCount(2).find(p => p.id.startsWith('DYNAMIC'));
    
    const rects = LayoutEngine.computeSlotRectangles({
      imageIds: ['1', '2'],
      preset: dynamicSpreadPreset,
      marginBox,
      images
    });

    // Based on Ratio1=1.0 and Ratio2=1.5, the split ratio is 1.0/2.5 = 0.4
    // pixelRect.w = 4000 (after 2000x scale), w1 = 3960 * 0.4 = 1584, x2 = 1624
    // slot.x = 1624 / 2000 = 0.812
    // final x = 0.812 * 1000 = 812
    const rightSlot = rects.find(r => r.x > 0);
    expect(rightSlot.x).toBeCloseTo(812, 0); 
  });

  it('applyPresetToSpread respects the gutter (inner margin)', () => {
    const margins = { top: 0, bottom: 0, inner: 50, outer: 0 };
    const spreadWidthPx = 2000; // spine and pages are all relative now
    const spreadHeightPx = 1000;
    
    const spreadState = {
      imageIds: ['1', '2'],
    };

    const slots = LayoutEngine.applyPresetToSpread({
      spreadState,
      images,
      margins,
      spreadWidthPx,
      spreadHeightPx,
      unit: 'px',
      dpi: 72
    });

    // In my implementation:
    // pageWidthPx = spreadWidthPx / 2 = 1000
    // rightPageStartX = 1000
    // L Margin Box: left = outer = 0, width = 1000 - 0 - 50 = 950
    // R Margin Box: left = inner + rightPageStartX = 50 + 1000 = 1050, width = 1000 - 0 - 50 = 950

    expect(slots.length).toBe(2);
    const leftSlot = slots.find(s => s.slotRect.x < 1000);
    const rightSlot = slots.find(s => s.slotRect.x >= 1000);

    expect(leftSlot.slotRect.x + leftSlot.slotRect.w).toBeLessThanOrEqual(950);
    expect(rightSlot.slotRect.x).toBeGreaterThanOrEqual(1050);
  });

  it('applyPresetToSpread moves images between pages when variant changes', () => {
    const margins = { top: 0, bottom: 0, inner: 0, outer: 0 };
    const spreadWidthPx = 2000;
    const spreadHeightPx = 1000;
    const testImages = [
      { id: '1', width: 1000, height: 1000 },
      { id: '2', width: 1000, height: 1000 },
      { id: '3', width: 1000, height: 1000 },
      { id: '4', width: 1000, height: 1000 },
    ];
    
    // Variant 1: Sequential (1,2 go Left; 3,4 go Right)
    const slotsV1 = LayoutEngine.applyPresetToSpread({
      spreadState: { imageIds: ['1', '2', '3', '4'], currentPresetIndex: 1 },
      images: testImages,
      margins,
      spreadWidthPx,
      spreadHeightPx,
      unit: 'px',
      dpi: 72
    });
    const leftV1 = slotsV1.filter(s => s.slotRect.x < 1000).map(s => s.imageId).sort();
    expect(leftV1).toEqual(['1', '2']);

    // Variant 2: Interleaved (1,3 go Left; 2,4 go Right)
    const slotsV2 = LayoutEngine.applyPresetToSpread({
      spreadState: { imageIds: ['1', '2', '3', '4'], currentPresetIndex: 2 },
      images: testImages,
      margins,
      spreadWidthPx,
      spreadHeightPx,
      unit: 'px',
      dpi: 72
    });
    const leftV2 = slotsV2.filter(s => s.slotRect.x < 1000).map(s => s.imageId).sort();
    expect(leftV2).toEqual(['1', '3']);
  });

  it('applyPresetToPage respects configurable slotGapPx', () => {
    const pageState = { imageIds: ['1', '2'], currentPresetIndex: 0 };
    const images = [
      { id: '1', width: 1000, height: 1000 },
      { id: '2', width: 1000, height: 1000 },
    ];
    const margins = { top: 0, bottom: 0, inner: 0, outer: 0 };
    const pageWidthPx = 1000;
    const pageHeightPx = 1000;

    // With 12px gap
    const slots1 = LayoutEngine.applyPresetToPage({
      pageState, images, margins, pageWidthPx, pageHeightPx,
      unit: 'px', dpi: 72, isLeftPage: true, slotGapPx: 12
    });
    
    // With 100px gap
    const slots2 = LayoutEngine.applyPresetToPage({
      pageState, images, margins, pageWidthPx, pageHeightPx,
      unit: 'px', dpi: 72, isLeftPage: true, slotGapPx: 100
    });

    const gap1 = slots1[1].slotRect.x - (slots1[0].slotRect.x + slots1[0].slotRect.w);
    const gap2 = slots2[1].slotRect.x - (slots2[0].slotRect.x + slots2[0].slotRect.w);

    expect(Math.round(gap1)).toBe(12);
    expect(Math.round(gap2)).toBe(100);
  });

  it('shuffling imageIds does not change slotRect coordinates (stable geometry)', () => {
    const images = [
      { id: '1', width: 2000, height: 1000 }, // Landscape
      { id: '2', width: 1000, height: 2000 }, // Portrait
    ];
    const marginBox = { left: 0, top: 0, width: 1000, height: 1000 };
    const preset = { id: 'DYNAMIC-P-2-0', pageType: 'single', slots: [] };

    // Initial run (order: 1, 2)
    const res1 = LayoutEngine.computeSlotRectangles({
      imageIds: ['1', '2'],
      preset,
      images,
      marginBox,
      gap: 0,
    });

    // Shuffled run (order: 2, 1)
    const res2 = LayoutEngine.computeSlotRectangles({
      imageIds: ['2', '1'],
      preset,
      images,
      marginBox,
      gap: 0,
    });

    // The boxes (rects) should be identical even if content is in different indices
    const boxes1 = res1.map(r => r.slotRect).sort((a, b) => a.x - b.x || a.y - b.y);
    const boxes2 = res2.map(r => r.slotRect).sort((a, b) => a.x - b.x || a.y - b.y);

    expect(boxes1).toEqual(boxes2);
    
    // But image IDs for each box should be swapped
    const img1AtBoxX = res1[0].imageId;
    const img2AtBoxX = res2[0].imageId;
    expect(img1AtBoxX).not.toBe(img2AtBoxX);
  });
});
