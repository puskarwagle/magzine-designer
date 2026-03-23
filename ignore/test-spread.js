const fs = require('fs');

// Create a dummy DOM to avoid errors if layoutEngine uses window/document
global.window = {};
global.document = {
  createElement: () => ({ style: {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } }),
  getElementById: () => null
};
global.process = { env: { NODE_ENV: 'test' } }; // skip validation on load

// Load layout engine
const code = fs.readFileSync('src/renderer/layoutEngine.js', 'utf8');
eval(code);

const spreadState = { imageIds: ['img1', 'img2'], currentPresetIndex: 0 };
const images = [
  { id: 'img1', path: '/fake/img1.jpg', width: 2000, height: 1000 },
  { id: 'img2', path: '/fake/img2.jpg', width: 1000, height: 2000 }
];
const margins = { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }; // in
const spreadWidthPx = 4000;
const spreadHeightPx = 2000;
const unit = 'in';
const dpi = 300;

try {
  const result = window.LayoutEngine.applyPresetToSpread({
    spreadState,
    images,
    margins,
    spreadWidthPx,
    spreadHeightPx,
    unit,
    dpi,
  });
  console.log("SUCCESS:", JSON.stringify(result, null, 2));
} catch (e) {
  console.error("ERROR:", e);
}
