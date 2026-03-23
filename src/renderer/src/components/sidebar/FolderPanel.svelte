<script>
  import { projectStore } from '../../stores/project.js';
  import SidebarPanel from './SidebarPanel.svelte';

  async function handlePickFolder() {
    try {
      const result = await window.api.pickFolder();
      if (result && result.folderPath) {
        projectStore.set(result);
      }
    } catch (error) {
      console.error('Error picking folder:', error);
    }
  }

  async function handleLoadSample() {
    try {
      const result = await window.api.loadSampleFolder();
      if (result && result.folderPath) {
        projectStore.set(result);
      }
    } catch (error) {
      console.error('Error loading sample folder:', error);
    }
  }

  function handleDragStart(e, img) {
    e.dataTransfer.setData('imageId', img.id);
    e.dataTransfer.effectAllowed = 'copy';
  }

  $: images = $projectStore.images;
  $: folderPath = $projectStore.folderPath;
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
    {#if !folderPath}
      <p class="form-hint">Pick a folder with JPG/PNG images to start.</p>
      <button class="button secondary" style="margin-top: 0.5rem;" on:click={handleLoadSample}>Load Sample Photos</button>
    {/if}
  </div>

  <div class="panel-header sub">Pool ({images.length} images)</div>
  
  <div class="image-pool-grid">
    {#each images as img (img.id)}
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
  </div>
</SidebarPanel>

<style>
  .image-pool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .thumb {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    background: #1e293b;
    border: 1px solid #334155;
    cursor: pointer;
    transition: all 0.2s;
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
</style>
