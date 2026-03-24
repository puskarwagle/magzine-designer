const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Folders & images
  pickFolder: async () => ipcRenderer.invoke('pick-folder'),
  getImagesInFolder: async (folderPath) => ipcRenderer.invoke('get-images-in-folder', folderPath),
  loadSampleFolder: async () => ipcRenderer.invoke('load-sample-folder'),
  getLayoutPresets: async () => ipcRenderer.invoke('get-layout-presets'),

  // Album persistence
  saveAlbum: async (jsonString, filePath) => ipcRenderer.invoke('save-album', jsonString, filePath),
  loadAlbum: async (filePath) => ipcRenderer.invoke('load-album', filePath),
  pickAlbumFile: async () => ipcRenderer.invoke('pick-album-file'),

  // Recent albums
  getRecentAlbums: async () => ipcRenderer.invoke('get-recent-albums'),
  setRecentAlbums: async (albumsJson) => ipcRenderer.invoke('set-recent-albums', albumsJson),

  // Menu action listener
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action) => callback(action)),
  setWindowTitle: (title) => ipcRenderer.send('set-window-title', title),
});
