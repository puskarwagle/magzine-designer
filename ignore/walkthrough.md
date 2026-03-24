# Advanced Album Layout Engine — Walkthrough

We have successfully overhauled the layout generation engine to support advanced, editorial-quality dynamic layouts. The core limitation of building only horizontal/vertical grids has been removed by shifting to a [Polygon](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#33-116)-first foundation. 

## Key Technical Achievements

1. **Polygon Foundation ([layoutEngine.js](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js))**
   - Replaced `{x,y,w,h}` internal mathematical assumptions with a [Polygon](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#33-116) primitive supporting [area()](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#47-58), [centroid()](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#59-83), and [boundingBox()](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#84-95). 
   - All partition splits, candidate evaluations, and generated layout footprints now rely on boundary boxes with custom paths, breaking the layout out of a restrictive grid format.

2. **Diagonal Sub-Cuts ([diagonalCut](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#160-231))**
   - Added a [diagonalCut(poly, angleDeg, ratio)](file:///home/wagle/vibecoding/sampat/src/renderer/src/lib/layoutEngine.js#160-231) handler. 
   - Non-root layout cells (depth >= 1) will probabilistically be split using safe +/- 5–10 degree angled trapezoids. Gutter-crossing in spread views is structurally prevented for diagonal cuts.
   
3. **Ghost & Text Slot Injection**
   - Whitespace ("ghost" columns) and Text blocks mathematically participate in dynamic layout generation based on dynamic `ratios`.
   - The engine computes target ratios based on text `content`, `fontSize`, and `lineCount` requirements, then injects them seamlessly before rendering skips standard image rendering steps for these blocks.

4. **Bounding Box Rotation Math**
   - Expanded layout slots dynamically compute inner `visualRect` footprints for manually rotated images (`w * cos(a) + h * sin(a)`) to prevent cropping edges.

5. **Multi-pass Candidate Generation (Narrative Flow)**
   - The recursive layout builder now generates 15 candidate spreads.
   - Using aesthetic heuristic `Scorers` (such as `editorial`, `minimal`, `grid`, and the primary `story`/Narrative Flow layout).
   - "Story" score evaluates reading-order visual weight (hero images land in top-left or centered optical areas, subsequent images shrink and progress down/right).

6. **Imperative Rendering & Svelte Bindings ([KonvaSlot.svelte](file:///home/wagle/vibecoding/sampat/src/renderer/src/components/preview/KonvaSlot.svelte))**
   - `clipFunc` is natively integrated, utilizing Svelte-Konva's absolute pixel-mapping.
   - Component rendering was updated to support conditional non-rectangular clipping limits.
   - Text boxes and Phantom whitespace blocks bypass standard image placement safely.
   - Imperative `node.zIndex()` was bound for stacking overlapping elements to avoid expensive DOM array recreations in Svelte logic loops.

## Validation Steps for the User
Run `npm run dev` to start your application, open an Album, and do the following to test features:
1. **Spread Mode Layouts**: Trigger the "Narrative Flow" dynamic layout strategy and confirm image sorting honors reading-order heuristics.
2. **Editorial Diagonal Strategy**: Click shuffle repeatedly and watch the 5-10 degree trapezoids emerge safely outside the spine gutter threshold.
3. **Empty Bounds**: Check if standard image bounds perfectly respect `visualRect` footprints even when non-zero rotations exist.
