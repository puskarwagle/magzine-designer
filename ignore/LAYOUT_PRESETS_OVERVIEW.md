# Sampat: Layout Presets Overview

This document provides a summary of the current state and implementation of the layout preset system in **Sampat** for developers.

## 1. Data Architecture (`presets.json`)
Layouts are defined as a collection of schemas in `presets.json`. Each preset defines how a specific number of images should be arranged on a page or spread.

### Schema Fields
- **`id`**: Unique identifier (e.g., `"P3-06"`).
- **`label`**: Human-readable name (e.g., `"Collage Scatter"`).
- **`imageCount`**: The number of images this layout expects.
- **`pageType`**: either `"single"` (default) or `"spread"` (spanning both left and right pages).
- **`style` / `tags`**: Categories like `"clean"`, `"editorial"`, `"hero"`, or `"fullbleed"` used for filtering.
- **`slots`**: An array of objects defining where images are placed:
    - **`x`, `y`, `w`, `h`**: Normalized coordinates and dimensions (0.0 to 1.0 for single page; 0.0 to 2.0 for spreads).
    - **`priority`**: Determines the image sequence (higher priority = earlier image index).
    - **`preferredRatio`**: Suggests the optimal orientation (`"portrait"`, `"landscape"`, `"square"`, or `"any"`).
    - **`mode`**: Fits the image using `"fill"` (crop to cover) or `"fit"` (letterbox/pillarbox).

### Example: Single Page (1 Image)
```json
{
  "id": "P1-02",
  "label": "Centered Portrait",
  "imageCount": 1,
  "style": "clean",
  "tags": ["minimal", "hero"],
  "slots": [
    { "id": "s1", "x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8, "priority": 1, "preferredRatio": "portrait", "mode": "fill" }
  ]
}
```

### Example: Cross-Spread (2 Images)
```json
{
  "id": "S2-01",
  "label": "Spread Double Hero",
  "imageCount": 2,
  "pageType": "spread",
  "style": "clean",
  "tags": ["grid", "spread"],
  "slots": [
    { "id": "s1", "x": 0.05, "y": 0.1, "w": 0.43, "h": 0.8, "priority": 1, "preferredRatio": "portrait", "mode": "fill" },
    { "id": "s2", "x": 0.52, "y": 0.1, "w": 0.43, "h": 0.8, "priority": 2, "preferredRatio": "portrait", "mode": "fill" }
  ]
}
```

---

## 2. Layout Engine logic (`src/renderer/src/lib/layoutEngine.js`)
The `LayoutEngine` is a decoupled module that calculates actual pixel positions based on the document size and margins.

### Key Capabilities
- **Generic Fallback**: If no preset is found for a given image count, the engine dynamically generates a generic grid layout on-the-fly.
- **Orientation Matching**: It can "score" presets by comparing image aspect ratios to slot `preferredRatio` values, allowing for "smart" layout suggestions.
- **Coordinate Transformation**: Handles the math for gutter-aware spreads and margins.
- **Actions**:
    - **Mirroring**: Flips a layout horizontally.
    - **Shuffling**: Randomizes image placement within slots while respecting manual "locks."

---

## 3. Implementation Stack
- **State management**: Handled via Svelte stores (`spreads.js`). The store tracks `currentPresetIndex` for each page/spread.
- **Rendering**: **Konva.js** handles the canvas rendering. The `KonvaStage.svelte` component consumes the engine's output to position images.
- **Interaction**: The `LayoutPanel.svelte` sidebar allows users to cycle presets, shuffle images, and switch between "Single Page" and "Spread" layout modes.

---

### Core Philosophy
The system is **fully decoupled**. The layout logic doesn't know about the UI or the rendering technology; it just takes a set of images and a document specification and returns a list of rectangles.
