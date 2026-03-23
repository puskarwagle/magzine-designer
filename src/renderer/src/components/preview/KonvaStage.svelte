<script>
  import { Stage, Layer, Rect } from 'svelte-konva';
  import { activeSpreadLayout } from '../../stores/spreads.js';
  import { zoomStore } from '../../stores/ui.js';

  $: layout = $activeSpreadLayout;
  $: zoom = $zoomStore;
  
  $: stageWidth = (layout.totalSpreadWidthPx || 1000) * zoom;
  $: stageHeight = (layout.spreadHeightPx || 500) * zoom;
</script>

<div class="konva-container">
  <Stage config={{ width: stageWidth, height: stageHeight, scaleX: zoom, scaleY: zoom }}>
    <Layer>
      <Rect
        config={{
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          fill: 'red',
          stroke: 'white',
          strokeWidth: 4
        }}
      />
      <Rect
        config={{
          x: 120,
          y: 10,
          width: 100,
          height: 100,
          fill: 'blue',
          stroke: 'white',
          strokeWidth: 4
        }}
      />
    </Layer>
  </Stage>
</div>

<style>
  .konva-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e293b;
  }
</style>
