import { app, BrowserWindow, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
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

function configureApplicationMenu(): void {
  const isMacOS = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = []
  if (isMacOS) {
    template.push({
      label: app.getName(),
      submenu: [
        { label: '关于 JSONPal', role: 'about' },
        { type: 'separator' },
        { label: '服务', role: 'services' },
        { type: 'separator' },
        { label: '隐藏 JSONPal', role: 'hide' },
        { label: '隐藏其他应用', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出 JSONPal', role: 'quit' }
      ]
    })
  }
  template.push(
    {
      label: isMacOS ? '文件' : '文件(&F)',
      submenu: [
        { label: '关闭窗口', role: 'close' },
        ...(!isMacOS ? [
          { type: 'separator' as const },
          { label: '退出', role: 'quit' as const }
        ] : [])
      ]
    },
    {
      label: isMacOS ? '编辑' : '编辑(&E)',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' }
      ]
    }
  )
  if (isMacOS) {
    template.push({
      label: '窗口',
      role: 'windowMenu',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: 'separator' },
        { label: '全部置于前台', role: 'front' }
      ]
    })
  }
  template.push({
    label: isMacOS ? '帮助' : '帮助(&H)',
    role: 'help',
    submenu: [{ label: '关于 JSONPal', click: () => app.showAboutPanel() }]
  })
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

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
  const useTitleBarOverlay = process.platform === 'win32' || process.platform === 'linux'

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 760,
    minHeight: 520,
    title: 'JSONPal',
    icon: APP_ICON,
    show: true,
    autoHideMenuBar: false,
    titleBarStyle: process.platform === 'darwin' || useTitleBarOverlay ? 'hidden' : 'default',
    ...(useTitleBarOverlay ? {
      // Keep these colors aligned with --sidebar and --text-primary in styles.css.
      titleBarOverlay: { color: '#E2E2E4', symbolColor: '#1D1D1F', height: 32 }
    } : {}),
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 16, y: 20 } } : {}),
    backgroundColor: '#FFFFFF',
    webPreferences: WEB_PREFERENCES
  })

  // Hide the Windows/Linux menu while retaining its native command accelerators.
  if (useTitleBarOverlay) mainWindow.setMenuBarVisibility(false)

  attachWindowOpenGuard(mainWindow)
  attachReloadShortcutGuard(mainWindow)
  loadRendererWindow(mainWindow)
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'JSONPal',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: 'Copyright © 2026 pupkkyuu',
    iconPath: APP_ICON,
    ...(process.platform === 'linux' ? { authors: ['pupkkyuu'] } : {})
  })
  configureApplicationMenu()

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    authorEmail: 'pupkkyuu@gmail.com'
  }))
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
