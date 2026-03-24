<script>
  import SidebarPanel from './SidebarPanel.svelte';
  import { projectStore, activeFoldersStore, activeImagesStore } from '../../stores/project.js';
  import { 
    spreadsStore, 
    currentSpreadIndexStore, 
    activePageStore, 
    layoutModeStore,
    addSpread,
    removeSpread,
    destroySpread,
    isSpreadPopulated,
    shuffleCurrentSpread,
    addImageToCurrentSpread,
    usedImageIdsStore
  } from '../../stores/spreads.js';
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

  // --- Image Integration ---
  $: activeFolders = $activeFoldersStore;
  $: activeImages = $activeImagesStore;
  $: allImages = $projectStore.images;
  
  $: folderImages = (() => {
    const pool = new Set();
    
    // Add all images from selected folders
    allImages.forEach(img => {
      if (activeFolders.has(img.source)) {
        pool.add(img);
      }
    });
    
    // Add specifically selected images
    allImages.forEach(img => {
      if (activeImages.has(img.id)) {
        pool.add(img);
      }
    });
    
    return Array.from(pool);
  })();

  let visibleCount = 24;
  $: visibleImages = folderImages.slice(0, visibleCount);

  function handleLoadMore() {
    visibleCount += 20;
  }

  function handleImageClick(imgId) {
    addImageToCurrentSpread(imgId);
  }

  function handleDragStart(e, imgId) {
    e.dataTransfer.setData('imageId', imgId);
    e.dataTransfer.effectAllowed = 'copy';
  }

  // Auto-load more when scrolling near bottom
  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (visibleCount < folderImages.length) {
        handleLoadMore();
      }
    }
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
    <div class="info-box danger compact">
      <p>Delete {currentSpread.type}?</p>
      <div style="display: flex; gap: 0.25rem;">
        <button class="button secondary small" style="flex: 1;" on:click={confirmRemove}>Remove</button>
        <button class="button danger small" style="flex: 1;" on:click={confirmDestroy}>Destroy</button>
      </div>
      <button class="button ghost small" style="width: 100%; margin-top: 0.25rem;" on:click={() => showDeleteConfirm = false}>Cancel</button>
    </div>
  {:else}
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
      <button class="button" style="flex: 1;" on:click={handleAdd}>
        + {layoutMode === 'single' ? 'Page' : 'Spread'}
      </button>
      <button 
        class="button secondary" 
        on:click={initiateDelete}
        title="Delete"
        style="padding: 0 12px; color: #ef4444;"
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

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem;">
    <button class="button" on:click={cyclePreset}>Next Layout</button>
    <button class="button secondary" on:click={shuffleImages}>Shuffle</button>
  </div>


  {#if folderImages.length > 0}
    <div class="panel-header sub album-images-header">
      <span>Active Pool</span>
      <span class="count-badge">{folderImages.length}</span>
    </div>

    <div class="album-images-container" on:scroll={handleScroll}>
      <div class="image-grid">
        {#each visibleImages as img (img.id)}
          <div 
            class="image-thumb" 
            class:used={$usedImageIdsStore.has(img.id)}
            draggable="true"
            on:dragstart={(e) => handleDragStart(e, img.id)}
            on:click={() => handleImageClick(img.id)}
            role="button"
            tabindex="0"
            on:keydown={(e) => e.key === 'Enter' && handleImageClick(img.id)}
          >
            <img src={img.path} alt={img.fileName || img.id} loading="lazy" />
          </div>
        {/each}
      </div>
      
      {#if visibleCount < folderImages.length}
        <button class="button ghost small load-more" on:click={handleLoadMore}>
          Load More (+{folderImages.length - visibleCount})
        </button>
      {/if}
    </div>
  {:else}
    <div class="info-box" style="margin-top: 2rem; text-align: center;">
      <p style="margin-bottom: 0.5rem; color: #64748b;">No selection</p>
      <p style="font-size: 0.75rem;">Select folders or individual photos in the <strong>Photos</strong> menu to populate your layout pool.</p>
    </div>
  {/if}
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

  .album-images-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #1e293b;
  }

  .count-badge {
    font-size: 0.7rem;
    background: #2563eb;
    color: white;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .album-images-container {
    max-height: 400px;
    overflow-y: auto;
    margin-top: 0.5rem;
    padding-right: 4px;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.25rem;
  }

  .album-images-container {
    max-height: 550px;
    overflow-y: auto;
    margin-top: 0.5rem;
    padding-right: 4px;
  }

  .compact p {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .image-thumb {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    background: #0f172a;
    border: 1px solid #1e293b;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .image-thumb:hover {
    border-color: #3b82f6;
    transform: scale(1.05);
  }

  .image-thumb.used {
    border: 3px solid #10b981;
    opacity: 0.6;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
  }

  .image-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .load-more {
    width: 100%;
    margin-top: 0.75rem;
    margin-bottom: 2rem;
  }

  /* Custom scrollbar for the image container */
  .album-images-container::-webkit-scrollbar {
    width: 4px;
  }
  .album-images-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .album-images-container::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 2px;
  }
</style>

