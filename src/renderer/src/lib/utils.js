export const albumSizePresets = [
  { id: '18x12', name: '18 x 12 in (Spread)', unit: 'in', spreadWidth: 18, height: 12 },
  { id: '10x10', name: '10 x 10 in (Spread)', unit: 'in', spreadWidth: 20, height: 10 },
  { id: '8x8', name: '8 x 8 in (Spread)', unit: 'in', spreadWidth: 16, height: 8 },
  { id: 'a4', name: 'A4 (29.7 x 21 cm) (Spread)', unit: 'cm', spreadWidth: 59.4, height: 21 },
  { id: 'custom', name: 'Custom Size', unit: 'in', spreadWidth: 18, height: 12 }
];

export const DEFAULT_DPI = 300;
export const PAPER_THICKNESS_MM = 0.5; // default paper thickness for spine calculation

export function toPixels(value, unit, dpi) {
  if (unit === 'cm') {
    const inches = value / 2.54;
    return inches * dpi;
  }
  // inches
  return value * dpi;
}

export function fromUnitToUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'in' && toUnit === 'cm') return value * 2.54;
  if (fromUnit === 'cm' && toUnit === 'in') return value / 2.54;
  return value;
}

export function getAlbumSize(settings, isSpread = true) {
  const unit = settings.unit || 'in';
  const dpi = settings.dpi || DEFAULT_DPI;
  const pageWidth = settings.pageWidth;
  const pageHeight = settings.pageHeight;

  let widthPhysical = pageWidth;
  if (isSpread) {
    widthPhysical = pageWidth * 2;
  }
  const heightPhysical = pageHeight;

  const widthPx = toPixels(widthPhysical, unit, dpi);
  const heightPx = toPixels(heightPhysical, unit, dpi);

  return {
    unit,
    dpi,
    widthPhysical,
    heightPhysical,
    widthPx,
    heightPx
  };
}
