<script>
  import { Group, Rect, Text } from 'svelte-konva';
  import { projectStore } from '../../stores/project.js';
  import { activePageStore } from '../../stores/spreads.js';
  import { albumSettingsStore } from '../../stores/settings.js';
  import { toPixels } from '../../lib/utils.js';
  import KonvaSlot from './KonvaSlot.svelte';

  export let x = 0;
  export let isLeftPage = true;
  export let pageWidthPx;
  export let pageHeightPx;
  export let slotsData;
  export let margins;

  $: settings = $albumSettingsStore;
  $: isActive = $activePageStore === (isLeftPage ? 'left' : 'right');

  function handlePageClick() {
    activePageStore.set(isLeftPage ? 'left' : 'right');
  }

  $: safeZoneX = toPixels(isLeftPage ? margins.outer : margins.inner, settings.unit, settings.dpi);
  $: safeZoneY = toPixels(margins.top, settings.unit, settings.dpi);
  $: safeZoneW = pageWidthPx - toPixels(margins.outer + margins.inner, settings.unit, settings.dpi);
  $: safeZoneH = pageHeightPx - toPixels(margins.top + margins.bottom, settings.unit, settings.dpi);
</script>

<Group
  config={{
    x: x,
    y: 0,
    width: pageWidthPx,
    height: pageHeightPx,
  }}
  on:click={handlePageClick}
  on:tap={handlePageClick}
>
  <!-- Background White Page -->
  <Rect
    config={{
      x: 0,
      y: 0,
      width: pageWidthPx,
      height: pageHeightPx,
      fill: 'white',
      shadowBlur: 10,
      shadowOpacity: 0.1
    }}
  />

  <!-- Active Highlight Border -->
  {#if isActive}
    <Rect
      config={{
        x: 0,
        y: 0,
        width: pageWidthPx,
        height: pageHeightPx,
        stroke: '#3b82f6',
        strokeWidth: 8,
        listening: false
      }}
    />
  {/if}

  <!-- Page Label -->
  <Text
    config={{
      text: isLeftPage ? 'LEFT' : 'RIGHT',
      x: 0,
      y: pageHeightPx - 40,
      width: pageWidthPx,
      align: 'center',
      fontSize: 12,
      fontStyle: 'bold',
      fill: '#94a3b8',
      opacity: 0.5,
      listening: false
    }}
  />

  {#each slotsData as data (data.imageId)}
    <KonvaSlot
      slotRect={data.slotRect}
      imageRect={data.imageRect}
      imageData={$projectStore.images.find(img => img.id === data.imageId)}
      slotInfo={data.slot}
    />
  {/each}

  <!-- Safe Zone Border -->
  <Rect
    config={{
      x: safeZoneX,
      y: safeZoneY,
      width: safeZoneW,
      height: safeZoneH,
      stroke: 'rgba(239, 68, 68, 0.4)',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false
    }}
  />
</Group>
