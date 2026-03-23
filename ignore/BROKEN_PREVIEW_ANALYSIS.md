# Broken Preview Analysis

## 1. The Goal

The user wants to see a two-page spread view in the application's preview area. Initially, the application was only ever showing a single page, even when it should have been showing two.

## 2. The Core Problem

The preview area is controlled by the `PreviewArea.svelte` component. It only renders the `KonvaStage` (the component that draws the pages) if a Svelte store variable, `layout`, is truthy:

```svelte
<!-- src/renderer/src/components/preview/PreviewArea.svelte -->
$: layout = $activeSpreadLayout;
...
<div class="canvas-wrapper">
  {#if layout}
    <KonvaStage />
  {/if}
</div>
```

The application is currently in a state where `layout` is consistently `null` or `undefined`, causing the preview area to be blank. This is the mystery, as this state persists even after reverting code changes and restarting the development server.

## 3. The Failing Component: `activeSpreadLayout`

`layout` gets its value from the `activeSpreadLayout` store in `src/renderer/src/stores/spreads.js`. This is a Svelte `derived` store. A `derived` store that throws an error in its callback function will silently fail and return `undefined`.

The current version of this store has been modified to include extensive error handling to prevent silent failures. **This is the only file that has not been fully reverted to its original state.**

```javascript
// src/renderer/src/stores/spreads.js
export const activeSpreadLayout = derived(
  [spreadsStore, currentSpreadIndexStore, albumSettingsStore, projectStore, layoutModeStore],
  ([$spreads, $currentIndex, $settings, $project, $layoutMode]) => {
    try {
      // ... (calculation logic)
      
      const spread = $spreads[$currentIndex];
      // This check was added for debugging. It is not the cause.
      if (!spread) return { error: true, message: `Spread at index ${$currentIndex} does not exist.` };

      // ... (more calculation logic)

      return layoutData; // Should return a valid object
    } catch (e) {
      // This block should catch any error and return an error object
      console.error('Error in activeSpreadLayout derived store:', e);
      return { error: true, message: e.message };
    }
  }
);
```

Despite this, the store still provides a falsy value to the component, and neither the `console.error` nor the error objects are appearing. This suggests the derived store callback is not being executed or is aborting in an unexpected way.

## 4. Debugging Steps Taken (All Failed)

1.  **UI Controls:** My first action was to add UI controls to modify the `layoutModeStore`. This immediately caused the preview to disappear entirely.
2.  **Reverts:** All subsequent UI changes were reverted (`PreviewControls.svelte`, `PreviewArea.svelte`, `App.svelte`). The problem persisted.
3.  **Server Restart:** The user confirmed they stopped and restarted the `npm run dev` server. The problem persisted.
4.  **Error Instrumentation:** I instrumented `activeSpreadLayout` with `try/catch` blocks and explicit error returns for every conceivable failure path. The blank screen still persists, and no error messages are displayed, which should be impossible based on the code in `PreviewArea.svelte` and `spreads.js`.
5.  **State Verification:** I added a "Dump State" button to capture the live state of all stores that feed into `activeSpreadLayout`. The user provided the output, and all store values were valid and correct.
6.  **Refactoring (Reverted):** As a last resort, I completely refactored `activeSpreadLayout` from a `derived` store to a `writable` store with manual update logic. This also failed to solve the issue. This change has been reverted.

## 5. Hypothesis

The only remaining explanation is that there is a fundamental, non-obvious problem in the Svelte reactivity chain or the module loading order that was triggered by the very first code change. The development environment has entered a persistent broken state that is not being cleared by standard procedures. The issue likely lies within the interaction between `spreads.js`, `layoutEngine.js`, and the Svelte runtime itself. The silent failure of the `derived` store, even with explicit error handling, is the primary mystery to be solved.

## 6. Key Files for Investigation

*   `src/renderer/src/stores/spreads.js`: The source of the problem. Why is `activeSpreadLayout` failing?
*   `src/renderer/src/components/preview/PreviewArea.svelte`: The consumer of the failing store.
*   `src/renderer/src/lib/layoutEngine.js`: A likely source of an error within the store's callback.
*   `src/renderer/src/App.svelte`: The root component.
*   `presets.json`: The data source for the layout engine.
