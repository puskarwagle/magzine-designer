const path = require('path');
const crypto = require('crypto');

/**
 * Generate a stable ID from a file path using a short SHA-1 hash.
 */
function stableId(filePath) {
  return crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 12);
}

/**
 * Registers IPC handlers for the app.
 * @param {Object} deps - { ipcMain, dialog, app, fs, getMainWindow }
 */
function registerIpcHandlers(deps) {
  const { ipcMain, dialog, app, fs, getMainWindow } = deps;

  // ─── Folder / Image Handlers ─────────────────────────────────────────────

  ipcMain.handle('pick-folder', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });

    if (result.canceled || !result.filePaths[0]) {
      return { folderPath: null, images: [] };
    }

    const folderPath = result.filePaths[0];
    const files = await fs.promises.readdir(folderPath);
    const images = files
      .filter((file) => /\.(jpe?g|png)$/i.test(file))
      .map((file) => {
        const fullPath = path.join(folderPath, file);
        return {
          id: stableId(fullPath),
          fileName: file,
          path: `media://${fullPath}`
        };
      });

    return { folderPath, images };
  });

  ipcMain.handle('get-images-in-folder', async (event, folderPath) => {
    try {
      if (!folderPath) return { folderPath: null, images: [] };
      const files = await fs.promises.readdir(folderPath);
      const images = files
        .filter((file) => /\.(jpe?g|png)$/i.test(file))
        .map((file) => {
          const fullPath = path.join(folderPath, file);
          return {
            id: stableId(fullPath),
            fileName: file,
            path: `media://${fullPath}`
          };
        });
      return { folderPath, images };
    } catch (e) {
      return { folderPath: null, images: [] };
    }
  });

  ipcMain.handle('get-layout-presets', async () => {
    try {
      const appPath = app.getAppPath();
      const presetPath = path.join(appPath, 'presets.json');
      const raw = await fs.promises.readFile(presetPath, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : null;
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('load-sample-folder', async () => {
    try {
      const appPath = app.getAppPath();
      const folderPath = path.join(appPath, 'sample-images');
      const files = await fs.promises.readdir(folderPath);
      const images = files
        .filter((file) => /\.(jpe?g|png)$/i.test(file))
        .map((file) => {
          const fullPath = path.join(folderPath, file);
          return {
            id: stableId(fullPath),
            fileName: file,
            path: `media://${fullPath}`
          };
        });

      return { folderPath, images };
    } catch (e) {
      return { folderPath: null, images: [] };
    }
  });

  // ─── Album Save / Load Handlers ───────────────────────────────────────────

  /**
   * Save album JSON to a file.
   * If filePath is provided, saves directly there.
   * Otherwise opens a Save dialog for the user to choose.
   * Returns the final saved path (or null if cancelled).
   */
  ipcMain.handle('save-album', async (event, jsonString, filePath) => {
    const mainWindow = getMainWindow();
    let savePath = filePath;

    if (!savePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Album',
        defaultPath: 'Untitled Album.sampat',
        filters: [{ name: 'Sampat Album', extensions: ['sampat'] }]
      });

      if (result.canceled || !result.filePath) return null;
      savePath = result.filePath;
    }

    await fs.promises.writeFile(savePath, jsonString, 'utf8');
    return savePath;
  });

  /**
   * Load album JSON from a file path.
   * Returns the parsed JSON string (renderer parses it).
   */
  ipcMain.handle('load-album', async (event, filePath) => {
    try {
      const raw = await fs.promises.readFile(filePath, 'utf8');
      return raw;
    } catch (e) {
      return null;
    }
  });

  /**
   * Open a file picker dialog for .sampat album files.
   * Returns the chosen file path or null.
   */
  ipcMain.handle('pick-album-file', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Album',
      filters: [{ name: 'Sampat Album', extensions: ['sampat'] }],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  // ─── Recent Albums Handlers ───────────────────────────────────────────────

  const recentAlbumsFilePath = () => path.join(app.getPath('userData'), 'recent-albums.json');

  ipcMain.handle('get-recent-albums', async () => {
    try {
      const raw = await fs.promises.readFile(recentAlbumsFilePath(), 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('set-recent-albums', async (event, albumsJson) => {
    try {
      await fs.promises.writeFile(recentAlbumsFilePath(), albumsJson, 'utf8');
    } catch (e) {
      // silently fail
    }
  });
}

module.exports = { registerIpcHandlers };
