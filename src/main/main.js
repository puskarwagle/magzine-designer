const { app, BrowserWindow, dialog, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { registerIpcHandlers } = require('./ipcHandlers.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, Vite builds to dist/renderer
    const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

registerIpcHandlers({
  ipcMain,
  dialog,
  app,
  fs,
  getMainWindow: () => mainWindow,
});

if (process.env.NODE_ENV !== 'test') {
  app.whenReady().then(() => {
    // Register custom protocol for local images
    protocol.handle('media', (request) => {
      const filePath = request.url.slice('media://'.length);
      // Ensure we decode the URI component in case there are spaces or special chars
      return net.fetch(pathToFileURL(decodeURIComponent(filePath)).toString());
    });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
