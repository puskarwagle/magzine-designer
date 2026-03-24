<script>
  import { onMount, onDestroy } from 'svelte';
  import Sidebar from './components/sidebar/Sidebar.svelte';
  import PreviewArea from './components/preview/PreviewArea.svelte';
  import { uiSettingsStore } from './stores/ui.js';
  import {
    saveAlbum,
    saveAlbumAs,
    initAlbum,
    enableDirtyTracking,
    registerMenuListeners
  } from './stores/album.js';

  $: menuPosition = $uiSettingsStore.menuPosition;
  $: menuCollapsed = $uiSettingsStore.menuCollapsed;

  function handleKeydown(e) {
    // Ctrl+S / Cmd+S shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (e.shiftKey) saveAlbumAs(); else saveAlbum();
    }
  }

  function handleBeforeUnload(e) {
    // Auto-save silently on close
    saveAlbum();
  }

  onMount(async () => {
    await initAlbum();
    registerMenuListeners();
    // Start dirty tracking AFTER initial load
    setTimeout(() => enableDirtyTracking(), 100);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('beforeunload', handleBeforeUnload);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  });
</script>

<div id="app-container">
  <div class="workspace menu-{menuPosition} {menuCollapsed ? 'menu-collapsed' : ''}">
    <Sidebar />
    <main class="preview-area-wrapper">
      <PreviewArea />
    </main>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow: hidden;
  }

  #app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background: #020617;
  }

  .workspace {
    display: flex;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .preview-area-wrapper {
    flex: 1;
    overflow: hidden;
    background: #0f172a;
    display: flex;
  }
</style>
