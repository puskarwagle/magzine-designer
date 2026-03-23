<script>
  import SidebarPanel from './SidebarPanel.svelte';
  import { albumSettingsStore } from '../../stores/settings.js';
  import { albumSizePresets, fromUnitToUnit } from '../../lib/utils.js';

  $: settings = $albumSettingsStore;

  function handlePresetChange(e) {
    const presetId = e.target.value;
    const preset = albumSizePresets.find(p => p.id === presetId);
    if (preset) {
      albumSettingsStore.update(s => ({
        ...s,
        presetId: preset.id,
        unit: preset.unit,
        pageWidth: preset.width,
        pageHeight: preset.height
      }));
    }
  }

  function handleUnitChange(e) {
    const newUnit = e.target.value;
    const oldUnit = settings.unit;
    if (newUnit === oldUnit) return;

    albumSettingsStore.update(s => ({
      ...s,
      unit: newUnit,
      pageWidth: fromUnitToUnit(s.pageWidth, oldUnit, newUnit),
      pageHeight: fromUnitToUnit(s.pageHeight, oldUnit, newUnit),
      globalMargins: {
        top: fromUnitToUnit(s.globalMargins.top, oldUnit, newUnit),
        bottom: fromUnitToUnit(s.globalMargins.bottom, oldUnit, newUnit),
        inner: fromUnitToUnit(s.globalMargins.inner, oldUnit, newUnit),
        outer: fromUnitToUnit(s.globalMargins.outer, oldUnit, newUnit)
      }
    }));
  }

  function handleSizeChange(prop, val) {
    albumSettingsStore.update(s => ({
      ...s,
      [prop]: parseFloat(val) || 0,
      presetId: 'custom'
    }));
  }

  function handleMarginChange(side, val) {
    albumSettingsStore.update(s => ({
      ...s,
      globalMargins: {
        ...s.globalMargins,
        [side]: parseFloat(val) || 0
      }
    }));
  }
</script>

<SidebarPanel>
  <h3 class="panel-header">Album Size</h3>

  <div class="form-row">
    <label for="size-preset">Standard Sizes</label>
    <select id="size-preset" value={settings.presetId} on:change={handlePresetChange}>
      {#each albumSizePresets as preset}
        <option value={preset.id}>{preset.name}</option>
      {/each}
    </select>
  </div>

  <div class="form-row">
    <label for="unit">Units</label>
    <select id="unit" value={settings.unit} on:change={handleUnitChange}>
      <option value="in">Inches (in)</option>
      <option value="cm">Centimeters (cm)</option>
    </select>
  </div>

  <div class="form-row">
    <label for="width">Page Width</label>
    <input 
      type="number" 
      id="width" 
      value={settings.pageWidth} 
      step="0.1" 
      on:input={(e) => handleSizeChange('pageWidth', e.target.value)} 
    />
  </div>
  <div class="form-row">
    <label for="height">Page Height</label>
    <input 
      type="number" 
      id="height" 
      value={settings.pageHeight} 
      step="0.1" 
      on:input={(e) => handleSizeChange('pageHeight', e.target.value)} 
    />
  </div>

  <h3 class="panel-header sub">Margins ({settings.unit})</h3>
  
  <div class="form-row">
    <label for="margin-top">Top</label>
    <input type="number" id="margin-top" value={settings.globalMargins.top} step="0.1" on:input={(e) => handleMarginChange('top', e.target.value)} />
  </div>
  <div class="form-row">
    <label for="margin-bottom">Bottom</label>
    <input type="number" id="margin-bottom" value={settings.globalMargins.bottom} step="0.1" on:input={(e) => handleMarginChange('bottom', e.target.value)} />
  </div>
  <div class="form-row">
    <label for="margin-inner">Inner (Spine)</label>
    <input type="number" id="margin-inner" value={settings.globalMargins.inner} step="0.1" on:input={(e) => handleMarginChange('inner', e.target.value)} />
  </div>
  <div class="form-row">
    <label for="margin-outer">Outer</label>
    <input type="number" id="margin-outer" value={settings.globalMargins.outer} step="0.1" on:input={(e) => handleMarginChange('outer', e.target.value)} />
  </div>

  <div class="form-row checkbox" style="margin-top: 1rem;">
    <input type="checkbox" id="include-cover" checked={settings.includeCover} on:change={(e) => albumSettingsStore.update(s => ({ ...s, includeCover: e.target.checked }))} />
    <label for="include-cover">Include Cover Spread</label>
  </div>
</SidebarPanel>
