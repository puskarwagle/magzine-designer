<script>
  import { onMount, onDestroy } from 'svelte';
  import { spreadsStore, currentSpreadIndexStore, activeSpreadLayout } from '../../stores/spreads.js';
  import { albumSettingsStore } from '../../stores/settings.js';
  import { zoomStore, isAutoFitStore, autoFitScaleStore } from '../../stores/ui.js';
  import { toPixels } from '../../lib/utils.js';
  import PreviewControls from './PreviewControls.svelte';
  import KonvaStage from './KonvaStage.svelte';

  $: currentSpreadIndex = $currentSpreadIndexStore;
  $: layout = $activeSpreadLayout;
  $: settings = $albumSettingsStore;

  $: spreadWidthPx = layout.totalSpreadWidthPx || 1000;
  $: spreadHeightPx = layout.spreadHeightPx || 500;
  
  let viewport;
  const PADDING = 60;

  function calculateAutoFit() {
    if (!viewport || !spreadWidthPx || !spreadHeightPx) return;
    
    const availableWidth = viewport.clientWidth - (PADDING * 2);
    const availableHeight = viewport.clientHeight - (PADDING * 2);
    
    const scaleX = availableWidth / spreadWidthPx;
    const scaleY = availableHeight / spreadHeightPx;
    
    const scale = Math.min(scaleX, scaleY, 1.0); // Don't scale up beyond 100% in autofit
    autoFitScaleStore.set(scale);
    
    if ($isAutoFitStore) {
      zoomStore.set(scale);
    }
  }

  let resizeObserver;

  onMount(() => {
    resizeObserver = new ResizeObserver(() => {
      calculateAutoFit();
    });
    if (viewport) {
      resizeObserver.observe(viewport);
    }
    // Initial calc
    calculateAutoFit();
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });

  // Re-calculate if layout changes or autofit is toggled
  $: if (spreadWidthPx || spreadHeightPx || $isAutoFitStore) {
    calculateAutoFit();
  }

  function handleWheel(e) {
    if (e.ctrlKey) {
      e.preventDefault();
      isAutoFitStore.set(false);
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.1 : 0.9;
      zoomStore.update(z => {
        const newZoom = z * factor;
        return Math.min(Math.max(newZoom, 0.05), 5.0);
      });
    }
  }

  $: currentZoom = $zoomStore;
  $: isAutoFit = $isAutoFitStore;
</script>

<div class="preview-container">
  <div 
    class="preview-viewport" 
    bind:this={viewport}
    on:wheel|nonpassive={handleWheel}
  >
    <div 
      class="preview-scroller" 
      class:is-autofit={isAutoFit}
    >
      <div 
        class="preview-shell"
        style="width: {spreadWidthPx * currentZoom}px; height: {spreadHeightPx * currentZoom}px;"
      >
        <div class="canvas-wrapper" style="border: 4px solid yellow; background: rgba(255, 255, 0, 0.1);">
          {#if layout.error}
            <div class="status-overlay error">
              <span class="status-icon">⚠️</span>
              <p>{layout.message}</p>
            </div>
          {:else if layout.loading}
            <div class="status-overlay loading">
              <div class="spinner"></div>
              <p>Preparing layout...</p>
            </div>
          {:else}
            <KonvaStage />
          {/if}
        </div>
      </div>
    </div>
  </div>
  
  <div class="preview-footer">
    <div class="preview-spread-label">
      Spread {currentSpreadIndex + 1} of {$spreadsStore.length}
      <span class="zoom-text">({Math.round(currentZoom * 100)}%)</span>
    </div>
    <PreviewControls />
  </div>
</div>

<style>
  .preview-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: #0f172a;
    background-image: 
      radial-gradient(#1e293b 1px, transparent 1px),
      radial-gradient(#1e293b 1px, transparent 1px);
    background-size: 40px 40px;
    background-position: 0 0, 20px 20px;
    border-radius: 0.5rem;
    border: 1px solid #1e293b;
    overflow: hidden;
    position: relative;
    box-shadow: inset 0 0 40px rgba(0,0,0,0.2);
  }

  .preview-viewport {
    flex: 1;
    overflow: auto;
    display: block;
    min-height: 0;
  }

  .preview-scroller {
    display: flex;
    min-width: 100%;
    min-height: 100%;
    padding: 60px;
    align-items: center;
    justify-content: center;
  }

  .preview-scroller:not(.is-autofit) {
    align-items: flex-start;
    justify-content: flex-start;
  }

  .preview-shell {
    position: relative;
    flex: 0 0 auto;
    background: #1e293b;
    transition: width 0.1s ease-out, height 0.1s ease-out;
  }

  .canvas-wrapper {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .status-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(4px);
    color: white;
    text-align: center;
    padding: 2rem;
    z-index: 50;
  }

  .status-overlay.error {
    border: 2px solid #ef4444;
  }

  .status-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .preview-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 1rem;
    background: rgba(2, 6, 23, 0.8);
    backdrop-filter: blur(8px);
    border-top: 1px solid #1e293b;
    width: 100%;
  }

  .preview-spread-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #cbd5e1;
    min-width: 12rem;
    text-align: center;
  }

  .zoom-text {
    margin-left: 0.5rem;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }
</style>
