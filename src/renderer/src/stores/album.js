/**
 * album.js — Album Persistence Orchestrator
 *
 * Handles save, load, open, new album, and recent albums list.
 * This is the single source of truth for album file state.
 */

import { writable, get } from 'svelte/store';
import { albumSettingsStore } from './settings.js';
import { layoutConfigStore, currentMenuStore } from './ui.js';
import { layoutModeStore, activePageStore } from './spreads.js';
import {
  spreadsStore,
  currentSpreadIndexStore
} from './spreads.js';
import {
  projectStore,
  activeFoldersStore,
  activeImagesStore,
  addImagesToProject
} from './project.js';

// ─── Public Stores ────────────────────────────────────────────────────────────

/** Current album display name */
export const albumNameStore = writable('Untitled Album');

/** Absolute path of the currently loaded .sampat file, or null if never saved */
export const albumPathStore = writable(null);

/** True when there are unsaved changes */
export const albumDirtyStore = writable(false);

/** List of recently opened albums: Array<{ path, name, savedAt }> */
export const recentAlbumsStore = writable([]);

// ─── Internal helpers ─────────────────────────────────────────────────────────

const MAX_RECENT = 10;
const LS_LAST_PATH = 'lastAlbumPath';

function markDirty() {
  albumDirtyStore.set(true);
}

/** Serialises the entire app state into a plain object */
function serialiseState() {
  const settings = get(albumSettingsStore);
  const layoutConfig = get(layoutConfigStore);
  const currentMenu = get(currentMenuStore);
  const layoutMode = get(layoutModeStore);
  const activePage = get(activePageStore);
  const spreads = get(spreadsStore);
  const currentSpreadIndex = get(currentSpreadIndexStore);
  const project = get(projectStore);
  const activeFolders = [...get(activeFoldersStore)];
  const activeImages = [...get(activeImagesStore)];

  return {
    version: 1,
    albumName: get(albumNameStore),
    savedAt: new Date().toISOString(),
    settings,
    layoutConfig,
    ui: { currentMenu, layoutMode, activePage },
    project: {
      images: project.images,
      activeFolders,
      activeImages
    },
    spreads,
    currentSpreadIndex
  };
}

/** Hydrates all stores from a parsed album object */
async function hydrateState(data) {
  if (!data || data.version !== 1) return;

  // Name & path
  if (data.albumName) albumNameStore.set(data.albumName);

  // Settings
  if (data.settings) albumSettingsStore.set(data.settings);

  // Layout config
  if (data.layoutConfig) layoutConfigStore.set(data.layoutConfig);

  // UI
  if (data.ui) {
    if (data.ui.currentMenu) currentMenuStore.set(data.ui.currentMenu);
    if (data.ui.layoutMode) layoutModeStore.set(data.ui.layoutMode);
    if (data.ui.activePage) activePageStore.set(data.ui.activePage);
  }

  // Project images — re-load from disk if possible, fall back to saved metadata
  if (data.project && Array.isArray(data.project.images)) {
    // Group images by their source folder and reload each folder so we get fresh file handles
    const folderGroups = {};
    data.project.images.forEach(img => {
      const src = img.source;
      if (src && !folderGroups[src]) folderGroups[src] = img;
    });

    // Reset the project to only have the saved images initially (covers picsum / non-disk images)
    projectStore.set({ folderPath: null, images: data.project.images });

    // Reload each folder that has a real path saved — this refreshes file handles without losing IDs
    const uniqueFolderPaths = [...new Set(data.project.images.map(i => i.folderPath).filter(Boolean))];
    for (const fp of uniqueFolderPaths) {
      if (window.api && window.api.getImagesInFolder) {
        const result = await window.api.getImagesInFolder(fp);
        if (result && result.folderPath) {
          addImagesToProject(result);
        }
      }
    }
  }

  // Active selections
  if (data.project) {
    activeFoldersStore.set(new Set(data.project.activeFolders || []));
    activeImagesStore.set(new Set(data.project.activeImages || []));
  }

  // Spreads
  if (Array.isArray(data.spreads)) {
    spreadsStore.set(data.spreads);
  }
  if (typeof data.currentSpreadIndex === 'number') {
    currentSpreadIndexStore.set(data.currentSpreadIndex);
  }

  albumDirtyStore.set(false);
}

/** Adds or bumps a path in the recent albums list and persists it */
async function pushRecentAlbum(albumPath, albumName) {
  const entry = { path: albumPath, name: albumName, savedAt: new Date().toISOString() };

  recentAlbumsStore.update(list => {
    const filtered = list.filter(r => r.path !== albumPath);
    return [entry, ...filtered].slice(0, MAX_RECENT);
  });

  if (window.api && window.api.setRecentAlbums) {
    await window.api.setRecentAlbums(JSON.stringify(get(recentAlbumsStore)));
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save the current album to its existing path.
 * If no path is set yet, opens a Save As dialog.
 */
export async function saveAlbum() {
  const state = serialiseState();
  const json = JSON.stringify(state, null, 2);
  const currentPath = get(albumPathStore);

  if (!window.api || !window.api.saveAlbum) return;
  const savedPath = await window.api.saveAlbum(json, currentPath);

  if (savedPath) {
    albumPathStore.set(savedPath);
    localStorage.setItem(LS_LAST_PATH, savedPath);
    albumDirtyStore.set(false);
    await pushRecentAlbum(savedPath, state.albumName);
  }
}

/**
 * Always opens a Save As dialog regardless of current path.
 */
export async function saveAlbumAs() {
  const state = serialiseState();
  const json = JSON.stringify(state, null, 2);

  if (!window.api || !window.api.saveAlbum) return;
  const savedPath = await window.api.saveAlbum(json, null); // null forces dialog

  if (savedPath) {
    albumPathStore.set(savedPath);
    localStorage.setItem(LS_LAST_PATH, savedPath);
    albumDirtyStore.set(false);
    await pushRecentAlbum(savedPath, state.albumName);
  }
}

/**
 * Load an album from a specific file path.
 */
export async function loadAlbum(filePath) {
  if (!filePath || !window.api || !window.api.loadAlbum) return false;

  const raw = await window.api.loadAlbum(filePath);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    await hydrateState(data);
    albumPathStore.set(filePath);
    localStorage.setItem(LS_LAST_PATH, filePath);
    await pushRecentAlbum(filePath, data.albumName || 'Album');
    return true;
  } catch (e) {
    console.error('Failed to parse album file:', e);
    return false;
  }
}

/**
 * Opens a file picker then loads the chosen album.
 */
export async function openAlbum() {
  if (!window.api || !window.api.pickAlbumFile) return;
  const filePath = await window.api.pickAlbumFile();
  if (filePath) {
    await loadAlbum(filePath);
  }
}

/**
 * Resets all stores to a blank album state.
 * @param {boolean} skipDirtyCheck - skip unsaved-changes guard (used internally)
 */
export async function newAlbum(skipDirtyCheck = false) {
  if (!skipDirtyCheck && get(albumDirtyStore)) {
    const confirmed = confirm('You have unsaved changes. Discard and start a new album?');
    if (!confirmed) return;
  }

  albumNameStore.set('Untitled Album');
  albumPathStore.set(null);
  albumDirtyStore.set(false);
  localStorage.removeItem(LS_LAST_PATH);

  // Reset all stores to defaults
  albumSettingsStore.set({
    unit: 'in',
    dpi: 300,
    pageWidth: 9,
    pageHeight: 12,
    presetId: '18x12',
    bindingType: 'lay-flat',
    globalMargins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 },
    includeCover: true,
    paperThickness: 0.25
  });
  layoutConfigStore.set({ slotGap: 12 });
  currentMenuStore.set('size');
  layoutModeStore.set('spread');
  activePageStore.set('left');
  spreadsStore.set([{
    id: Date.now() + Math.random(),
    type: 'spread',
    imageIds: [],
    currentPresetIndex: 0,
    useCustomMargins: false,
    margins: { top: 0.5, bottom: 0.5, inner: 0.5, outer: 0.5 }
  }]);
  currentSpreadIndexStore.set(0);
  projectStore.set({ folderPath: null, images: [] });
  activeFoldersStore.set(new Set());
  activeImagesStore.set(new Set());
}

/**
 * Called on app mount. Auto-loads the last album if one exists.
 */
export async function initAlbum() {
  // Load recent albums list from disk
  if (window.api && window.api.getRecentAlbums) {
    const recent = await window.api.getRecentAlbums();
    if (Array.isArray(recent)) recentAlbumsStore.set(recent);
  }

  const lastPath = localStorage.getItem(LS_LAST_PATH);
  if (lastPath) {
    const loaded = await loadAlbum(lastPath);
    if (loaded) return;
  }

  // No previous album — start fresh (app initialises with default store values)
  albumDirtyStore.set(false);
}

/**
 * Syncs the native OS window title with current album state.
 */
function syncWindowTitle() {
  const name = get(albumNameStore);
  const path = get(albumPathStore);
  const dirty = get(albumDirtyStore);
  const fileName = path ? path.split(/[/\\]/).pop() : 'unsaved';
  
  const title = `Sampat — ${name} (${fileName})${dirty ? '*' : ''}`;
  if (window.api && window.api.setWindowTitle) {
    window.api.setWindowTitle(title);
  }
}

/**
 * Listens for actions triggered from the native Electron File menu.
 */
export function registerMenuListeners() {
  if (window.api && window.api.onMenuAction) {
    window.api.onMenuAction((action) => {
      switch (action) {
        case 'new-album':
          newAlbum();
          break;
        case 'open-album':
          openAlbum();
          break;
        case 'save-album':
          saveAlbum();
          break;
        case 'save-album-as':
          saveAlbumAs();
          break;
        case 'rename-album': {
          const newName = prompt('Enter new album name:', get(albumNameStore));
          if (newName && newName.trim()) {
            albumNameStore.set(newName.trim());
          }
          break;
        }
      }
    });

    // Auto-sync window title
    albumNameStore.subscribe(syncWindowTitle);
    albumPathStore.subscribe(syncWindowTitle);
    albumDirtyStore.subscribe(syncWindowTitle);
  }
}

// ─── Dirty tracking — subscribe to stores and mark dirty on any change ────────

// We set up subscriptions lazily after initial hydration so we don't fire on mount
let _trackingEnabled = false;
export function enableDirtyTracking() {
  if (_trackingEnabled) return;
  _trackingEnabled = true;

  const markIfReady = () => {
    if (_trackingEnabled) markDirty();
  };

  albumSettingsStore.subscribe(markIfReady);
  layoutConfigStore.subscribe(markIfReady);
  currentMenuStore.subscribe(markIfReady);
  layoutModeStore.subscribe(markIfReady);
  spreadsStore.subscribe(markIfReady);
  activeFoldersStore.subscribe(markIfReady);
  activeImagesStore.subscribe(markIfReady);
  albumNameStore.subscribe(markIfReady);
}
