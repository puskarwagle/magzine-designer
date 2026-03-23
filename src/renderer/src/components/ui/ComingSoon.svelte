<script>
  export let name = "Panel";
  export let icon = "✨";
</script>

<div class="coming-soon">
  <div class="icon-wrapper">
    <span class="main-icon">{icon}</span>
    <div class="pulse-ring"></div>
  </div>
  
  <h2>{name}</h2>
  <div class="badge">Coming Soon</div>
  
  <p>We're working on something amazing for your album design. Stay tuned!</p>
  
  <div class="features-preview">
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-grid">
      <div class="skeleton-box"></div>
      <div class="skeleton-box"></div>
      <div class="skeleton-box"></div>
    </div>
  </div>
</div>

<style>
  .coming-soon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
    text-align: center;
    color: #94a3b8;
    animation: fadeIn 0.5s ease-out;
  }

  .icon-wrapper {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(37, 99, 235, 0.1);
    border-radius: 50%;
    margin-bottom: 1.5rem;
  }

  .main-icon {
    font-size: 2.5rem;
    z-index: 2;
  }

  .pulse-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border: 2px solid rgba(37, 99, 235, 0.3);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  h2 {
    color: #f8fafc;
    font-size: 1.5rem;
    margin: 0 0 0.5rem 0;
    font-weight: 600;
  }

  .badge {
    background: #1e293b;
    color: #3b82f6;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid rgba(59, 130, 246, 0.2);
    margin-bottom: 1.5rem;
  }

  p {
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 240px;
    margin-bottom: 2rem;
  }

  .features-preview {
    width: 100%;
    max-width: 200px;
    opacity: 0.3;
  }

  .skeleton-line {
    height: 8px;
    background: #1e293b;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .skeleton-line.short {
    width: 60%;
    margin-bottom: 16px;
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .skeleton-box {
    aspect-ratio: 1;
    background: #1e293b;
    border-radius: 4px;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.8; }
    70% { transform: scale(1.3); opacity: 0; }
    100% { transform: scale(1.3); opacity: 0; }
  }
</style>
