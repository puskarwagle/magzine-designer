<script>
  import { projectStore, addImagesToProject } from '../../stores/project.js';
  import SidebarPanel from './SidebarPanel.svelte';

  async function handlePickFolder() {
    try {
      const result = await window.api.pickFolder();
      if (result && result.folderPath) {
        addImagesToProject(result);
      }
    } catch (error) {
      console.error('Error picking folder:', error);
    }
  }

  function handleDragStart(e, img) {
    e.dataTransfer.setData('imageId', img.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  $: images = $projectStore.images;
  $: folderPath = $projectStore.folderPath;

  // Configuration for dynamic expansion
  const INITIAL_VISIBLE = 5;
  const EXPANSION_RATE = 0.2; // Show 20% of remaining each click
  const MIN_INCREMENT = 10;  // Never show fewer than 10 additional images

  // Track visible count per source group
  let visibleCounts = {};

  // Group images by source
  $: groups = images.reduce((acc, img) => {
    const source = img.source || 'Unknown';
    if (!acc[source]) acc[source] = [];
    acc[source].push(img);
    
    // Initialize visible count if not set
    if (visibleCounts[source] === undefined) {
      visibleCounts[source] = INITIAL_VISIBLE;
    }
    return acc;
  }, {});

  function expandGroup(source, total) {
    const current = visibleCounts[source] || INITIAL_VISIBLE;
    const remaining = total - current;
    
    if (remaining <= 0) return;

    // Dynamic increment: % of what's hidden, with a floor to prevent tiny reveals
    const increment = Math.max(MIN_INCREMENT, Math.floor(remaining * EXPANSION_RATE));

    visibleCounts[source] = current + increment;
  }

  function resetGroup(source) {
    visibleCounts[source] = INITIAL_VISIBLE;
  }
</script>

<SidebarPanel>
  <h3 class="panel-header">Photos</h3>
  
  <div class="form-row">
    <label for="folder-path">Folder Path</label>
    <div style="display: flex; gap: 0.5rem;">
      <input 
        type="text" 
        id="folder-path" 
        value={folderPath || 'No folder selected'} 
        readonly 
        style="flex: 1;"
      />
      <button class="button secondary" on:click={handlePickFolder}>Select</button>
    </div>
    <p class="form-hint">Add local folders or sample images to your library.</p>
  </div>

  {#each Object.entries(groups) as [source, groupImages]}
    {@const visibleLimit = visibleCounts[source] || INITIAL_VISIBLE}
    <div class="panel-header sub group-header">
      <span>{source}</span>
      {#if visibleLimit > INITIAL_VISIBLE}
        <button 
          class="collapse-btn" 
          title="Collapse group" 
          on:click={() => resetGroup(source)}
        >
          ^
        </button>
      {/if}
    </div>
    
    <div class="image-pool-grid">
      {#each groupImages.slice(0, visibleLimit) as img (img.id)}
        <div 
          class="thumb" 
          title={img.fileName || img.id}
          draggable="true"
          role="button"
          tabindex="0"
          on:dragstart={(e) => handleDragStart(e, img)}
        >
          <img src={img.path} alt={img.fileName || img.id} loading="lazy" />
        </div>
      {/each}
      
      {#if groupImages.length > visibleLimit}
        {@const remainingCount = groupImages.length - visibleLimit}
        <div 
          class="thumb more" 
          title="See more"
          draggable="true"
          role="button"
          tabindex="0"
          on:dragstart={(e) => handleDragStart(e, groupImages[visibleLimit])}
          on:click={() => expandGroup(source, groupImages.length)}
          on:keydown={(e) => e.key === 'Enter' && expandGroup(source, groupImages.length)}
        >
          <img src={groupImages[visibleLimit].path} alt="More images" class="blurred" />
          <div class="overlay">+{remainingCount}</div>
        </div>
      {/if}
    </div>
  {/each}
</SidebarPanel>

<style>
  .image-pool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 0.5rem;
    padding-bottom: 1rem;
    padding-right: 0.5rem;
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .collapse-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.2s;
  }

  .collapse-btn:hover {
    color: #3b82f6;
  }

  .thumb {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    background: #1e293b;
    border: 1px solid #334155;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .thumb:hover {
    border-color: #3b82f6;
    transform: scale(1.05);
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumb.more .blurred {
    filter: blur(4px) brightness(0.7);
  }

  .thumb.more .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }
</style>
