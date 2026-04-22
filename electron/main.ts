import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import axios from 'axios'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import vm from 'vm'

app.setName('MyAPITest');

// Set absolute path for local files
process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let win: BrowserWindow | null

const preload = join(__dirname, './preload.js')
const url = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (url) {
    win.loadURL(url)
  } else {
    win.loadFile(join(process.env.DIST, 'index.html'))
  }
  
  win.webContents.openDevTools()
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  
  // IPC for making HTTP requests bypassing CORS
  ipcMain.handle('send-request', async (event, config) => {
    try {
      const startTime = Date.now();
      const response = await axios({
        ...config,
        validateStatus: () => true, // resolve on any status
      });
      const time = Date.now() - startTime;
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        time,
        size: JSON.stringify(response.data)?.length || 0,
      }
    } catch (error: any) {
      return {
        error: error.message,
        status: 0,
        statusText: 'Error',
        headers: {},
        data: error.message,
        time: 0,
        size: 0,
      }
    }
  })

  // IPC for persistent local storage of collections
  const userDataPath = app.getPath('userData')
  const collectionsFile = join(userDataPath, 'collections.json')

  ipcMain.handle('read-collections', async () => {
    try {
      if (!existsSync(collectionsFile)) {
        await fs.writeFile(collectionsFile, JSON.stringify([]))
        return []
      }
      const data = await fs.readFile(collectionsFile, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to read collections:', error)
      return []
    }
  })

  ipcMain.handle('write-collections', async (event, collections) => {
    try {
      await fs.writeFile(collectionsFile, JSON.stringify(collections, null, 2))
      return { success: true }
    } catch (error) {
      console.error('Failed to write collections:', error)
      return { success: false, error }
    }
  })

  // IPC for persistent local storage of globals
  const globalsFile = join(userDataPath, 'globals.json')
  
  ipcMain.handle('read-globals', async () => {
    try {
      if (!existsSync(globalsFile)) {
        await fs.writeFile(globalsFile, JSON.stringify([]))
        return []
      }
      const data = await fs.readFile(globalsFile, 'utf-8')
      return JSON.parse(data)
    } catch { return [] }
  })

  ipcMain.handle('write-globals', async (event, vars) => {
    try {
      await fs.writeFile(globalsFile, JSON.stringify(vars, null, 2))
      return { success: true }
    } catch (error) { return { success: false, error } }
  })

  // IPC for persistent local storage of environments
  const environmentsFile = join(userDataPath, 'environments.json')

  ipcMain.handle('read-environments', async () => {
    try {
      if (!existsSync(environmentsFile)) {
        await fs.writeFile(environmentsFile, JSON.stringify([]))
        return []
      }
      const data = await fs.readFile(environmentsFile, 'utf-8')
      return JSON.parse(data)
    } catch { return [] }
  })

  ipcMain.handle('write-environments', async (event, envs) => {
    try {
      await fs.writeFile(environmentsFile, JSON.stringify(envs, null, 2))
      return { success: true }
    } catch (error) { return { success: false, error } }
  })

  // IPC for executing scripts in sandbox
  ipcMain.handle('execute-script', async (event, params: { script: string, pmData: any }) => {
    try {
      const pm = {
        environment: {
          get: (key: string) => params.pmData.environment[key],
          set: (key: string, value: string) => { params.pmData.environment[key] = value },
        },
        globals: {
          get: (key: string) => params.pmData.globals[key],
          set: (key: string, value: string) => { params.pmData.globals[key] = value },
        },
        variables: {
          get: (key: string) => params.pmData.environment[key] || params.pmData.globals[key]
        },
        response: params.pmData.response ? {
          ...params.pmData.response,
          json: () => params.pmData.response.data
        } : undefined,
        info: params.pmData.info,
        request: params.pmData.request,
        test: (name: string, fn: any) => {
          try {
            fn();
            params.pmData.tests = params.pmData.tests || [];
            params.pmData.tests.push({ name, status: 'pass' });
          } catch(e: any) {
            params.pmData.tests = params.pmData.tests || [];
            params.pmData.tests.push({ name, status: 'fail', error: e.message });
          }
        }
      };

      const context = vm.createContext({ pm, console });
      vm.runInContext(params.script, context);
      
      return { success: true, pmData: params.pmData };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  })
})
