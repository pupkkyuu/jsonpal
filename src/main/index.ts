import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

// macOS creates the application menu during startup, before the `ready` event.
// Set this here so the menu shows JSONPal instead of Electron in development too.
app.setName('JSONPal')

let mainWindow: BrowserWindow | null = null

const APP_ICON = app.isPackaged
  ? join(process.resourcesPath, 'icon.png')
  : join(__dirname, '../../build/icon.png')

const WEB_PREFERENCES = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
} as const

const HIDE_MENU_BAR = process.platform !== 'darwin'

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'editor-settings.json')
}

async function loadSettings(): Promise<Record<string, unknown>> {
  try {
    const settings = JSON.parse(await readFile(getSettingsPath(), 'utf8'))
    return typeof settings === 'object' && settings !== null ? settings : {}
  } catch {
    return {}
  }
}

async function saveSettings(settings: unknown): Promise<Record<string, unknown>> {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return loadSettings()

  await writeFile(getSettingsPath(), JSON.stringify(settings), 'utf8')
  return settings as Record<string, unknown>
}

function attachWindowOpenGuard(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

function attachReloadShortcutGuard(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if ((input.meta || input.control) && !input.alt && !input.shift && input.key.toLowerCase() === 'r') {
      event.preventDefault()
    }
  })
}

function loadRendererWindow(window: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 760,
    minHeight: 520,
    title: 'JSONPal',
    icon: APP_ICON,
    show: true,
    autoHideMenuBar: HIDE_MENU_BAR,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 20 } } : {}),
    backgroundColor: '#FFFFFF',
    webPreferences: WEB_PREFERENCES
  })

  attachWindowOpenGuard(mainWindow)
  attachReloadShortcutGuard(mainWindow)
  loadRendererWindow(mainWindow)
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'JSONPal',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: 'Copyright © 2026 pupkkyuu'
  })

  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:path', () => getSettingsPath())
  ipcMain.handle('settings:open-folder', () => shell.openPath(dirname(getSettingsPath())))
  ipcMain.handle('settings:apply', (_event, settings: unknown) => saveSettings(settings))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
