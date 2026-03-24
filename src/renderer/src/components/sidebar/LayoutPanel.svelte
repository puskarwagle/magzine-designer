<script>
  import SidebarPanel from './SidebarPanel.svelte';
  import { 
    spreadsStore, 
    currentSpreadIndexStore, 
    activePageStore, 
    layoutModeStore,
    addSpread,
    removeSpread,
    destroySpread,
    isSpreadPopulated,
    shuffleAllImages
  } from '../../stores/spreads.js';
  import { projectStore } from '../../stores/project.js';
  import { layoutConfigStore } from '../../stores/ui.js';
  import { LayoutEngine } from '../../lib/layoutEngine.js';

  $: currentSpreadIndex = $currentSpreadIndexStore;
  $: activePage = $activePageStore;
  $: layoutMode = $layoutModeStore;
  $: currentSpread = $spreadsStore[currentSpreadIndex];

  let showDeleteConfirm = false;

  function cyclePreset() {
    spreadsStore.update(spreads => {
      const spread = spreads[currentSpreadIndex];
      if (!spread) return spreads;

      if (layoutMode === 'spread') {
        // Next preset for the whole spread pool
        const presets = LayoutEngine.getSpreadPresetsForCount(spread.imageIds.length);
        spread.currentPresetIndex = (spread.currentPresetIndex + 1) % presets.length;
      } else {
        // Next preset for the active page's subset
        const pageKey = activePage === 'left' ? 'leftPage' : 'rightPage';
        const pageImageIds = spread.imageIds.filter(id => spread.pageAssignments[id] === (activePage === 'left' ? 'left' : 'right'));
        const presets = LayoutEngine.getPresetsForCount(pageImageIds.length);
        
        // Ensure the sub-page state has a preset index
        if (spread[pageKey].currentPresetIndex === undefined) spread[pageKey].currentPresetIndex = 0;
        spread[pageKey].currentPresetIndex = (spread[pageKey].currentPresetIndex + 1) % presets.length;
      }
      return [...spreads];
    });
  }

  function shuffleImages() {
    shuffleAllImages();
  }

  function prevSpread() {
    currentSpreadIndexStore.update(i => Math.max(0, i - 1));
  }

  function nextSpread() {
    currentSpreadIndexStore.update(i => Math.min($spreadsStore.length - 1, i + 1));
  }

  function handleAdd() {
    // Always add a "page" if in single mode, or a "spread" if in spread mode.
    // addSpread logic now handles the "2 pages = 1 spread" conversion.
    addSpread(layoutMode === 'single' ? 'single' : 'spread');
  }

  function initiateDelete() {
    if (isSpreadPopulated(currentSpread)) {
      showDeleteConfirm = true;
    } else {
      destroySpread(currentSpreadIndex);
    }
  }

  function confirmRemove() {
    removeSpread(currentSpreadIndex);
    showDeleteConfirm = false;
  }

  function confirmDestroy() {
    destroySpread(currentSpreadIndex);
    showDeleteConfirm = false;
  }
</script>

<SidebarPanel>
  <h3 class="panel-header">Layout Controls</h3>

  <div class="form-row">
    <span class="label">Navigation</span>
    <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: center;">
      <button class="button secondary" on:click={prevSpread} disabled={currentSpreadIndex === 0}>←</button>
      <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center;">
        <span style="font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-transform: uppercase;">
          {currentSpread?.type === 'single' ? 'Page' : 'Spread'}
        </span>
        <span style="font-size: 1.1rem; font-weight: 700;">{currentSpreadIndex + 1}</span>
      </div>
      <button class="button secondary" on:click={nextSpread} disabled={currentSpreadIndex === $spreadsStore.length - 1}>→</button>
    </div>
  </div>

  {#if showDeleteConfirm}
    <div class="info-box danger" style="margin-bottom: 1rem; border: 1px solid #ef4444;">
      <p style="margin: 0 0 0.5rem 0; font-weight: 600;">Delete this {currentSpread.type}?</p>
      <p style="margin: 0 0 1rem 0; font-size: 0.75rem;">This entry contains images. Would you like to remove it (save for later) or destroy it permanently?</p>
      <div style="display: flex; gap: 0.5rem;">
        <button class="button secondary small" style="flex: 1;" on:click={confirmRemove}>Remove</button>
        <button class="button danger small" style="flex: 1;" on:click={confirmDestroy}>Destroy</button>
      </div>
      <button 
        class="button ghost small" 
        style="width: 100%; margin-top: 0.5rem;" 
        on:click={() => showDeleteConfirm = false}
      >Cancel</button>
    </div>
  {:else}
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
      <button class="button" style="flex: 2;" on:click={handleAdd}>
        + Add {layoutMode === 'single' ? 'Page' : 'Spread'}
      </button>
      <button 
        class="button secondary" 
        style="flex: 1; color: #ef4444;" 
        on:click={initiateDelete}
        title="Delete current {currentSpread?.type}"
      >
        ✕
      </button>
    </div>
  {/if}

  <div class="form-row">
    <span class="label">Layout Mode</span>
    <div style="display: flex; gap: 0.5rem;">
      <button
        class="button {layoutMode === 'single' ? '' : 'secondary'}"
        style="flex: 1;"
        on:click={() => layoutModeStore.set('single')}
      >Single Page</button>
      <button
        class="button {layoutMode === 'spread' ? '' : 'secondary'}"
        style="flex: 1;"
        on:click={() => layoutModeStore.set('spread')}
      >Cross Spread</button>
    </div>
  </div>

  {#if layoutMode === 'single' && currentSpread?.type === 'spread'}
    <div class="form-row">
      <span class="label">Active Page</span>
      <div style="display: flex; gap: 0.5rem;">
        <button 
          class="button {activePage === 'left' ? '' : 'secondary'}" 
          style="flex: 1;"
          on:click={() => activePageStore.set('left')}
        >Left Page</button>
        <button 
          class="button {activePage === 'right' ? '' : 'secondary'}" 
          style="flex: 1;"
          on:click={() => activePageStore.set('right')}
        >Right Page</button>
      </div>
    </div>
  {/if}
  <div class="panel-header sub">Engine Settings</div>

  <div class="form-row">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
      <span class="label" style="margin: 0;">Slot Gap</span>
      <span style="font-size: 0.75rem; color: #94a3b8;">{$layoutConfigStore.slotGap}px</span>
    </div>
    <input 
      type="range" 
      min="0" 
      max="80" 
      step="2"
      value={$layoutConfigStore.slotGap}
      on:input={(e) => layoutConfigStore.update(c => ({ ...c, slotGap: parseInt(e.target.value) }))}
      style="width: 100%; height: 6px; background: #334155; border-radius: 3px; appearance: none; cursor: pointer;"
    />
  </div>

  <div class="panel-header sub">Actions</div>
  
  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    <button class="button" on:click={cyclePreset}>Next Layout Preset</button>
    <button class="button secondary" on:click={shuffleImages}>Shuffle Images</button>
  </div>

  <div class="info-box" style="margin-top: 1rem; padding: 0.75rem; background: #1e293b; border-radius: 0.5rem; font-size: 0.8rem; color: #94a3b8;">
    <p style="margin: 0;"><strong>Tip:</strong> Use the ✕ button to remove or destroy a spread. Removed spreads are preserved in the background.</p>
  </div>
</SidebarPanel>

<style>
  .small {
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
  }
  .danger {
    background: #450a0a;
    color: #fecaca;
  }
  .ghost {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
  }
  .ghost:hover {
    background: #1e293b;
    color: white;
  }
</style>

