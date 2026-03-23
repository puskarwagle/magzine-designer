<script>
  import { Stage, Layer, Group, Rect } from 'svelte-konva';
  import { activeSpreadLayout, spreadsStore, currentSpreadIndexStore, activePageStore, updateSlotImage } from '../../stores/spreads.js';
  import { projectStore } from '../../stores/project.js';
  import { zoomStore } from '../../stores/ui.js';
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
          <Group config={{ x: layout.pageWidthPx + (layout.spineWidthPx || 0), y: 0 }}>
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
