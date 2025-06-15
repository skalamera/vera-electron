const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('veraAPI', {
    // Window controls
    windowMinimize: () => ipcRenderer.send('window-minimize'),
    windowMaximize: () => ipcRenderer.send('window-maximize'),
    windowClose: () => ipcRenderer.send('window-close'),

    // Space management
    getSpaces: () => ipcRenderer.invoke('get-spaces'),
    createSpace: (config) => ipcRenderer.invoke('create-space', config),
    updateSpace: (spaceId, updates) => ipcRenderer.invoke('update-space', spaceId, updates),
    deleteSpace: (spaceId) => ipcRenderer.invoke('delete-space', spaceId),
    openSpace: (spaceId) => ipcRenderer.invoke('open-space', spaceId),

    // Subspace management (for space windows)
    getSubspaces: (spaceId) => ipcRenderer.invoke('get-subspaces', spaceId),
    createSubspace: (spaceId, subspaceConfig) => ipcRenderer.invoke('create-subspace', spaceId, subspaceConfig),
    deleteSubspace: (spaceId, subspaceId) => ipcRenderer.invoke('delete-subspace', spaceId, subspaceId),

    // App catalog
    getAppCatalog: () => ipcRenderer.invoke('get-app-catalog'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (updates) => ipcRenderer.invoke('update-settings', updates),

    // External links
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Custom icon handling
    saveCustomIcon: (filename, data) => ipcRenderer.invoke('save-custom-icon', filename, data),

    // System info
    platform: process.platform,

    // Event listeners
    onSpaceData: (callback) => {
        ipcRenderer.on('space-data', (event, space) => callback(space));
    },

    onShowPreferences: (callback) => {
        ipcRenderer.on('show-preferences', callback);
    },

    onThemeUpdate: (callback) => {
        ipcRenderer.on('theme-update', (event, theme) => callback(theme));
    },

    // Remove all listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
}); 