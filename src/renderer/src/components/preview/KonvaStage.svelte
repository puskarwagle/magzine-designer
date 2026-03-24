<script>
  import { Stage, Layer, Group, Rect, Transformer } from 'svelte-konva';
  import { activeSpreadLayout, spreadsStore, currentSpreadIndexStore, activePageStore, updateSlotImage, addImageToCurrentSpread, selectedSlotIdStore } from '../../stores/spreads.js';
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
  $: selectedId = $selectedSlotIdStore;

  let transformerRef;

  $: if (transformerRef && stageRef) {
    const stage = stageRef.node;
    if (stage) {
      const selectedNode = selectedId ? stage.findOne(`#${selectedId}`) : null;
      if (selectedNode) {
        transformerRef.node.nodes([selectedNode]);
      } else {
        transformerRef.node.nodes([]);
      }
    }
  }

  function handleStageClick(e) {
    // If click on stage (not a shape), deselect
    if (e.target === e.target.getStage()) {
      selectedSlotIdStore.set(null);
    }
  }

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
      on:click={handleStageClick}
      on:tap={handleStageClick}
    >
      <Layer>
        <!-- Debug Border for Stage -->
        <Rect
          x={0}
          y={0}
          width={layout.totalSpreadWidthPx}
          height={layout.spreadHeightPx}
          stroke="red"
          strokeWidth={4}
          dash={[10, 5]}
          listening={false}
        />

        {#if layout.layoutMode === 'spread' || (layout.isCover && $albumSettingsStore.includeCover)}
          <!-- PASS 1: BACKGROUNDS FOR ALL PAGES -->
          <KonvaPage
            x={0}
            isLeftPage={true}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={layout.leftPageSlots}
            margins={layout.margins}
            pageType={layout.layoutMode === 'spread' || layout.isCover ? 'spread' : 'left'}
            renderMode="background"
          />
          <KonvaPage
            x={layout.pageWidthPx + layout.spineWidthPx}
            isLeftPage={false}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={layout.rightPageSlots}
            margins={layout.margins}
            pageType={layout.layoutMode === 'spread' || layout.isCover ? 'spread' : 'right'}
            renderMode="background"
          />

          <!-- PASS 2: SLOTS FOR ALL PAGES (Drawn on top of all backgrounds) -->
          <KonvaPage
            x={0}
            isLeftPage={true}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={layout.leftPageSlots}
            margins={layout.margins}
            pageType={layout.layoutMode === 'spread' || layout.isCover ? 'spread' : 'left'}
            renderMode="slots"
          />
          <KonvaPage
            x={layout.pageWidthPx + layout.spineWidthPx}
            isLeftPage={false}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={layout.rightPageSlots}
            margins={layout.margins}
            pageType={layout.layoutMode === 'spread' || layout.isCover ? 'spread' : 'right'}
            renderMode="slots"
          />
        {:else if layout.layoutMode === 'single'}
          <!-- Render single active page (centered) - order doesn't matter here but using pass pattern for consistency -->
          {@const activePageIsLeft = layout.activePage === 'left'}
          {@const singlePageX = (layout.totalSpreadWidthPx - layout.pageWidthPx) / 2}
          <KonvaPage
            x={singlePageX}
            isLeftPage={activePageIsLeft}
            pageWidthPx={layout.pageWidthPx}
            pageHeightPx={layout.pageHeightPx}
            slotsData={activePageIsLeft ? layout.leftPageSlots : layout.rightPageSlots}
            margins={layout.margins}
            pageType={activePageIsLeft ? 'left' : 'right'}
          />
        {/if}
        <Transformer bind:this={transformerRef} />
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
