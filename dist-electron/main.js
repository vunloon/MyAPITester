//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
let axios = require("axios");
axios = __toESM(axios);
let fs_promises = require("fs/promises");
fs_promises = __toESM(fs_promises);
let fs = require("fs");
let vm = require("vm");
vm = __toESM(vm);
//#region electron/main.ts
electron.app.setName("MyAPITest");
process.env.DIST = (0, path.join)(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : (0, path.join)(process.env.DIST, "../public");
var win;
var preload = (0, path.join)(__dirname, "./preload.js");
var url = process.env.VITE_DEV_SERVER_URL;
function createWindow() {
	win = new electron.BrowserWindow({
		width: 1200,
		height: 800,
		titleBarStyle: "hidden",
		trafficLightPosition: {
			x: 16,
			y: 16
		},
		webPreferences: {
			preload,
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	if (url) win.loadURL(url);
	else win.loadFile((0, path.join)(process.env.DIST, "index.html"));
	win.webContents.openDevTools();
}
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
	if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
electron.app.whenReady().then(() => {
	createWindow();
	electron.ipcMain.handle("send-request", async (event, config) => {
		try {
			const startTime = Date.now();
			const response = await (0, axios.default)({
				...config,
				validateStatus: () => true
			});
			const time = Date.now() - startTime;
			return {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				data: response.data,
				time,
				size: JSON.stringify(response.data)?.length || 0
			};
		} catch (error) {
			return {
				error: error.message,
				status: 0,
				statusText: "Error",
				headers: {},
				data: error.message,
				time: 0,
				size: 0
			};
		}
	});
	const userDataPath = electron.app.getPath("userData");
	const collectionsFile = (0, path.join)(userDataPath, "collections.json");
	electron.ipcMain.handle("read-collections", async () => {
		try {
			if (!(0, fs.existsSync)(collectionsFile)) {
				await fs_promises.default.writeFile(collectionsFile, JSON.stringify([]));
				return [];
			}
			const data = await fs_promises.default.readFile(collectionsFile, "utf-8");
			return JSON.parse(data);
		} catch (error) {
			console.error("Failed to read collections:", error);
			return [];
		}
	});
	electron.ipcMain.handle("write-collections", async (event, collections) => {
		try {
			await fs_promises.default.writeFile(collectionsFile, JSON.stringify(collections, null, 2));
			return { success: true };
		} catch (error) {
			console.error("Failed to write collections:", error);
			return {
				success: false,
				error
			};
		}
	});
	const globalsFile = (0, path.join)(userDataPath, "globals.json");
	electron.ipcMain.handle("read-globals", async () => {
		try {
			if (!(0, fs.existsSync)(globalsFile)) {
				await fs_promises.default.writeFile(globalsFile, JSON.stringify([]));
				return [];
			}
			const data = await fs_promises.default.readFile(globalsFile, "utf-8");
			return JSON.parse(data);
		} catch {
			return [];
		}
	});
	electron.ipcMain.handle("write-globals", async (event, vars) => {
		try {
			await fs_promises.default.writeFile(globalsFile, JSON.stringify(vars, null, 2));
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	});
	const environmentsFile = (0, path.join)(userDataPath, "environments.json");
	electron.ipcMain.handle("read-environments", async () => {
		try {
			if (!(0, fs.existsSync)(environmentsFile)) {
				await fs_promises.default.writeFile(environmentsFile, JSON.stringify([]));
				return [];
			}
			const data = await fs_promises.default.readFile(environmentsFile, "utf-8");
			return JSON.parse(data);
		} catch {
			return [];
		}
	});
	electron.ipcMain.handle("write-environments", async (event, envs) => {
		try {
			await fs_promises.default.writeFile(environmentsFile, JSON.stringify(envs, null, 2));
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error
			};
		}
	});
	electron.ipcMain.handle("execute-script", async (event, params) => {
		try {
			const pm = {
				environment: {
					get: (key) => params.pmData.environment[key],
					set: (key, value) => {
						params.pmData.environment[key] = value;
					}
				},
				globals: {
					get: (key) => params.pmData.globals[key],
					set: (key, value) => {
						params.pmData.globals[key] = value;
					}
				},
				variables: { get: (key) => params.pmData.environment[key] || params.pmData.globals[key] },
				response: params.pmData.response ? {
					...params.pmData.response,
					json: () => params.pmData.response.data
				} : void 0,
				info: params.pmData.info,
				request: params.pmData.request,
				test: (name, fn) => {
					try {
						fn();
						params.pmData.tests = params.pmData.tests || [];
						params.pmData.tests.push({
							name,
							status: "pass"
						});
					} catch (e) {
						params.pmData.tests = params.pmData.tests || [];
						params.pmData.tests.push({
							name,
							status: "fail",
							error: e.message
						});
					}
				}
			};
			const context = vm.default.createContext({
				pm,
				console
			});
			vm.default.runInContext(params.script, context);
			return {
				success: true,
				pmData: params.pmData
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	});
});
//#endregion
