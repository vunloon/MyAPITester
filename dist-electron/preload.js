let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("api", {
	sendRequest: (config) => electron.ipcRenderer.invoke("send-request", config),
	readCollections: () => electron.ipcRenderer.invoke("read-collections"),
	writeCollections: (collections) => electron.ipcRenderer.invoke("write-collections", collections),
	readGlobals: () => electron.ipcRenderer.invoke("read-globals"),
	writeGlobals: (vars) => electron.ipcRenderer.invoke("write-globals", vars),
	readEnvironments: () => electron.ipcRenderer.invoke("read-environments"),
	writeEnvironments: (envs) => electron.ipcRenderer.invoke("write-environments", envs),
	executeScript: (params) => electron.ipcRenderer.invoke("execute-script", params)
});
//#endregion
