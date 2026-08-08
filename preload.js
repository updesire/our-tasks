const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  submitEntry: (entry) => ipcRenderer.invoke('submit-entry', entry),
  hideWindow: () => ipcRenderer.invoke('hide-window')
});
