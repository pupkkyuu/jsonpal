import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  app: {
    info: () => ipcRenderer.invoke('app:info')
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    path: () => ipcRenderer.invoke('settings:path'),
    openFolder: () => ipcRenderer.invoke('settings:open-folder'),
    apply: (settings: unknown) => ipcRenderer.invoke('settings:apply', settings)
  }
})
