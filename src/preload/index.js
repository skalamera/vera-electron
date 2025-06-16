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