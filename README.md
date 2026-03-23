# Album Layout Electron App (Svelte + Vite)

## Project Overview

This is a professional Electron desktop application designed for designing high-quality photo albums. It leverages **Svelte 5** and **Vite** to provide a highly reactive, modular, and maintainable workspace.

The application allows users to:
- Select and manage folders of high-resolution images.
- Configure precise physical album dimensions (Inches or Centimeters).
- Manage global and per-spread margins, safe zones, and spine/gutter calculations.
- Lay out images using a robust **Layout Preset Engine** that maps photos to optimized slots.
- **Advanced Preview Engine**: Auto-fit to screen, Pinch-to-zoom, and pixel-perfect 100% viewing modes.
- Toggle between single-page and cross-gutter spread layout modes.
- **Two-Column Sidebar UI**: A left-aligned icon navigation menu maximizing vertical space for panel content with hover tooltips.

## Tech Stack

- **Framework:** [Svelte 5](https://svelte.dev/) (Legacy/Runes hybrid migration state)
- **Rendering:** [Konva.js](https://konvajs.org/) via `svelte-konva` for 2D Canvas rendering
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Environment:** [Electron](https://www.electronjs.org/)
- **Styling:** Vanilla CSS (Modularized within Svelte components)
- **Testing:** [Vitest](https://vitest.dev/)
- **Language:** JavaScript (ES6+ ESM)

## Core Architecture

The project follows a clean separation of concerns across the Electron processes:

### 1. Main Process (`src/main/`)
The "backend" of the app. It handles:
- Window lifecycle management.
- Native OS dialogs (folder picking).
- Filesystem operations via IPC handlers.
- **`presets.json`**: External source of truth for layout configurations.

### 2. Preload Bridge (`src/preload/`)
- **`preload.js`**: A secure bridge that exposes a limited `window.api` to the frontend.

### 3. Renderer Process (`src/renderer/`)
The modern Svelte frontend, located in `src/renderer/src/`.

#### **Data-Driven UI Pattern (The "Brain")**
The app's rendering architecture is designed for high performance and clear separation of concerns, centered around a powerful derived store.

1.  **`activeSpreadLayout` (The Brain):** This is a centralized Svelte derived store located in `src/renderer/src/stores/spreads.js`. It is the **single source of truth for all rendering coordinates**. It listens to multiple other stores (project settings, UI state, spread data) and, whenever any of them change, it re-runs all calculations by passing the raw data to the stateless `layoutEngine.js`. The final output is a complete, pixel-perfect description of the entire spread, including page dimensions, margins, and an array of image slots with their exact coordinates and sizes.

2.  **`Konva.js` (The "Muscle"):** The UI follows a "Dumb Component" pattern. The preview area uses `svelte-konva` to render the album spread on an HTML5 Canvas.
    - **`KonvaStage.svelte`**: This component receives the fully-calculated layout object from the `activeSpreadLayout` store.
    - **`KonvaSlot.svelte`**: The stage iterates over the slots from the layout object, passing the pre-calculated coordinates (`x`, `y`, `width`, `height`) and image data to this component. `KonvaSlot` is a "dumb" component responsible only for drawing a rectangle and an image onto the canvas at the position it was given.

This architecture ensures that Svelte's reactivity is used for efficient state management and calculation, while the performance-critical rendering of potentially hundreds of shapes is offloaded to the highly optimized Konva.js canvas library. The components themselves contain minimal logic.

#### **Folder Structure**
- **`components/`**: Modular UI components.
    - **`preview/`**: The core canvas engine (`PreviewArea.svelte`, `KonvaStage.svelte`, `KonvaSlot.svelte`).
    - **`sidebar/`**: Interaction panels (`SizePanel`, `LayoutPanel`, etc.).
    - **`rulers/`**: Dynamic measurement tools.
- **`stores/`**: Centralized state management:
    - `project.js`: Image pool, folder paths, and external preset initialization.
    - `spreads.js`: Album spread data and the **`activeSpreadLayout`** derived logic.
    - `ui.js`: Sidebar state and **Zoom Engine** state (zoom level, auto-fit toggles).
- **`lib/`**: Pure logic and utilities.
    - **`layoutEngine.js`**: Stateless engine for geometry, validation, and preset mapping.
    - **`utils.js`**: **Single source of truth** for `toPixels` and unit conversion.
    - **`undo.js`**: Decoupled, generic undo/redo state management.

## The Layout Preset System

The application uses an externalized normalization system:
1. **External Loading**: Presets are loaded from `presets.json` via IPC on application mount.
2. **Slots**: Defined in normalized coordinates (0.0 to 1.0) relative to the margin box.
3. **Priorities**: Each slot has a priority used for automatic image mapping.
4. **Generic Fallback**: If no matching preset is found for an image count, the engine dynamically generates a grid.

## Physical-to-Pixel Conversion

Accuracy is critical for print-ready albums.
- **Physical Units**: User enters `12in x 12in`.
- **DPI**: System defaults to 300 DPI (configurable).
- **Pixel Canvas**: Calculated as `(units * DPI)`.
- **Zoom Engine**: 
    - **Auto-Fit**: Automatically scales the canvas to fit the viewport while accounting for 24px rulers and workspace padding.
    - **Pinch-to-Zoom**: Intuitive trackpad and wheel gestures for inspection.
    - **Smart Centering**: Automatically switches from flex-centering to top-left scrolling when the canvas exceeds the viewport size.

## Developer Commands

### Installation
```bash
npm install
```

### Development
Starts the Vite dev server and launches Electron:
```bash
npm run dev
```

### Building
Compiles the Svelte app and packages the Electron binary:
```bash
npm run build
```

### Testing
Runs the Vitest suite for logic and component validation:
```bash
npm test
```
