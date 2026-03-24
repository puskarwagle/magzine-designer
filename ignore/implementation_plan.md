# Advanced Album Layout Architecture

This plan covers the implementation of advanced editorial layout features requested: Diagonals/Polygons, Overlapping Slots, Whitespace Ghost Slots, Text Slots, Per-slot Bleed, Rotation, Golden Ratio Snapping, and Multi-pass Candidate Scoring. It prioritizes the foundational architecture needed to make these features robust.

## Proposed Changes

### 1. Core Primitives & Engine Foundation

#### [NEW] `Polygon Primitive`
- Introduce a `Polygon` class that underpins the layout engine. Replace `{x,y,w,h}` math with polygon math throughout the downstream pipeline (ratio scoring, area weighting, bleed expansion, overlap nudging).
- Methods: `area()`, `centroid()`, `boundingBox()`, `clipPath()`.
- Rectangular slots are treated as specialized 4-vertex polygons.

#### [NEW] `Directed Overlap Graph`
- Track which slot overlaps which, by how much, and in what direction.
- Used by the engine to prevent impossible cascaded configurations.
- Used by the renderer to adjust image fill compensation underneath overlaps so images aren't cropped awkwardly at the seam.

#### [NEW] `Strategy Registry`
- Replace magic numbering (e.g., `-5`, `-3`) in dynamic generation with a Strategy Registry.
- Shape: `{ id: 'editorial-diagonal', label: 'Editorial Diagonal', fn: partitionFn, scorer: scoreFn }`.
- Allows iterating over human-readable layout strategies natively.

### 2. Layout Features & Behaviors

#### [MODIFY] [src/renderer/src/lib/layoutEngine.js](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js)
- **Ghost & Text Slot Injection**:
  - Expose API `addGhostSlot(ratio, weight)` to insert whitespace into the partition. The partition allocates it naturally; the renderer skips it.
  - Expose API `addTextSlot(textConfig)` where `textConfig` contains `{ fontSize, lineCount, content }`. The injected ratio is dynamically computed via `lineCount * lineHeight / estimatedWidth`.
- **Aesthetic Quantisation**:
  - `snapToAestheticRatio(ratio)` function applying a snap when a partition split ratio is close to 0.333, 0.667, or 0.618 (Golden Ratio).
- **Rotation Bounding Box Compensation**:
  - When `rotation` is non-zero, the partition allocates an enlarged bounding box using angle math (e.g., `w * cos(a) + h * sin(a)`).
  - Slot communicates its allocated footprint and rotated visual footprint to the renderer so the image fits snugly without bleeding over edges unintentionally.
- **Gutter-Aware Diagonals**:
  - In `spread` mode, diagonal cuts that cross the spread gutter zone (`GUTTER_START` to `GUTTER_END`) are explicitly prevented or routed around to prevent disjoint images across physical pages.

### 3. Multi-pass Candidate Scoring

#### [MODIFY] [src/renderer/src/lib/layoutEngine.js](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js)
- **Scorers**:
  - `Editorial`: Maximizes size contrast.
  - `Minimal`: Maximizes whitespace.
  - [Grid](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#216-247): Minimizes variance.
  - `Narrative Flow`: Maps slot positions to a reading-order visual weight score. The hero image is biased toward the optical center or top-left, while supporting images progressively decrease in size toward bottom-right.
- **Multi-pass**: Generate 10-20 candidates using the engine, score them against a chosen target from the Strategy Registry, and pick the best one.

### 4. Rendering Engine (Konva)

#### [MODIFY] [src/renderer/src/components/preview/KonvaSlot.svelte](file:///home/wagle/vibecoding/sampat/src/renderer/src/components/preview/KonvaSlot.svelte)
- **Imperative `zIndex` Management**:
  - Stop using Svelte array sorting for `slotsData`. Use imperative Konva methods (`node.moveToTop()` or `node.zIndex(val)`) after mount to manage overlap indices without destroying/re-creating Svelte-Konva nodes.
- **Polygons / Diagonals (`clipFunc`)**:
  - `clipFunc` derived from the `Polygon` model's vertices instead of basic `clipX/Y/W/H`.
- **Interpolations**:
  - Handle overlap compensation graphically using signals from the Directed Overlap Graph.

## Verification Plan

### Automated Tests
- Unit tests for `Polygon` mathematical correctness (`area()`, `boundingBox()`, intersection tests logic if applicable).
- Multi-pass scoring functions testing `Narrative Flow` with deterministic weighted mocks.
- Test `textConfig` ratio computations.
- Ensure validation passes for new slot properties and Gutter safety.

### Manual Verification
1. Activate a spread with 5+ images and trigger the Narrative Flow strategy; verify the visual path runs naturally from a top/hero left to bottom right.
2. Trigger the Editorial Diagonal strategy; verify polygons render correctly natively in Konva, that the physical gutter is not crossed awkwardly, and no rectangular gaps exist.
3. Test layout mutation involving overlapping slots; confirm imperative `zIndex` updates do not trigger heavy Svelte remount loops.
4. Verify text slots and ghost slots allocate size perfectly matching their content parameters rather than defaulting to generic rectangles.
