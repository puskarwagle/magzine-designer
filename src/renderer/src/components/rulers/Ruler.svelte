<script>
  export let orientation = 'horizontal'; // 'horizontal' or 'vertical'
  export let lengthPx = 0;
  export let unit = 'in';
  export let dpi = 300;
  export let zoom = 1.0;
  export let offsetX = 0;

  $: ticks = calculateTicks(lengthPx, unit, dpi, zoom);

  function calculateTicks(length, unit, dpi, z) {
    const ticks = [];
    const pixelsPerUnit = unit === 'cm' ? (dpi / 2.54) : dpi;
    const unitsCount = length / pixelsPerUnit;
    
    // Scale the intervals if zoomed out a lot to avoid overlapping
    let interval = 1;
    if (z < 0.2) interval = 5;
    else if (z < 0.5) interval = 2;

    for (let i = 0; i <= unitsCount; i += interval) {
      ticks.push({ 
        pos: i * pixelsPerUnit * z, 
        label: i.toString(), 
        type: 'major' 
      });
      
      // Half units only if zoom is high enough
      if (z > 0.4 && i + interval/2 <= unitsCount) {
        ticks.push({ 
          pos: (i + interval/2) * pixelsPerUnit * z, 
          label: '', 
          type: 'minor' 
        });
      }
    }
    return ticks;
  }
</script>

<div
  class="ruler ruler-{orientation === 'horizontal' ? 'top' : 'left'}"
  style="
    position: absolute; /* Ensure absolute positioning */
    top: ${orientation === 'horizontal' ? '-64px' : `${offsetX}px`}; /* Horizontal ruler: above; Vertical ruler: offset */
    left: ${orientation === 'horizontal' ? `${offsetX}px` : '-64px'}; /* Horizontal ruler: offset; Vertical ruler: left */
    width: ${orientation === 'horizontal' ? `${lengthPx * zoom}px` : '40px'}; /* Horizontal: dynamic width; Vertical: fixed width */
    height: ${orientation === 'vertical' ? `${lengthPx * zoom}px` : '40px'}; /* Vertical: dynamic height; Horizontal: fixed height */
    background-color: rgba(255, 255, 0, 0.5); /* Semi-transparent yellow for debugging */
  "
>
  {#each ticks as tick}
    <div 
      class="tick tick-{tick.type}" 
      style="{orientation === 'horizontal' ? 'left' : 'top'}: {tick.pos}px"
    >
      {#if tick.label}
        <span class="label">{tick.label}</span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ruler {
    position: absolute;
    background: transparent;
    pointer-events: none;
    z-index: 100; /* Very high z-index to ensure visibility */
  }

  .ruler-top {
    border-bottom: 1px solid #1e293b;
  }

  .ruler-left {
    border-right: 1px solid #1e293b;
  }

  .tick {
    position: absolute;
    background: #475569;
  }

  .ruler-top .tick {
    width: 1px;
    bottom: 0;
  }

  .ruler-top .tick-major { height: 10px; }
  .ruler-top .tick-minor { height: 5px; }

  .ruler-left .tick {
    height: 1px;
    right: 0;
  }

  .ruler-left .tick-major { width: 10px; }
  .ruler-left .tick-minor { width: 5px; }

  .label {
    position: absolute;
    font-size: 9px;
    color: #94a3b8;
  }

  .ruler-top .label {
    top: -12px;
    left: 2px;
  }

  .ruler-left .label {
    left: -12px;
    top: 2px;
  }
</style>
