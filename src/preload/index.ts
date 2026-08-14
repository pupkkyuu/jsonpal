import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  settings: {
    open: () => ipcRenderer.invoke('settings:open'),
    load: () => ipcRenderer.invoke('settings:load'),
    apply: (settings: unknown) => ipcRenderer.invoke('settings:apply', settings),
    onUpdated: (callback: (settings: Record<string, unknown>) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, settings: Record<string, unknown>): void => callback(settings)
      ipcRenderer.on('settings:updated', listener)
      return () => ipcRenderer.removeListener('settings:updated', listener)
    }
  }
})
