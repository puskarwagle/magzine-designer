<h1 align="center">Album Layout Demo</h1>
<p align="center">Professional data-driven album layout engine for desktop high-precision design.</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.1.0-blue" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
  <img alt="platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" />
</p>

---

## Overview
Album Layout Demo (Sampat) is a high-performance desktop application for designing professional photo albums with pixel-perfect precision. It solves the complexity of manual photo arrangement by using a stateless geometry engine that maps image pools to dynamic recursive partitions. Built for professional photographers and designers, it balances creative control with automated layout intelligence.

## Features
- **Dynamic Recursive Partitioning**: Automatically generate balanced, hero, or "chaos" layouts based on image count and aspect ratios.
- **High-DPI Canvas rendering**: 300 DPI workspace powered by Konva.js and Svelte 5 for high-resolution inspection.
- **Unified Spread Logic**: Seamlessly toggle between single-page and cross-gutter spread views while maintaining stable geometry.
- **Physical Precision**: True-to-scale conversions between Inches/CM and Pixels for exact print-ready dimensions.
- **Orientation-Aware Mapping**: Intelligent slot matching that respects image aspect ratios (Portrait, Landscape, Square).
- **History Management**: Full undo/redo stack for all layout transformations and image placement actions.
- **Secure Native Integration**: Electron-based IPC bridge for high-speed local filesystem access.

## Screenshots
<!-- Placeholder — add screenshots here -->

## Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **OS**: Windows 10+, macOS 11+, or modern Linux distribution

### Build from Source
```bash
# Clone the repository
git clone https://github.com/puskarwagle/magzine-designer.git
cd magzine-designer

# Install dependencies
npm install

# Launch development environment (Vite + Electron)
npm run dev
```

## Usage
1. **Initialize Project**: Define page dimensions and margins in the settings panel.
2. **Import Images**: Drag folders or files into the library panel to populate the image pool.
3. **Design Spreads**: Drag images onto the workspace; the engine will automatically suggest optimal layouts.
4. **Cycle Presets**: Use the layout control to cycle through different geometry presets for the same image selection.
5. **Shuffle Content**: Randomize image distribution across slots or pages to explore diverse visual patterns.

## Configuration
- **`presets.json`**: Define custom layout templates using normalized [0,1] coordinates.
- **State Management**: Reactive parameters (DPI, units, margins) are managed via Svelte stores in `src/renderer/src/stores/`.

## Project Structure
```text
├── src/
│   ├── main/           # Electron main process & IPC handlers
│   ├── preload/        # Secure security bridge (Context Isolation)
│   └── renderer/       # Svelte 5 frontend & UI components
│       ├── lib/        # Core geometry and layout engines
│       ├── stores/     # Reactive state management (Runes/Stores)
│       └── components/ # UI modules (Preview, Sidebar, Toolbars)
├── presets.json        # Standardized layout definitions
├── vitest.config.js    # Unit and integration test configuration
└── package.json        # App manifest and dependency graph
```

## Contributing
- Fork the repo
- Create a feature branch
- Submit a PR with a clear description
- Ensure all tests pass with `npm run test`

## License
This project is currently distributed under the MIT License. See the [LICENSE](LICENSE) file for details. (Note: No LICENSE file currently exists in the root).
