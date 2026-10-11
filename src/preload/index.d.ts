export interface ElectronAPI {
  platform: NodeJS.Platform
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
