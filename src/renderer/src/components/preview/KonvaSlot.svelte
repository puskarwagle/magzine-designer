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
  x={slotRect.x}
  y={slotRect.y}
  width={slotRect.w}
  height={slotRect.h}
  clipX={0}
  clipY={0}
  clipWidth={slotRect.w}
  clipHeight={slotRect.h}
  rotation={slotInfo?.rotation || 0}
  name="image-slot"
  id={imageData?.id}
>
  <!-- Background -->
  <Rect
    x={0}
    y={0}
    width={slotRect.w}
    height={slotRect.h}
    fill="#f1f5f9"
  />

  {#if imageObj}
    <Image
      image={imageObj}
      x={imageRect.x}
      y={imageRect.y}
      width={imageRect.w}
      height={imageRect.h}
    />
    <!-- Debug Border for Slot -->
    <Rect
      x={0}
      y={0}
      width={slotRect.w}
      height={slotRect.h}
      stroke="green"
      strokeWidth={2}
      dash={[5, 2]}
      listening={false}
    />
  {:else}
    <!-- Debug Border for Slot -->
    <Rect
      x={0}
      y={0}
      width={slotRect.w}
      height={slotRect.h}
      stroke="green"
      strokeWidth={2}
      dash={[5, 2]}
      listening={false}
    />
    <!-- Empty Slot State -->
    <Rect
      x={0}
      y={0}
      width={slotRect.w}
      height={slotRect.h}
      stroke="#cbd5e1"
      strokeWidth={2}
      dash={[5, 5]}
    />
    <Text
      text="Empty Slot"
      x={0}
      y={slotRect.h / 2 - 12}
      width={slotRect.w}
      align="center"
      fontSize={12}
      fill="#94a3b8"
    />
  {/if}
</Group>
