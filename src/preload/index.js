const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veraAPI', {
    sendChatMessage: (messageData) => ipcRenderer.invoke('send-chat-message', messageData),
    on: (channel, callback) => {
        const validChannels = ['vera-ai-response'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
        }
    },
    removeListener: (channel, callback) => {
        const validChannels = ['vera-ai-response'];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeListener(channel, callback);
        }
    }
});

// Context menu support for webview
window.addEventListener('contextmenu', (event) => {
    console.log('[preload] contextmenu event fired:', {
        x: event.x,
        y: event.y,
        tagName: event.target.tagName,
        isEditable: event.target.isContentEditable || (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')
    });
    event.preventDefault();
    // Send coordinates and some element info to the main process
    ipcRenderer.invoke('show-webview-context-menu', {
        x: event.x,
        y: event.y,
        tagName: event.target.tagName,
        isEditable: event.target.isContentEditable || (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')
    }).then(() => {
        console.log('[preload] IPC call to show-webview-context-menu completed');
    }).catch((err) => {
        console.error('[preload] IPC call to show-webview-context-menu failed:', err);
    });
}); 