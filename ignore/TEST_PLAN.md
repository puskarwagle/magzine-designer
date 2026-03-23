## Test Plan Overview

This project currently has no automated tests configured. The following is a prioritized list of modules and behaviors that should be covered by tests, plus a recommended test framework.

### Recommended Test Framework

- **Framework**: Vitest  
- **Why**:
  - Fast and modern, Jest-compatible API.
  - Great for testing both browser-like and Node logic.
  - Works well with pure JS modules and can run DOM-style tests via jsdom if needed.

You can still switch to Jest or tap later if you prefer; the priorities below stay the same regardless of framework.

### Priority 1: `src/renderer/layoutEngine.js`

This is the core layout “business logic” and is very testable in isolation.

**Key areas to test:**
- **Preset validation & registry**
  - `validatePreset`, `validateAllPresets`:
    - Detect mismatched `imageCount` vs `slots.length`.
    - Catch out-of-bounds slots and overlapping slots.
    - Ensure duplicate priorities are flagged.
  - `presetsByCount`, `spreadPresetsByCount` basic sanity:
    - For selected built-in presets, confirm `imageCount` and slot structure look correct.
- **Geometry & unit math**
  - `computeMarginBox`:
    - Correct left/right margins for left vs right pages.
    - Proper unit conversion for inches vs centimeters.
  - `computeSpreadMarginBox`:
    - Correct top/bottom and outer margins over a 2-page spread.
  - `generateGenericGrid`, `generateGenericSpreadGrid`:
    - Number of slots equals `n`.
    - Grid cells tile the area without gaps/overlaps beyond configured GAP.
- **Slot mapping and rects**
  - `mapImagesToSlots`:
    - Higher-priority slots get earlier images.
    - Extra images after available slots get `null` slots.
  - `computeSlotRectangles`:
    - Slot rectangles are correctly scaled into the margin box (position + size).
- **Fit/fill math**
  - `fitImageInSlot`:
    - Maintains aspect ratio, fits fully in slot, no overflow.
    - Centers the image in the slot.
  - `fillImageInSlot`:
    - Covers the slot completely, possibly overflowing.
    - Still centered; `overflow` flag is true.
- **Preset selection & orientation logic**
  - `getPresetsForCount`, `getSpreadPresetsForCount`:
    - Return built-in presets when defined.
    - Fall back to generic grid/spread grid when none exist.
  - `getImageOrientation`, `inferSlotRatio`, `orientationMatches`:
    - Portrait/landscape/square thresholds behave as expected.
  - `scorePresetMatch`, `getPresetsForCountSorted`:
    - Higher scores for better orientation matches.
    - Sorted list places best-matching presets first.
- **Spread/gutter behavior**
  - `isSlotInGutter`:
    - Correctly detects when a slot crosses the gutter (`GUTTER_START`, `GUTTER_END`).
  - `applyPresetToPage`, `applyPresetToSpread`:
    - For simple scenarios, verify:
      - Correct slot-to-pixel mapping.
      - `overflow` behavior based on `fit` vs `fill`.
      - `crossesGutter` is accurate in spread mode.
- **Page layout state helpers**
  - `createPageLayoutState`:
    - Initializes with provided image IDs and preset index 0.
  - `nextPreset`:
    - Cycles `currentPresetIndex` within bounds of available presets.
  - `getCurrentPreset`:
    - Returns the expected preset given current index and image count.
  - `updatePageImages`:
    - Resets `currentPresetIndex` when the image count changes.
    - Keeps it when only ordering changes.
- **Preset transformations and shuffling**
  - `mirrorPreset`:
    - X coordinates are mirrored correctly: `x' = 1 - (x + w)`.
  - `shuffleImagesInPreset`:
    - Fisher-Yates correctness on unlocked indices.
    - Locked indices remain in place.
- **Undo stack**
  - `UndoStack`:
    - `push` respects `maxSize` and deep-clones state.
    - `undo`/`redo` move between stacks as expected.
    - `canUndo`/`canRedo` reflect stack contents.
    - `clear` empties both stacks.
- **Preset loading from data**
  - `loadPresetsFromData`:
    - Valid presets grouped into `presetsByCount` by `imageCount`.
    - Invalid presets are skipped with errors recorded.
    - Returns `{ loaded, skipped, errors }` with expected counts.

### Priority 2: `src/renderer/renderer.js`

This file mixes DOM, state, and LayoutEngine usage. Focus tests on the pure-ish logic and state transitions that don’t strictly require a browser UI (or can be tested with jsdom).

**Key areas to test:**
- **Unit/size math**
  - `toPixels`:
    - Correct conversion for inches and centimeters at a given DPI.
  - `fromUnitToUnit`:
    - Inches ↔ centimeters conversion round-trips reasonably.
  - `getAlbumSize`:
    - Doubles width for spreads when `isSpread=true`.
    - Returns correct `widthPx` / `heightPx` given `unit` and `dpi`.
- **State helpers & lock management**
  - `getPageKey`:
    - Returns `"spreadIndex-spread"` in spread mode.
    - Returns `"spreadIndex-left"` or `"spreadIndex-right"` in single-page mode.
  - `getLockedSlots`:
    - Creates and returns a `Set` per page key.
  - `toggleSlotLock`:
    - Adds/removes indices from the lock set for the current page key.
- **Undo integration**
  - `saveLayoutStateForUndo`:
    - Pushes a deep copy of the current spread/page state to `LayoutEngine.layoutUndoStack`.
  - `handleUndo` / `handleRedo`:
    - Update the current spread’s pages according to the stack’s result.
    - No change when stacks are empty.
- **Layout control behavior**
  - `handleNextLayout`:
    - Does nothing if `imageIds` is empty.
    - Increments `currentPresetIndex` modulo preset count.
    - Resets `isMirrored` / `mirroredPreset` as appropriate.
  - `handleMirrorLayout`:
    - Toggles `isMirrored` and `mirroredPreset` on the current page/spread.
    - Uses `LayoutEngine.mirrorPreset` as the source of mirrored preset.
  - `handleShuffleImages`:
    - Does nothing if `< 2` images.
    - Uses `LayoutEngine.shuffleImagesInPreset` and respects locked indices.
- **Layout info computation**
  - `updateLayoutInfo`:
    - For a known setup, generates the expected text:
      - Includes preset ID.
      - Includes `[M]` when mirrored.
      - Includes orientation match score (`(score/total match)`).
      - Shows `(currentIndex/totalPresets)` at the end.

DOM-heavy functions like `renderPreview`, `renderLayoutPanel`, etc. can be optionally covered with integration tests later using jsdom, but they are lower priority than the pure logic above.

### Priority 3: `src/main/main.js`

Tests here should focus on IPC handlers and filesystem behavior, with Node-level tests and mocks.

**Key areas to test:**
- **`ipcMain.handle('pick-folder', ...)`**
  - When dialog is canceled:
    - Returns `{ folderPath: null, images: [] }`.
  - When a folder is chosen:
    - Uses `fs.promises.readdir` to enumerate files.
    - Filters only `jpg/jpeg/png` (case-insensitive).
    - Produces `images` array with:
      - Stable `id` format (`img-<index>`).
      - Correct `fileName` and full `path`.
- **`ipcMain.handle('get-layout-presets', ...)`**
  - Successful case:
    - Reads `presets.json` from `app.getAppPath()`.
    - Parses JSON and returns the array when it is an array.
  - Failure cases:
    - Missing file, invalid JSON, or non-array value → returns `null`.
- **`ipcMain.handle('load-sample-folder', ...)`**
  - Successful case:
    - Reads `sample-images` under `app.getAppPath()`.
    - Filters to image file types and builds an `images` array like `pick-folder`.
  - Failure case:
    - Any error (missing folder, etc.) returns `{ folderPath: null, images: [] }`.

### Priority 4: `src/preload/preload.js`

Thin bridge layer, but important to keep IPC channel contracts stable.

**Key areas to test:**
- `contextBridge.exposeInMainWorld('api', { ... })` exposes:
  - `pickFolder` that calls `ipcRenderer.invoke('pick-folder')`.
  - `loadSampleFolder` that calls `ipcRenderer.invoke('load-sample-folder')`.
  - `getLayoutPresets` that calls `ipcRenderer.invoke('get-layout-presets')`.

These can be tested with simple mocks for `ipcRenderer` and assertions on the invoked channel names and returned values.

---

With this test plan in place, the next step is:
- Add Vitest as a dev dependency.
- Add an `npm test` script in `package.json`.
- Create initial test files (starting with `src/renderer/__tests__/layoutEngine.test.js`) that follow the priorities above.

