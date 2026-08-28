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

// 创建主窗口：先隐藏，等渲染内容就绪后再显示，避免启动时白屏闪烁
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

  // 拦截页面里打开的新窗口，改用系统默认浏览器打开，而不是在应用内再开一个窗口
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

// 注册渲染进程可调用的 IPC 接口：每个事件名对应 store 里的一个数据操作方法
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

// 应用就绪后：先加载本地数据，再注册 IPC 接口，最后创建主窗口
app.whenReady().then(() => {
  initStore()
  registerIpcHandlers()
  createWindow()

  // macOS 上点 Dock 图标且已无窗口时，重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭后退出应用；macOS 例外——保留进程驻留，等用户在 Dock 重新激活
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
