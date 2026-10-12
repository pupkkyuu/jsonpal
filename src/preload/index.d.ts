export interface AppInfo {
  version: string
  authorEmail: string
}

export interface ElectronAPI {
  platform: NodeJS.Platform
  app: {
    info: () => Promise<AppInfo>
  }
  settings: {
    load: () => Promise<Record<string, unknown>>
    path: () => Promise<string>
    openFolder: () => Promise<string>
    apply: (settings: unknown) => Promise<Record<string, unknown>>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
