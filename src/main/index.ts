import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

// macOS creates the application menu during startup, before the `ready` event.
// Set this here so the menu shows JSONPal instead of Electron in development too.
app.setName('JSONPal')

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

const WEB_PREFERENCES = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
} as const

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
    webPreferences: WEB_PREFERENCES
  })

  attachWindowOpenGuard(mainWindow)
  attachReloadShortcutGuard(mainWindow)
  loadRendererWindow(mainWindow)
}

function createSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 760,
    height: 720,
    minWidth: 680,
    minHeight: 560,
    
    show: false,
    autoHideMenuBar: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafafa',
    webPreferences: { ...WEB_PREFERENCES }
  })

  attachWindowOpenGuard(settingsWindow)
  attachReloadShortcutGuard(settingsWindow)
  settingsWindow.once('ready-to-show', () => settingsWindow?.show())
  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
  loadRendererWindow(settingsWindow, true)
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'JSONPal',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: 'Copyright © 2026 kkyuu'
  })

  ipcMain.handle('settings:open', () => createSettingsWindow())
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:path', () => getSettingsPath())
  ipcMain.handle('settings:open-folder', () => shell.openPath(dirname(getSettingsPath())))
  ipcMain.handle('settings:apply', (event, settings: unknown) => saveSettings(settings).then((savedSettings) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed() && window.webContents !== event.sender) {
        window.webContents.send('settings:updated', savedSettings)
      }
    }
    return savedSettings
  }))
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
