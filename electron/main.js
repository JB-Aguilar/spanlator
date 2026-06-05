const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { startServer, stopServer } = require('../backend/index')

let mainWindow = null
let serverPort = null

const isDev = process.env.VITE_DEV_SERVER_URL || process.argv.includes('--dev')

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'SpanLator',
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#09090b',
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

ipcMain.handle('get-server-port', () => serverPort)

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Translation Files', extensions: ['json', 'xml', 'txt', 'po', 'csv', 'tsv', 'yaml', 'yml'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('save-file-dialog', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.canceled ? null : result.filePath
})

app.whenReady().then(async () => {
  const dataDir = path.join(app.getPath('appData'), 'SpanLator')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

  serverPort = await startServer(0, dataDir)
  console.log('Server started on port:', serverPort)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer()
    app.quit()
  }
})

app.on('before-quit', async () => {
  await stopServer()
})
