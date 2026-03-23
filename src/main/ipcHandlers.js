const path = require('path');

/**
 * Registers IPC handlers for pick-folder, get-layout-presets, and load-sample-folder.
 * Extracted so main.js and tests can use the same logic.
 * @param {Object} deps - { ipcMain, dialog, app, fs, getMainWindow }
 */
function registerIpcHandlers(deps) {
  const { ipcMain, dialog, app, fs, getMainWindow } = deps;

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
      .map((file, idx) => ({
        id: `img-${idx}`,
        fileName: file,
        path: path.join(folderPath, file)
      }));

    return { folderPath, images };
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
        .map((file, idx) => ({
          id: `img-${idx}`,
          fileName: file,
          path: path.join(folderPath, file)
        }));

      return { folderPath, images };
    } catch (e) {
      return { folderPath: null, images: [] };
    }
  });
}

module.exports = { registerIpcHandlers };
