# Image Loading Plan for Konva Pages

This plan outlines the steps required to load local images onto Konva pages based on layout presets, ensuring proper aspect ratio handling and security compliance.

## Current Limitations
1.  **Local File Access:** Electron's web security prevents direct loading of local files (e.g., `file://` or absolute paths) in the renderer process.
2.  **Missing Dimensions:** Current image discovery (via IPC) does not capture image width and height, which are essential for aspect ratio calculations (fit/fill) in the `LayoutEngine`.

## Implementation Strategy

### 1. Main Process: Custom Protocol
Register a custom protocol (e.g., `sampat-img://`) in `src/main/main.js`. This protocol will serve local image files, bypassing standard web security restrictions.

-   **Location:** `src/main/main.js` within `app.whenReady()`.
-   **Action:** Use `protocol.registerFileProtocol` (or `protocol.handle` in newer Electron versions) to map `sampat-img://<absolute_path>` to the actual file on disk.

### 2. Main Process: IPC Handler Updates
Update `src/main/ipcHandlers.js` to enrich image data with dimensions and valid source URLs.

-   **Action:** Use Electron's `nativeImage.createFromPath(imagePath).getSize()` to retrieve width and height for each discovered image in `pick-folder` and `load-sample-folder`.
-   **Data Format:**
    ```javascript
    {
      id: "img-0",
      fileName: "photo.jpg",
      path: "/absolute/path/to/photo.jpg", // Kept for reference
      src: "sampat-img:///absolute/path/to/photo.jpg", // For renderer use
      width: 1200,
      height: 800
    }
    ```

### 3. Renderer Process: Update Stores
Ensure the `projectStore` correctly handles and stores the enriched image data.

-   **Location:** `src/renderer/src/stores/project.js`.
-   **Action:** Ensure `images` array in the store reflects the new data structure from IPC.

### 4. Renderer Process: Update Layout Engine
Verify that `LayoutEngine.js` uses the actual image dimensions for calculations.

-   **Location:** `src/renderer/src/lib/layoutEngine.js`.
-   **Action:** Confirm `applyPresetToPage` and `applyPresetToSpread` use `image.width` and `image.height` instead of falling back to default values.

### 5. Renderer Process: Update Konva Rendering
Update the `KonvaSlot` component to load images using the custom protocol source.

-   **Location:** `src/renderer/src/components/preview/KonvaSlot.svelte`.
-   **Action:** Use `imageData.src` for `img.src` instead of `imageData.path`.

## Verification Plan
1.  **Test Sample Folder:** Load the sample folder and verify that images appear in the sidebar and on the Konva stage.
2.  **Verify Layout:** Cycle through presets and ensure images are correctly fitted or filled within their slots based on their actual aspect ratios.
3.  **Check Security:** Ensure no console errors related to `Not allowed to load local resource`.
