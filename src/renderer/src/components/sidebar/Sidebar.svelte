<script>
  import { currentMenuStore } from '../../stores/ui.js';
  import SidebarNav from './SidebarNav.svelte';
  
  // Original Panels
  import FolderPanel from './FolderPanel.svelte';
  import SizePanel from './SizePanel.svelte';
  import LayoutPanel from './LayoutPanel.svelte';
  import ExportPanel from './ExportPanel.svelte';

  // New Coming Soon Panels
  import BackgroundsPanel from './panels/BackgroundsPanel.svelte';
  import ThemesPanel from './panels/ThemesPanel.svelte';
  import TextPanel from './panels/TextPanel.svelte';
  import ShapesPanel from './panels/ShapesPanel.svelte';
  import FramesPanel from './panels/FramesPanel.svelte';
  import ClipartPanel from './panels/ClipartPanel.svelte';
  import StickersPanel from './panels/StickersPanel.svelte';
  import BordersPanel from './panels/BordersPanel.svelte';
  import OverlaysPanel from './panels/OverlaysPanel.svelte';
  import ColorGradingPanel from './panels/ColorGradingPanel.svelte';
  import SettingsPanel from './panels/SettingsPanel.svelte';

  $: activeMenu = $currentMenuStore;
</script>

<aside class="sidebar">
  <div class="sidebar-nav">
    <SidebarNav />
  </div>
  
  <div class="sidebar-content">
    {#if activeMenu === 'folder'}
      <FolderPanel />
    {:else}
      <div class="sidebar-panel {activeMenu === 'folder' ? 'active' : ''}"></div>
    {/if}

    {#if activeMenu === 'size'}
      <SizePanel />
    {/if}

    {#if activeMenu === 'layout'}
      <LayoutPanel />
    {/if}

    {#if activeMenu === 'export'}
      <ExportPanel />
    {/if}

    {#if activeMenu === 'backgrounds'}
      <BackgroundsPanel />
    {/if}

    {#if activeMenu === 'themes'}
      <ThemesPanel />
    {/if}

    {#if activeMenu === 'text'}
      <TextPanel />
    {/if}

    {#if activeMenu === 'shapes'}
      <ShapesPanel />
    {/if}

    {#if activeMenu === 'frames'}
      <FramesPanel />
    {/if}

    {#if activeMenu === 'clipart'}
      <ClipartPanel />
    {/if}

    {#if activeMenu === 'stickers'}
      <StickersPanel />
    {/if}

    {#if activeMenu === 'borders'}
      <BordersPanel />
    {/if}

    {#if activeMenu === 'overlays'}
      <OverlaysPanel />
    {/if}

    {#if activeMenu === 'color-grading'}
      <ColorGradingPanel />
    {/if}

    {#if activeMenu === 'settings'}
      <SettingsPanel />
    {/if}
  </div>

  <div class="sidebar-spacer"></div>
</aside>

<style>
  .sidebar {
    width: 380px;
    max-width: 420px;
    min-width: 320px;
    margin: 0.5rem;
    border-radius: 0.5rem;
    border: 2px solid #3b82f6;
    padding: 0;
    background: #020617;
    display: flex;
    flex-direction: row;
    gap: 0;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
    z-index: 20;
    position: relative;
    height: calc(100vh - 1rem); /* Full height minus margins */
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-nav {
    flex-shrink: 0;
    width: 64px;
    padding: 0.5rem 0;
    border-right: 1px solid #1e293b;
    background: #020617;
    border-top-left-radius: 0.3rem;
    border-bottom-left-radius: 0.3rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sidebar-content {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    overflow-y: auto;
    overflow-x: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease, padding 0.3s ease;
    opacity: 1;
    visibility: visible;
  }

  /* Custom Scrollbar for Content */
  .sidebar-content::-webkit-scrollbar {
    width: 6px;
  }
  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar-content::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 3px;
  }
  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }

  .sidebar-spacer {
    display: none;
  }

  /* Responsive layout overrides (via global for parent classes) */
  :global(#app-container.menu-top) .sidebar,
  :global(#app-container.menu-bottom) .sidebar {
    width: auto;
    max-width: none;
    height: 30vh;
    max-height: 80vh;
    align-self: stretch;
    flex-direction: column;
    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(#app-container.menu-top) .sidebar-nav,
  :global(#app-container.menu-bottom) .sidebar-nav {
    width: 100%;
    height: 64px;
    border-right: none;
    border-bottom: 1px solid #1e293b;
    border-radius: 0.3rem 0.3rem 0 0;
    padding: 0 0.5rem;
    flex-direction: row;
  }

  :global(#app-container.menu-collapsed) .sidebar {
    width: 64px;
    min-width: 64px;
    max-width: 64px;
    padding: 0; /* Let nav handle its own padding */
  }

  :global(#app-container.menu-collapsed) .sidebar-content {
    opacity: 0;
    visibility: hidden;
    padding-left: 0;
    padding-right: 0;
    flex: 0 0 0px;
    pointer-events: none;
  }

  :global(#app-container.menu-collapsed.menu-top) .sidebar,
  :global(#app-container.menu-collapsed.menu-bottom) .sidebar {
    width: 100%;
    height: 64px;
    min-height: 64px;
    max-height: 64px;
    max-width: none;
    padding: 0;
  }
</style>
