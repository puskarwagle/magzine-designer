<script>
  import { Image, Rect, Group, Text } from 'svelte-konva';

  export let slotRect; // { x, y, w, h }
  export let imageRect; // { x, y, w, h } relative to slot
  export let imageData;
  export let slotInfo;
  export let pageType;
  export let isLeftPage;

  import { selectedSlotIdStore, currentSpreadIndexStore, updateSlotGeometryInPixels } from '../../stores/spreads.js';

  let imageObj = null;
  let groupNode = null;

  $: if (groupNode && slotInfo?.zIndex !== undefined) {
    groupNode.zIndex(slotInfo.zIndex);
  }

  function customClipFunc(ctx) {
    if (!slotRect.path || slotRect.path.length === 0) return;
    ctx.beginPath();
    for (let i = 0; i < slotRect.path.length; i++) {
        const p = slotRect.path[i];
        const lx = p.x - slotRect.x;
        const ly = p.y - slotRect.y;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
    }
    ctx.closePath();
  }

  $: if (imageData && imageData.path) {
    const img = new window.Image();
    img.src = imageData.path;
    img.onload = () => {
      imageObj = img;
    };
  } else {
    imageObj = null;
  }

  $: isSelected = $selectedSlotIdStore === imageData?.id;

  function handleSelect(e) {
    e.cancelBubble = true; // Prevent stage click from deselecting
    selectedSlotIdStore.set(imageData?.id);
  }

  function handleInteractionEnd(e) {
    const node = e.target;
    // We want to capture the transformed dimensions
    const pixelGeo = {
      x: node.x(),
      y: node.y(),
      w: node.width() * node.scaleX(),
      h: node.height() * node.scaleY()
    };

    // Reset scale to 1 and apply to width/height to keep it simple for the next render
    node.setAttrs({
      scaleX: 1,
      scaleY: 1,
      width: pixelGeo.w,
      height: pixelGeo.h
    });

    updateSlotGeometryInPixels($currentSpreadIndexStore, pageType, isLeftPage, imageData.id, pixelGeo);
  }
</script>

<Group
  bind:handle={groupNode}
  x={slotRect.x + (slotInfo?.rotation ? slotRect.w / 2 : 0)}
  y={slotRect.y + (slotInfo?.rotation ? slotRect.h / 2 : 0)}
  width={slotRect.w}
  height={slotRect.h}
  clipFunc={slotRect.path ? customClipFunc : undefined}
  clipX={slotRect.path ? undefined : 0}
  clipY={slotRect.path ? undefined : 0}
  clipWidth={slotRect.path ? undefined : slotRect.w}
  clipHeight={slotRect.path ? undefined : slotRect.h}
  rotation={slotInfo?.rotation || 0}
  offsetX={slotInfo?.rotation ? slotRect.w / 2 : 0}
  offsetY={slotInfo?.rotation ? slotRect.h / 2 : 0}
  name="image-slot"
  id={imageData?.id}
  draggable={true}
  on:click={handleSelect}
  on:tap={handleSelect}
  on:dragend={handleInteractionEnd}
  on:transformend={handleInteractionEnd}
>
  <!-- Background -->
  <Rect
    x={0}
    y={0}
    width={slotRect.w}
    height={slotRect.h}
    fill="#f1f5f9"
  />

  {#if slotInfo?.type === 'whitespace'}
    <!-- Transparent Ghost Slot -->
    <Rect
      x={0}
      y={0}
      width={slotRect.w}
      height={slotRect.h}
      fill="transparent"
      listening={false}
    />
  {:else if slotInfo?.type === 'text'}
    <!-- Text Slot -->
    <Text
      text={slotInfo.textConfig?.content || "Text Block"}
      x={10}
      y={10}
      width={slotRect.w - 20}
      fontSize={slotInfo.textConfig?.fontSize || 16}
      fill="#334155"
      align={slotInfo.textConfig?.align || "left"}
    />
  {:else if imageObj}
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
