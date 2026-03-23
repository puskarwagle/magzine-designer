# Sidebar Expansion Plan

This plan outlines the steps to expand the sidebar from 4 panels to a full set of 15 panels while maintaining the functionality of the existing 4 panels.

## 1. Store Updates (`src/renderer/src/stores/ui.js`)
The `currentMenuStore` already supports string IDs, so no structural changes are needed. However, we will ensure all 15 panel IDs are defined as valid states.

**Panel IDs:**
- `folder` (Existing: Images)
- `layout` (Existing)
- `size` (Existing)
- `export` (Existing)
- `backgrounds`
- `themes`
- `text`
- `shapes`
- `frames`
- `clipart`
- `stickers`
- `borders`
- `overlays`
- `color-grading`
- `settings`

## 2. Reusable `ComingSoon.svelte` Component
A new component will be created at `src/renderer/src/components/ui/ComingSoon.svelte`.

**Design Goals:**
- Centered layout within the panel area.
- Subtle, professional aesthetic (dark mode compatible).
- Displays the panel's icon (large), the name of the panel, and a "Coming Soon" badge/label.
- CSS transitions for a smooth appearance.

## 3. New Sidebar Panels
New panels will be created in `src/renderer/src/components/sidebar/panels/`. Each will be a thin wrapper around `ComingSoon.svelte`.

**Files to create:**
- `src/renderer/src/components/sidebar/panels/BackgroundsPanel.svelte`
- `src/renderer/src/components/sidebar/panels/ThemesPanel.svelte`
- `src/renderer/src/components/sidebar/panels/TextPanel.svelte`
- `src/renderer/src/components/sidebar/panels/ShapesPanel.svelte`
- `src/renderer/src/components/sidebar/panels/FramesPanel.svelte`
- `src/renderer/src/components/sidebar/panels/ClipartPanel.svelte`
- `src/renderer/src/components/sidebar/panels/StickersPanel.svelte`
- `src/renderer/src/components/sidebar/panels/BordersPanel.svelte`
- `src/renderer/src/components/sidebar/panels/OverlaysPanel.svelte`
- `src/renderer/src/components/sidebar/panels/ColorGradingPanel.svelte`
- `src/renderer/src/components/sidebar/panels/SettingsPanel.svelte`

## 4. Sidebar Navigation Expansion (`src/renderer/src/components/sidebar/SidebarNav.svelte`)
The `menuItems` array will be expanded to include all 15 items with appropriate icons.

**Scrollable Navigation:**
- The `.side-nav` container will be updated to handle overflow.
- `overflow-y: auto` will be added for vertical layouts.
- `scrollbar-width: thin` and custom scrollbar styling to keep it clean.
- Ensure the navigation doesn't push the panel content out of view.

## 5. Sidebar Panel Integration (`src/renderer/src/components/sidebar/Sidebar.svelte`)
The main `Sidebar.svelte` will be updated to import and conditionally render all new panels.

**Implementation Detail:**
- Use a dynamic component approach or a clean set of `{#if activeMenu === '...'}` blocks.
- Ensure the existing 4 panels (`FolderPanel`, `SizePanel`, `LayoutPanel`, `ExportPanel`) remain in their current location in `src/renderer/src/components/sidebar/` and are untouched.

## Summary of New Files
| File Path | Description |
|-----------|-------------|
| `src/renderer/src/components/ui/ComingSoon.svelte` | Reusable placeholder component |
| `src/renderer/src/components/sidebar/panels/BackgroundsPanel.svelte` | Placeholder for Backgrounds |
| `src/renderer/src/components/sidebar/panels/ThemesPanel.svelte` | Placeholder for Themes |
| `src/renderer/src/components/sidebar/panels/TextPanel.svelte` | Placeholder for Text |
| `src/renderer/src/components/sidebar/panels/ShapesPanel.svelte` | Placeholder for Shapes |
| `src/renderer/src/components/sidebar/panels/FramesPanel.svelte` | Placeholder for Frames |
| `src/renderer/src/components/sidebar/panels/ClipartPanel.svelte` | Placeholder for Clipart |
| `src/renderer/src/components/sidebar/panels/StickersPanel.svelte` | Placeholder for Stickers |
| `src/renderer/src/components/sidebar/panels/BordersPanel.svelte` | Placeholder for Borders |
| `src/renderer/src/components/sidebar/panels/OverlaysPanel.svelte` | Placeholder for Overlays |
| `src/renderer/src/components/sidebar/panels/ColorGradingPanel.svelte` | Placeholder for Color Grading |
| `src/renderer/src/components/sidebar/panels/SettingsPanel.svelte` | Placeholder for Settings |
