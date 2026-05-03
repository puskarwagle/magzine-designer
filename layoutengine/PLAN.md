# Robust Plan for "Wowed" Layout Engine

This document outlines the architectural implementation details for the 7 strategy improvements requested to evolve the layout engine into a professional Magazine Designer.

## 1. Geometric Split Operators (The "Cool" Shapes)
**Goal:** Break free from orthographic rects with diagonal slicing and sibling tagging.
* **Component Changes:** `bsp.js` and a new geometry module `clip.js`.
* **Implementation:**
  * Define `PolygonSplitter` that takes an array of vertices (`{x, y}`), a `point`, and an `angle`.
  * Use the **Sutherland-Hodgman** line-clipping algorithm to slice a convex polygon into two smaller convex polygons.
  * **Degenerate Guard:** Before finalizing a split, calculate the area of resulting polygons using the Shoelace formula. If a polygon has an area < 1% of its parent or if vertices are collinear (within a 1e-6 tolerance), discard the split and return the parent as a single leaf.
  * **Sibling Tagging:** When a split occurs, tag resulting polygons with a unique `siblingId` (e.g., `split_104`). 
    * **Consumer:** The `Renderer` and `StyleEngine` read this ID. If two adjacent slots share a `siblingId`, the renderer can omit the internal gutter between them for a "joined" look or apply a unified background/frame across the group.
  * **Legacy Compatibility:** Existing rectangular presets will be auto-converted to 4-point polygons upon loading to ensure the engine only maintains a single polygon-based path.

## 2. Narrative & Visual Weight Scoring
**Goal:** Guide the viewer's eye using layout gravity.
* **Component Changes:** `engine.js` (`TemplateScorer`).
* **Implementation:**
  * Add a **Reading Gravity** heuristic. Calculate the visual center of the largest slot. If it aligns with "power points" (e.g., top-left / center / golden ratio points), increase the layout score.
  * Add **Directional Flow** checks: Evaluate `image.focalPoint` against the `visualCenter` of the spread. Ensure left-weighted images aren't placed on the extreme right edge pointing off-canvas.

## 3. Affinity-Based Multi-Pass Selection
**Goal:** Ensure landscape photos go into landscape slots.
* **Component Changes:** `bsp.js` and `engine.js`.
* **Implementation:**
  * **Deterministic Candidate Generation:** Generate 10-20 tree candidates using a **Seeded PRNG** (e.g., `splitSeed`). This ensures a specific input of images always yields the same "best" layout.
  * **Variance Axes:** For each candidate, inject random variances into:
    * **Split Ratio:** Perturb the target 0.5 split by ±15%.
    * **Orientation:** Toggle between H, V, and Diagonal (30° to 150°).
    * **Child Order:** Randomly swap the left/right or top/bottom branch assignments.
  * **Greedy Descent & Tiebreaking:** Calculate the aggregate Aspect Ratio Affinity for all slots.
    * **Primary Metric:** Minimize `sum(abs(log(imageAR / slotAR)))`.
    * **Tiebreaker:** If affinity scores are within 0.05, prefer the candidate with the highest **Area Balance Factor** (variance of slot areas) to avoid "slivers."

## 4. Semantic Ghost Injection
**Goal:** Use negative space natively as a design component.
* **Component Changes:** `engine.js` selection logic.
* **Implementation:**
  * **Normalization:** To prevent larger layouts (N+1) from always outscoring smaller ones (N), the Affinity Score is calculated as an **average per-slot error**: `Score = TotalAffinity / AssignedSlots`.
  * **Ghost Logic:** Allow candidates where `Slots = ImageCount + 1`. 
    * Assign images to the N best-fitting slots. 
    * The remaining unassigned slot is designated as a `Ghost Slot`. 
    * A `Ghost Slot` candidate is only selected if its normalized score is at least 20% better than the best N-slot candidate, effectively proving that the "sacrifice" of space significantly improved the presentation of the remaining images.

## 5. Global Design System (Gutter & Corner Tokens)
**Goal:** Systemic styling that dynamically adjusts to layout density.
* **Component Changes:** `engine.js` config and `renderer.js`.
* **Implementation:**
  * Establish a `designTheme: { baseGutter, cornerRadius, scalingFactor }` in the layout state.
  * **Dynamic Gutter Scaling:** Replace the log-based reduction with a **density-aware expansion formula**:
    * `calculatedGutter = baseGutter * (1 + (depth * 0.25))`
    * This ensures that as slots get smaller (deeper in the tree), they receive *more* relative breathing room, preventing the "cramped" look common in deep recursive splits.
  * **Corner Radius:** Update the SVG clip path generator in `renderer.js` or `ShapeFactory` to arc polygon corners automatically when mapping vertices.

## 6. Adaptive Focal Point Assignment
**Goal:** Intelligent framing based on photo subjects.
* **Component Changes:** `ImageMath` / `engine.js` assignment phase.
* **Implementation:**
  * Expand focal point logic into a **Directional Intent Rule Set**:
    * **Lead Room:** If `image.focalPoint.x < 0.3` (subject is on the left), the subject is "facing right." This image gets a 1.5x score multiplier if placed in a slot where there is more layout space to its right than its left.
    * **Gutter Safety:** Subjects facing "off-page" (e.g., facing left while on the far left edge) receive a heavy penalty.
    * **Facing the Spine:** In a spread, subjects should generally face the spine (the center) to keep the viewer's eye within the book.
  * **Affinity Locking:** Highly asymmetric images (Focal Point > 0.8 in any axis) are "locked" to slots that provide sufficient lead room, overriding standard aspect-ratio affinity if necessary.

---
**Execution Order:**
We will tackle these one by one. Our immediate first step is **Geometric Split Operators**. We will create the foundational geometry functions to split polygons diagonally, hook that into the BSP recursive tree, and ensure the UI can render non-rectangular slots correctly.
