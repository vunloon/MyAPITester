import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    sendRequest: (config: any) => ipcRenderer.invoke('send-request', config),
    readCollections: () => ipcRenderer.invoke('read-collections'),
    writeCollections: (collections: any) => ipcRenderer.invoke('write-collections', collections),
    readGlobals: () => ipcRenderer.invoke('read-globals'),
    writeGlobals: (vars: any) => ipcRenderer.invoke('write-globals', vars),
    readEnvironments: () => ipcRenderer.invoke('read-environments'),
    writeEnvironments: (envs: any) => ipcRenderer.invoke('write-environments', envs),
    executeScript: (params: any) => ipcRenderer.invoke('execute-script', params)
  }
)
