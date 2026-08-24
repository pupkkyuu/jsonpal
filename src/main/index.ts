import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'editor-settings.json')
}

function loadSettings(): Record<string, unknown> {
  try {
    const settings = JSON.parse(readFileSync(getSettingsPath(), 'utf8'))
    return typeof settings === 'object' && settings !== null ? settings : {}
  } catch {
    return {}
  }
}

function saveSettings(settings: unknown): Record<string, unknown> {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return loadSettings()

  writeFileSync(getSettingsPath(), JSON.stringify(settings), 'utf8')
  return settings as Record<string, unknown>
}

function loadRendererWindow(window: BrowserWindow, isSettingsWindow = false): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    const suffix = isSettingsWindow ? '?settings=1' : ''
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${suffix}`)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'), isSettingsWindow ? { query: { settings: '1' } } : undefined)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 760,
    minHeight: 520,
    title: 'JSONPal',
    show: true,
    autoHideMenuBar: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  loadRendererWindow(mainWindow)
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 460,
    minHeight: 560,
    parent: mainWindow ?? undefined,
    show: false,
    autoHideMenuBar: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  settingsWindow.once('ready-to-show', () => settingsWindow?.show())
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
  loadRendererWindow(settingsWindow, true)
}

app.whenReady().then(() => {
  app.setName('JSONPal')
  ipcMain.handle('settings:open', () => createSettingsWindow())
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:path', () => getSettingsPath())
  ipcMain.handle('settings:apply', (_event, settings: unknown) => {
    const savedSettings = saveSettings(settings)
    mainWindow?.webContents.send('settings:updated', savedSettings)
    return savedSettings
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
