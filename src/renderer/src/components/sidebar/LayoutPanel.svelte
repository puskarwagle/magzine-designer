<script>
  import SidebarPanel from './SidebarPanel.svelte';
  import { spreadsStore, currentSpreadIndexStore, activePageStore, layoutModeStore } from '../../stores/spreads.js';
  import { projectStore } from '../../stores/project.js';
  import { LayoutEngine } from '../../lib/layoutEngine.js';

  $: currentSpreadIndex = $currentSpreadIndexStore;
  $: activePage = $activePageStore;
  $: layoutMode = $layoutModeStore;

  function cyclePreset() {
    spreadsStore.update(spreads => {
      const spread = spreads[currentSpreadIndex];
      if (!spread) return spreads;

      if (layoutMode === 'spread') {
        spread.spreadPage = LayoutEngine.nextPreset(spread.spreadPage);
      } else {
        if (activePage === 'left') {
          spread.leftPage = LayoutEngine.nextPreset(spread.leftPage);
        } else {
          spread.rightPage = LayoutEngine.nextPreset(spread.rightPage);
        }
      }
      return [...spreads];
    });
  }

  function shuffleImages() {
    spreadsStore.update(spreads => {
      const spread = spreads[currentSpreadIndex];
      if (!spread) return spreads;

      if (layoutMode === 'spread') {
        spread.spreadPage.imageIds = LayoutEngine.shuffleImagesInPreset(spread.spreadPage.imageIds);
      } else {
        if (activePage === 'left') {
          spread.leftPage.imageIds = LayoutEngine.shuffleImagesInPreset(spread.leftPage.imageIds);
        } else {
          spread.rightPage.imageIds = LayoutEngine.shuffleImagesInPreset(spread.rightPage.imageIds);
        }
      }
      return [...spreads];
    });
  }

  function toggleLayoutMode() {
    layoutModeStore.update(m => m === 'single' ? 'spread' : 'single');
  }

  function setActivePage(side) {
    activePageStore.set(side);
  }

  function prevSpread() {
    currentSpreadIndexStore.update(i => Math.max(0, i - 1));
  }

  function nextSpread() {
    currentSpreadIndexStore.update(i => Math.min($spreadsStore.length - 1, i + 1));
  }
</script>

<SidebarPanel>
  <h3 class="panel-header">Layout Controls</h3>

  <div class="form-row">
    <span class="label">Navigation</span>
    <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: center;">
      <button class="button secondary" on:click={prevSpread} disabled={currentSpreadIndex === 0}>←</button>
      <span style="font-size: 0.9rem; font-weight: 600;">Spread {currentSpreadIndex + 1}</span>
      <button class="button secondary" on:click={nextSpread} disabled={currentSpreadIndex === $spreadsStore.length - 1}>→</button>
    </div>
  </div>

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

  <!-- New Spreads Count Selector -->
  <div class="form-row">
    <span class="label">Spreads Count</span>
    <select
      class="input"
      value={$projectStore.spreadsCount}
      on:change={(e) => projectStore.update(p => ({...p, spreadsCount: parseInt(e.target.value, 10)}))}
    >
      {#each Array(50).fill(0) as _, i}
        <option value={i + 1}>{i + 1}</option>
      {/each}
    </select>
  </div>
  {#if layoutMode === 'single'}
    <div class="form-row">
      <span class="label">Active Page</span>
      <div style="display: flex; gap: 0.5rem;">
        <button 
          class="button {activePage === 'left' ? '' : 'secondary'}" 
          style="flex: 1;"
          on:click={() => setActivePage('left')}
        >Left Page</button>
        <button 
          class="button {activePage === 'right' ? '' : 'secondary'}" 
          style="flex: 1;"
          on:click={() => setActivePage('right')}
        >Right Page</button>
      </div>
    </div>
  {/if}

  <div class="panel-header sub">Actions</div>
  
  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    <button class="button" on:click={cyclePreset}>Next Layout Preset</button>
    <button class="button secondary" on:click={shuffleImages}>Shuffle Images</button>
  </div>

  <div class="info-box" style="margin-top: 1rem; padding: 0.75rem; background: #1e293b; border-radius: 0.5rem; font-size: 0.8rem; color: #94a3b8;">
    <p style="margin: 0;"><strong>Tip:</strong> You can drag images from the Folder panel onto the page to add them.</p>
  </div>
</SidebarPanel>
