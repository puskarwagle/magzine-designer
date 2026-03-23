<script>
  import { zoomStore, isAutoFitStore, autoFitScaleStore } from '../../stores/ui.js';

  function zoomIn() {
    isAutoFitStore.set(false);
    zoomStore.update(z => Math.min(z + 0.1, 3.0));
  }

  function zoomOut() {
    isAutoFitStore.set(false);
    zoomStore.update(z => Math.max(z - 0.1, 0.1));
  }

  function fitToScreen() {
    isAutoFitStore.set(true);
  }

  function actualSize() {
    isAutoFitStore.set(false);
    zoomStore.set(1.0);
  }
</script>

<div class="zoom-controls">
  <button class="zoom-btn" title="Zoom Out" on:click={zoomOut}>−</button>
  <button class="zoom-btn" title="Zoom In" on:click={zoomIn}>+</button>
  <div class="divider"></div>
  <button 
    class="action-btn" 
    class:active={$isAutoFitStore} 
    on:click={fitToScreen}
  >Fit</button>
  <button 
    class="action-btn" 
    class:active={!$isAutoFitStore && $zoomStore === 1.0} 
    on:click={actualSize}
  >100%</button>
</div>

<style>
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid #334155;
    padding: 0.25rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  }

  .zoom-btn, .action-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.35rem 0.6rem;
    border-radius: 0.35rem;
    transition: all 0.2s;
  }

  .zoom-btn:hover, .action-btn:hover {
    background: #1e293b;
    color: #f8fafc;
  }

  .action-btn.active {
    background: #3b82f6;
    color: white;
  }

  .divider {
    width: 1px;
    height: 1.25rem;
    background: #334155;
    margin: 0 0.25rem;
  }
</style>
