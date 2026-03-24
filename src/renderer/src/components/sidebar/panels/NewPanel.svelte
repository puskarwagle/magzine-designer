<script>
  import SidebarPanel from '../SidebarPanel.svelte';

  const comingSoonItems = [
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
</script>

<SidebarPanel>
  <div class="new-panel-header">
    <h2>Explore New Features</h2>
    <p>We are constantly adding new tools to help you design better. Stay tuned!</p>
  </div>

  <div class="features-grid">
    {#each comingSoonItems as item}
      <div class="feature-card">
        <div class="feature-icon-wrapper">
          <span class="feature-icon">{item.icon}</span>
        </div>
        <div class="feature-info">
          <span class="feature-label">{item.label}</span>
          <span class="coming-soon-badge">Coming Soon</span>
        </div>
      </div>
    {/each}
  </div>
</SidebarPanel>

<style>
  .new-panel-header {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #1e293b;
  }

  h2 {
    font-size: 1.5rem;
    color: #f8fafc;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  p {
    color: #94a3b8;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .feature-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s ease;
    cursor: default;
    text-align: center;
  }

  .feature-card:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .feature-icon-wrapper {
    width: 48px;
    height: 48px;
    background: #1e293b;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    transition: transform 0.3s ease;
  }

  .feature-card:hover .feature-icon-wrapper {
    transform: scale(1.1);
    background: #2563eb;
  }

  .feature-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .feature-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #e2e8f0;
  }

  .coming-soon-badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    padding: 0.1rem 0.4rem;
    border-radius: 1rem;
    letter-spacing: 0.02em;
  }
</style>
