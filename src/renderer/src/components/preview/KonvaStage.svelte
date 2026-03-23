<script>
  import { Stage, Layer, Rect, Group } from 'svelte-konva';
  import { activeSpreadLayout, spreadsStore, currentSpreadIndexStore, activePageStore, updateSlotImage } from '../../stores/spreads.js';
  import { projectStore } from '../../stores/project.js';
  import { zoomStore } from '../../stores/ui.js';
  import { albumSettingsStore } from '../../stores/settings.js';
  import { toPixels } from '../../lib/utils.js';
  import KonvaPage from './KonvaPage.svelte';
  import KonvaSlot from './KonvaSlot.svelte';

  $: layout = $activeSpreadLayout;
  $: zoom = $zoomStore;
  $: spreadIndex = $currentSpreadIndexStore;
  
  let stageRef;
  
  $: stageWidth = (layout.totalSpreadWidthPx || 1000) * zoom;
  $: stageHeight = (layout.spreadHeightPx || 500) * zoom;

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    if (!stageRef || !layout) return;

    const newImageId = e.dataTransfer.getData('imageId');
    if (!newImageId) return;

    const stage = stageRef.getStage();
    stage.setPointersPositions(e);
    const pos = stage.getRelativePointerPosition();

    const shape = stage.getIntersection(pos);
    if (shape) {
      let slotNode = shape;
      while (slotNode && slotNode.name() !== 'image-slot' && slotNode.parent) {
        slotNode = slotNode.parent;
      }

      if (slotNode && slotNode.name() === 'image-slot') {
        const oldImageId = slotNode.id();
        let pageType = 'spread';
        if (layout.layoutMode === 'single' && !layout.isCover) {
          pageType = pos.x < (layout.pageWidthPx + (layout.spineWidthPx || 0) / 2) ? 'left' : 'right';
        }
        updateSlotImage(spreadIndex, pageType, oldImageId, newImageId);
      }
    }
  }

</script>

<div 
  class="konva-container" 
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  role="region"
  aria-label="Album Preview Canvas"
>
  {#if layout && !layout.error && !layout.loading}
    <Stage
      bind:this={stageRef}
      config={{
        width: stageWidth,
        height: stageHeight,
        scaleX: zoom,
        scaleY: zoom
      }}
    >
      <Layer>
        <!-- Always Draw Two Page Backgrounds -->
        <Rect
          config={{
            x: 0,
            y: 0,
            width: layout.pageWidthPx,
            height: layout.spreadHeightPx,
            fill: '#fee2e2', // Light red for visibility
            stroke: 'red',
            strokeWidth: 2,
            shadowBlur: 20,
            shadowOpacity: 0.2
          }}
        />
        <Rect
          config={{
            x: layout.pageWidthPx + (layout.spineWidthPx || 0),
            y: 0,
            width: layout.pageWidthPx,
            height: layout.spreadHeightPx,
            fill: '#dcfce7', // Light green for visibility
            stroke: 'green',
            strokeWidth: 2,
            shadowBlur: 20,
            shadowOpacity: 0.2
          }}
        />

        {#if layout.layoutMode === 'single' && !layout.isCover}
          <!-- Left Page Slots -->
          {#each layout.leftPageSlots as data (data.imageId)}
            <KonvaSlot
              slotRect={data.slotRect}
              imageRect={data.imageRect}
              imageData={$projectStore.images.find(img => img.id === data.imageId)}
              slotInfo={data.slot}
            />
          {/each}
          
          <!-- Right Page Slots (offset by pageWidth + spine) -->
          <Group config={{ x: layout.pageWidthPx + layout.spineWidthPx, y: 0 }}>
            {#each layout.rightPageSlots as data (data.imageId)}
              <KonvaSlot
                slotRect={data.slotRect}
                imageRect={data.imageRect}
                imageData={$projectStore.images.find(img => img.id === data.imageId)}
                slotInfo={data.slot}
              />
            {/each}
          </Group>
        {:else}
          <!-- Spread mode Slots -->
          {#each layout.slots as data (data.imageId)}
            <KonvaSlot
              slotRect={data.slotRect}
              imageRect={data.imageRect}
              imageData={$projectStore.images.find(img => img.id === data.imageId)}
              slotInfo={data.slot}
            />
          {/each}
        {/if}

        <!-- Unified Spine Overlay -->
        {#if layout.spineWidthPx > 0}
          <Rect
            config={{
              x: layout.pageWidthPx,
              y: 0,
              width: layout.spineWidthPx,
              height: layout.spreadHeightPx,
              fillLinearGradientStartPoint: { x: 0, y: 0 },
              fillLinearGradientEndPoint: { x: layout.spineWidthPx, y: 0 },
              fillLinearGradientColorStops: [
                0, 'rgba(0,0,0,0.1)', 
                0.5, 'rgba(0,0,0,0.25)', 
                1, 'rgba(0,0,0,0.1)'
              ],
              listening: false
            }}
          />
        {/if}

        <!-- Safe Zone Indicator (Spread-wide for now to keep it simple) -->
        <Rect
          config={{
            x: toPixels(layout.margins.outer, $albumSettingsStore.unit, $albumSettingsStore.dpi),
            y: toPixels(layout.margins.top, $albumSettingsStore.unit, $albumSettingsStore.dpi),
            width: layout.totalSpreadWidthPx - toPixels(layout.margins.outer * 2, $albumSettingsStore.unit, $albumSettingsStore.dpi),
            height: layout.spreadHeightPx - toPixels(layout.margins.top + layout.margins.bottom, $albumSettingsStore.unit, $albumSettingsStore.dpi),
            stroke: 'rgba(239, 68, 68, 0.4)',
            strokeWidth: 1,
            dash: [10, 10],
            listening: false
          }}
        />
      </Layer>
    </Stage>
  {/if}
</div>

<style>
  .konva-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
