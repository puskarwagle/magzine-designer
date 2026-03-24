<script>
  export let active = true;
</script>

<div class="sidebar-panel {active ? 'active' : ''}">
  <slot />
</div>

<style>
  .sidebar-panel {
    display: none;
    animation: fadeIn 0.2s ease-in-out;
  }

  .sidebar-panel.active {
    display: block;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Horizontal Menu Layout overrides */
  :global(.workspace.menu-top) .sidebar-panel.active,
  :global(.workspace.menu-bottom) .sidebar-panel.active {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
</style>
