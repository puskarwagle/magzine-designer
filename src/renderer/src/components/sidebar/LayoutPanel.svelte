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
    shuffleCurrentSpread
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

      // Always cycle the main preset index for the spread
      // A "spread" is our core data unit, even if we view it page-by-page.
      const presets = spread.type === 'spread' 
        ? LayoutEngine.getSpreadPresetsForCount(spread.imageIds.length) 
        : LayoutEngine.getPresetsForCount(spread.imageIds.length);

      spread.currentPresetIndex = (spread.currentPresetIndex + 1) % presets.length;
      return [...spreads];
    });
  }

  function shuffleImages() {
    shuffleCurrentSpread();
  }

  function nextView() {
    if (layoutMode === 'single') {
      if (activePage === 'left' && currentSpread?.type === 'spread') {
        activePageStore.set('right');
      } else {
        if (currentSpreadIndex < $spreadsStore.length - 1) {
          currentSpreadIndexStore.set(currentSpreadIndex + 1);
          activePageStore.set('left');
        }
      }
    } else {
      currentSpreadIndexStore.update(i => Math.min($spreadsStore.length - 1, i + 1));
    }
  }

  function prevView() {
    if (layoutMode === 'single') {
      if (activePage === 'right') {
        activePageStore.set('left');
      } else {
        if (currentSpreadIndex > 0) {
          currentSpreadIndexStore.set(currentSpreadIndex - 1);
          const prevSpread = $spreadsStore[currentSpreadIndex - 1];
          activePageStore.set(prevSpread.type === 'spread' ? 'right' : 'left');
        }
      }
    } else {
      currentSpreadIndexStore.update(i => Math.max(0, i - 1));
    }
  }

  $: totalPages = $spreadsStore.reduce((acc, s) => acc + (s.type === 'spread' ? 2 : 1), 0);
  $: currentPageNumber = (() => {
    let count = 0;
    for (let i = 0; i < currentSpreadIndex; i++) {
        count += $spreadsStore[i].type === 'spread' ? 2 : 1;
    }
    return count + (activePage === 'left' ? 1 : 2);
  })();

  function handleAdd() {
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
      <button class="button secondary" on:click={prevView} disabled={currentSpreadIndex === 0 && (layoutMode === 'spread' || activePage === 'left')}>←</button>
      <div style="flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center;">
        <span style="font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-transform: uppercase;">
          {layoutMode === 'single' ? 'Page' : 'Spread'}
        </span>
        <span style="font-size: 1.1rem; font-weight: 700;">
          {layoutMode === 'single' ? currentPageNumber : currentSpreadIndex + 1}
          <span style="color: #64748b; font-weight: 400; font-size: 0.9rem;">
            / {layoutMode === 'single' ? totalPages : $spreadsStore.length}
          </span>
        </span>
      </div>
      <button class="button secondary" on:click={nextView} disabled={currentSpreadIndex === $spreadsStore.length - 1 && (layoutMode === 'spread' || activePage === 'right' || currentSpread?.type === 'single')}>→</button>
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

