const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickFolder: async () => {
    return await ipcRenderer.invoke('pick-folder');
  },
  loadSampleFolder: async () => {
    return await ipcRenderer.invoke('load-sample-folder');
  },
  getLayoutPresets: async () => {
    return await ipcRenderer.invoke('get-layout-presets');
  }
});

