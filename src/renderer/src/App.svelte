<script>
  import { onMount } from 'svelte';
  import Sidebar from './components/sidebar/Sidebar.svelte';
  import PreviewArea from './components/preview/PreviewArea.svelte';
  import { uiSettingsStore } from './stores/ui.js';
  import { initPresets } from './stores/project.js';

  $: menuPosition = $uiSettingsStore.menuPosition;
  $: menuCollapsed = $uiSettingsStore.menuCollapsed;

  onMount(() => {
    initPresets();
  });
</script>

<div id="app-container" class="menu-{menuPosition} {menuCollapsed ? 'menu-collapsed' : ''}">
  <Sidebar />
  <main class="preview-area">
    <PreviewArea />
  </main>
</div>
