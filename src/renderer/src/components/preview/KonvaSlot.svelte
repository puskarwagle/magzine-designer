<script>
  import { Rect, Group, Text } from 'svelte-konva';

  export let slotRect; // { x, y, w, h }
  export let imageRect; // { x, y, w, h } relative to slot
  export let imageData;
  export let slotInfo;

  // Debug colors based on image ID
  const debugColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899'  // pink
  ];
  $: colorIndex = imageData?.id ? parseInt(imageData.id) % debugColors.length : 0;
  $: fillColor = debugColors[colorIndex] || '#334155';

</script>

<Group
  config={{
    x: slotRect.x,
    y: slotRect.y,
    width: slotRect.w,
    height: slotRect.h,
    name: 'image-slot',
    id: imageData?.id
  }}
>
  <!-- Background and Border for visibility -->
  <Rect
    config={{
      x: 0,
      y: 0,
      width: slotRect.w,
      height: slotRect.h,
      fill: fillColor,
      stroke: 'white',
      strokeWidth: 2,
      shadowBlur: 5,
      shadowOpacity: 0.3
    }}
  />

  <Text
    config={{
      text: `Slot ${imageData?.id || '?'}\n${Math.round(slotRect.w)}x${Math.round(slotRect.h)}`,
      x: 0,
      y: slotRect.h / 2 - 12,
      width: slotRect.w,
      align: 'center',
      fontSize: 14,
      fontStyle: 'bold',
      fill: 'white',
      shadowColor: 'black',
      shadowBlur: 2,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 0.8
    }}
  />
</Group>
