# Sampat: Professional Album Layout Engine

## Project Overview
Sampat is a high-performance Electron desktop application for designing professional photo albums. It uses a **Data-Driven UI** architecture where a centralized reactive state (Svelte 5) drives a stateless geometry engine to render pixel-perfect layouts on an HTML5 Canvas (Konva.js).

The app supports precise physical dimensions (Inches/CM), high-DPI rendering (300 DPI default), automatic layout mapping via priority-based presets, and a sophisticated zoom/pan engine for high-resolution inspection.

---

## 📂 Project Structure
```text
sampat/
├── src/
│   ├── main/                 # Electron Main Process (Node.js)
│   │   ├── main.js           # Window & Lifecycle management
│   │   └── ipcHandlers.js    # Native Bridge (Filesystem, Dialogs)
│   ├── preload/              # Security Bridge (Context Isolation)
│   │   └── preload.js        # Exposed API for the Frontend
│   └── renderer/             # Svelte 5 Frontend
│       ├── src/
│       │   ├── assets/       # Global CSS & Static Icons
│       │   ├── components/   # UI Modules
│       │   │   ├── preview/  # Canvas Engine (Konva.js)
│       │   │   ├── sidebar/  # Functional Panels (Folder, Layout, etc.)
│       │   │   └── ui/       # Shared UI Components
│       │   ├── lib/          # Pure Logic & Engines
│       │   │   ├── layoutEngine.js # Geometry & Preset Mapping
│       │   │   └── utils.js        # Unit Conversions (px/in/cm)
│       │   ├── stores/       # Reactive State (Svelte Stores)
│       │   │   ├── project.js    # Image Pool & Global Settings
│       │   │   ├── spreads.js    # THE BRAIN (Layout Calculations)
│       │   │   └── ui.js         # Viewport & UI State
│       │   └── main.js       # App Entry Point
├── presets.json              # Source of Truth for Layout Presets
└── vitest.config.js          # Testing Configuration
```

---

## 🏆 Top 10 Important Files (The "Developer's Map")

If you are an AI agent or a developer looking to fix or extend this app, start here:

1.  **`src/renderer/src/stores/spreads.js` (The Brain)**  
    Contains the `activeSpreadLayout` derived store. It listens to project settings and spread data, then triggers the `layoutEngine` to recalculate all coordinates. **Look here for state management of pages and slots.**

2.  **`src/renderer/src/lib/layoutEngine.js` (Geometry Logic)**  
    The stateless engine that does the math. It takes raw spread data and maps it to the `presets.json` slots. **Look here to change how images are positioned or how presets are applied.**

3.  **`src/renderer/src/components/preview/PreviewArea.svelte` (Zoom & Viewport)**  
    Manages the workspace "camera." It handles pinch-to-zoom, auto-fit logic, and keeps the CSS page and Konva canvas synchronized. **Look here for viewport, panning, or zoom-to-focus bugs.**

4.  **`src/renderer/src/components/preview/KonvaStage.svelte` (Canvas Entry)**  
    The bridge between Svelte and Konva.js. It handles high-level canvas events like drag-and-drop image placement and renders the spread layers. **Look here for canvas interaction logic.**

5.  **`src/renderer/src/lib/utils.js` (The Ruler)**  
    The single source of truth for physical-to-pixel conversions (`toPixels`). It ensures that 12 inches is exactly 3600 pixels at 300 DPI across the entire app. **Look here for unit or dimension issues.**

6.  **`src/main/ipcHandlers.js` (Native Bridge)**  
    Handles filesystem access (loading images from folders) and reading the `presets.json`. **Look here if images aren't loading or the app can't talk to the OS.**

7.  **`src/renderer/src/stores/project.js` (Asset Manager)**  
    Manages the global image pool and project initialization. It tracks which images are "used" vs. "unused." **Look here for image library state.**

8.  **`src/renderer/src/components/sidebar/FolderPanel.svelte` (Image UI)**  
    The sidebar panel for the image library. Includes sophisticated "dynamic expansion" logic for handling folders with hundreds of high-res images without crashing. **Look here for image UI bugs.**

9.  **`presets.json` (Layout Definitions)**  
    A JSON file defining normalized (0.0 to 1.0) coordinates for every layout. **Look here to add new layout templates.**

10. **`src/renderer/src/stores/ui.js` (UI State)**  
    Tracks the active panel, sidebar expansion, and the `zoomStore`. **Look here for general UI/UX behavior changes.**

---

## 🛠 Tech Stack
- **Electron**: Desktop environment.
- **Svelte 5**: Modern reactive UI (transitioning to Runes).
- **Konva.js**: High-performance 2D Canvas rendering via `svelte-konva`.
- **Vite**: Ultra-fast build tool and dev server.
- **Vitest**: Unit and component testing.

---

## 💡 Developer Workflows & AI Tips

### How to change the Layout?
Do not modify the components. Instead, modify `layoutEngine.js` or the `presets.json`. The UI will automatically react to the data changes via the `activeSpreadLayout` store.

### How to fix Zoom/Pan issues?
Check `PreviewArea.svelte`. The app uses a complex "auto-fit" system that balances CSS centering with Konva scaling. The `ui.js` store holds the raw zoom values, but `PreviewArea` handles the gesture interpretation.

### Adding a New Sidebar Panel?
1. Create a component in `src/renderer/src/components/sidebar/panels/`.
2. Add a new `View` type in `src/renderer/src/stores/ui.js`.
3. Update `SidebarNav.svelte` and `Sidebar.svelte` to include the new icon and panel mapping.

---

## 🚀 Commands
- `npm install`: Setup dependencies.
- `npm run dev`: Launch the app in development mode.
- `npm run test`: Run the full test suite.
- `npm run build`: Package the app for distribution.
