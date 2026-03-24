import { describe, it, expect } from 'vitest';
import { toPixels, fromUnitToUnit, getAlbumSize } from '../utils.js';

describe('utils - toPixels', () => {
  it('converts inches to pixels', () => {
    expect(toPixels(1, 'in', 300)).toBe(300);
    expect(toPixels(0.5, 'in', 300)).toBe(150);
  });

  it('converts centimeters to pixels', () => {
    // 2.54 cm = 1 inch
    expect(toPixels(2.54, 'cm', 100)).toBeCloseTo(100);
    expect(toPixels(5.08, 'cm', 300)).toBeCloseTo(600);
  });
});

describe('utils - fromUnitToUnit', () => {
  it('returns same value if units are the same', () => {
    expect(fromUnitToUnit(10, 'in', 'in')).toBe(10);
    expect(fromUnitToUnit(20, 'cm', 'cm')).toBe(20);
  });

  it('converts inches to centimeters', () => {
    expect(fromUnitToUnit(1, 'in', 'cm')).toBe(2.54);
  });

  it('converts centimeters to inches', () => {
    expect(fromUnitToUnit(2.54, 'cm', 'in')).toBe(1);
  });
});

describe('utils - getAlbumSize', () => {
  it('calculates spread size correctly (inches)', () => {
    const settings = {
      unit: 'in',
      dpi: 100,
      pageWidth: 10,
      pageHeight: 5,
    };
    const size = getAlbumSize(settings, true);
    expect(size.widthPhysical).toBe(20);
    expect(size.heightPhysical).toBe(5);
    expect(size.widthPx).toBe(2000);
    expect(size.heightPx).toBe(500);
  });

  it('calculates single page size correctly (cm)', () => {
    const settings = {
      unit: 'cm',
      dpi: 100,
      pageWidth: 2.54,
      pageHeight: 2.54,
    };
    const size = getAlbumSize(settings, false);
    expect(size.widthPhysical).toBe(2.54);
    expect(size.heightPhysical).toBe(2.54);
    expect(size.widthPx).toBeCloseTo(100);
    expect(size.heightPx).toBeCloseTo(100);
  });

  it('uses default DPI if not provided', () => {
    const settings = {
      unit: 'in',
      pageWidth: 10,
      pageHeight: 10,
    };
    // DEFAULT_DPI is 300
    const size = getAlbumSize(settings, false);
    expect(size.widthPx).toBe(3000);
  });
});
