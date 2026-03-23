<script>
  import { currentMenuStore, uiSettingsStore } from '../../stores/ui.js';

  const menuItems = [
    { id: 'folder', label: 'Images', icon: '📁' },
    { id: 'layout', label: 'Layouts', icon: '🎨' },
    { id: 'size', label: 'Size', icon: '📏' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'backgrounds', label: 'Backgrounds', icon: '🖼️' },
    { id: 'themes', label: 'Themes', icon: '🎭' },
    { id: 'text', label: 'Text', icon: '✍️' },
    { id: 'shapes', label: 'Shapes', icon: '🔷' },
    { id: 'frames', label: 'Frames', icon: '🔳' },
    { id: 'clipart', label: 'Clipart', icon: '📦' },
    { id: 'stickers', label: 'Stickers', icon: '🦄' },
    { id: 'borders', label: 'Borders', icon: '🏁' },
    { id: 'overlays', label: 'Overlays', icon: '🌫️' },
    { id: 'color-grading', label: 'Color Grading', icon: '🌈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  function selectMenu(id) {
    currentMenuStore.set(id);
    // Auto-expand if collapsed and a menu is clicked
    if ($uiSettingsStore.menuCollapsed) {
      uiSettingsStore.update(s => ({ ...s, menuCollapsed: false }));
    }
  }

  function toggleCollapse() {
    uiSettingsStore.update(s => ({ ...s, menuCollapsed: !s.menuCollapsed }));
  }
</script>

<nav class="side-nav">
  <div class="nav-scroll-container">
    {#each menuItems as item}
      <button 
        class="nav-btn { $currentMenuStore === item.id ? 'active' : '' }"
        on:click={() => selectMenu(item.id)}
        title={item.label}
      >
        <span class="nav-icon">{item.icon}</span>
      </button>
    {/each}
  </div>
  <div class="nav-footer">
    <button 
      class="nav-btn collapse-btn { $uiSettingsStore.menuCollapsed ? 'is-collapsed' : '' }"
      on:click={toggleCollapse}
      title="Toggle Sidebar"
    >
      <span class="nav-icon">◀</span>
    </button>
  </div>
</nav>

<style>
  .side-nav {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    width: 100%;
  }

  .nav-scroll-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 4px;
    flex: 1;
    align-items: center;
  }

  /* Custom Scrollbar for Nav */
  .nav-scroll-container::-webkit-scrollbar {
    width: 4px;
  }
  .nav-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .nav-scroll-container::-webkit-scrollbar-thumb {
    background: #1e293b;
    border-radius: 2px;
  }
  .nav-scroll-container::-webkit-scrollbar-thumb:hover {
    background: #334155;
  }

  :global(#app-container.menu-top) .nav-scroll-container,
  :global(#app-container.menu-bottom) .nav-scroll-container {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    overflow-x: auto;
    overflow-y: hidden;
    max-height: none;
    padding-right: 0;
    padding-bottom: 4px;
  }

  .nav-footer {
    display: flex;
    justify-content: center;
    padding-top: 0.5rem;
    margin-top: 0.5rem;
    border-top: 1px solid #1e293b;
  }

  :global(#app-container.menu-top) .nav-footer,
  :global(#app-container.menu-bottom) .nav-footer {
    border-top: none;
    border-left: 1px solid #1e293b;
    padding-top: 0;
    margin-top: 0;
    padding-left: 0.5rem;
    margin-left: 0.5rem;
    align-items: center;
  }

  .nav-btn {
    width: 44px;
    height: 44px;
    border: 1px solid transparent;
    padding: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    position: relative;
  }

  :global(#app-container.menu-top) .nav-btn,
  :global(#app-container.menu-bottom) .nav-btn {
    width: 44px;
    height: 44px;
  }

  :global(#app-container.menu-collapsed) .nav-btn {
    justify-content: center;
    padding: 0;
  }

  .nav-btn:hover {
    background: #1e293b;
    color: #e2e8f0;
  }

  .nav-btn.active {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
  }

  .nav-btn:active {
    transform: scale(0.95);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .collapse-btn {
    color: #cbd5e1;
  }

  .collapse-btn.is-collapsed .nav-icon {
    transform: rotate(180deg);
  }

  :global(#app-container.menu-top) .collapse-btn.is-collapsed .nav-icon {
    transform: rotate(-90deg);
  }
  
  :global(#app-container.menu-bottom) .collapse-btn.is-collapsed .nav-icon {
    transform: rotate(90deg);
  }
</style>
