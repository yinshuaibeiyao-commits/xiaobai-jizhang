import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import {
  initStore,
  createTransaction,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  listCustomCategories,
  createCustomCategory,
  updateCustomCategory,
  deleteCustomCategory
} from './store'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: '小白记账',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('transaction:create', (_event, input) => createTransaction(input))
  ipcMain.handle('transaction:list', (_event, filter) => listTransactions(filter))
  ipcMain.handle('transaction:update', (_event, id, input) => updateTransaction(id, input))
  ipcMain.handle('transaction:delete', (_event, id) => deleteTransaction(id))
  ipcMain.handle('category:list', () => listCustomCategories())
  ipcMain.handle('category:create', (_event, input) => createCustomCategory(input))
  ipcMain.handle('category:update', (_event, id, input) => updateCustomCategory(id, input))
  ipcMain.handle('category:delete', (_event, id) => deleteCustomCategory(id))
}

app.whenReady().then(() => {
  initStore()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
