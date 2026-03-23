<script>
  import { Image, Rect, Group, Text } from 'svelte-konva';

  export let slotRect; // { x, y, w, h }
  export let imageRect; // { x, y, w, h } relative to slot
  export let imageData;
  export let slotInfo;

  let imageObj = null;

  $: if (imageData && imageData.path) {
    const img = new window.Image();
    img.src = imageData.path;
    img.onload = () => {
      imageObj = img;
    };
  } else {
    imageObj = null;
  }
</script>

<Group
  config={{
    x: slotRect.x,
    y: slotRect.y,
    width: slotRect.w,
    height: slotRect.h,
    clipX: 0,
    clipY: 0,
    clipWidth: slotRect.w,
    clipHeight: slotRect.h,
    rotation: slotInfo?.rotation || 0,
    name: 'image-slot',
    id: imageData?.id
  }}
>
  <!-- Debug Background -->
  <Rect
    config={{
      x: 0,
      y: 0,
      width: slotRect.w,
      height: slotRect.h,
      fill: '#f1f5f9',
      stroke: '#3b82f6',
      strokeWidth: 2
    }}
  />

  {#if imageObj}
    <Image
      config={{
        image: imageObj,
        x: imageRect.x,
        y: imageRect.y,
        width: imageRect.w,
        height: imageRect.h
      }}
    />
  {:else}
    <Text
      config={{
        text: `Slot ${imageData?.id || '?'}\n(No Image)`,
        x: 0,
        y: slotRect.h / 2 - 12,
        width: slotRect.w,
        align: 'center',
        fontSize: 12,
        fill: '#94a3b8'
      }}
    />
  {/if}
</Group>
