<script>
  import SidebarPanel from './SidebarPanel.svelte';
  function handleExport() {
    alert('Export functionality is not yet implemented in the Svelte version.');
  }
</script>

<SidebarPanel>
  <h3 class="panel-header">Export Album</h3>

  <div class="form-row">
    <label for="export-format">Format</label>
    <select id="export-format">
      <option value="pdf">PDF (High Quality)</option>
      <option value="jpg">JPEG (Spread-by-Spread)</option>
      <option value="png">PNG (Lossless)</option>
    </select>
  </div>

  <div class="form-row">
    <label for="export-dpi">Resolution (DPI)</label>
    <input type="number" id="export-dpi" value="300" />
  </div>

  <div class="form-row checkbox">
    <input type="checkbox" id="export-crop-marks" checked />
    <label for="export-crop-marks">Include Crop Marks</label>
  </div>

  <div class="form-row checkbox">
    <input type="checkbox" id="export-bleed" checked />
    <label for="export-bleed">Include Bleed (0.125")</label>
  </div>

  <div style="margin-top: 1.5rem;">
    <button class="button" style="width: 100%;" on:click={handleExport}>Generate Export Files</button>
  </div>

  <div class="info-box" style="margin-top: 1rem; padding: 0.75rem; background: #1e293b; border-radius: 0.5rem; font-size: 0.8rem; color: #94a3b8;">
    <p style="margin: 0;"><strong>Note:</strong> High-resolution export will use original images and can take several minutes.</p>
  </div>
</SidebarPanel>
