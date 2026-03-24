<script>
  import { Stage, Layer, Group, Rect } from 'svelte-konva';
  import { activeSpreadLayout, spreadsStore, currentSpreadIndexStore, activePageStore, updateSlotImage, addImageToCurrentSpread } from '../../stores/spreads.js';
  import { projectStore } from '../../stores/project.js';
  import { zoomStore } from '../../stores/ui.js';
  import { albumSettingsStore } from '../../stores/settings.js';
  import KonvaSlot from './KonvaSlot.svelte';
  import KonvaPage from './KonvaPage.svelte';

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

    // svelte-konva v1 exports 'node' as the Konva Stage instance
    let stage = stageRef?.node || null;

    if (!stage) {
      console.warn('Could not find Konva stage instance, falling back to addImageToCurrentSpread');
      addImageToCurrentSpread(newImageId);
      return;
    }

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
        let pageType = layout.layoutMode === 'spread' || layout.isCover ? 'spread' : layout.activePage;

        if (oldImageId) {
          updateSlotImage(spreadIndex, pageType, oldImageId, newImageId);
        } else {
          addImageToCurrentSpread(newImageId);
        }
      } else {
        addImageToCurrentSpread(newImageId);
      }
    } else {
      addImageToCurrentSpread(newImageId);
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
      width={stageWidth}
      height={stageHeight}
      scaleX={zoom}
      scaleY={zoom}
    >
      <Layer>
        {#if layout.layoutMode === 'spread' || (layout.isCover && $albumSettingsStore.includeCover)}
          <!-- Render full spread with two pages -->
          <KonvaPage
            x={0}
            isLeftPage={true}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={layout.leftPageSlots}
            margins={layout.margins}
          />
          <KonvaPage
            x={layout.pageWidthPx + layout.spineWidthPx}
            isLeftPage={false}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={layout.rightPageSlots}
            margins={layout.margins}
          />
        {:else if layout.layoutMode === 'single'}
          <!-- Render single active page, centered -->
          {@const activePageIsLeft = layout.activePage === 'left'}
          {@const singlePageX = (layout.totalSpreadWidthPx - layout.pageWidthPx) / 2}
          <KonvaPage
            x={singlePageX}
            isLeftPage={activePageIsLeft}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={activePageIsLeft ? layout.leftPageSlots : layout.rightPageSlots}
            margins={layout.margins}
          />
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
