export interface ElectronAPI {
  platform: NodeJS.Platform
  settings: {
    open: () => Promise<void>
    load: () => Promise<Record<string, unknown>>
    apply: (settings: unknown) => Promise<Record<string, unknown>>
    onUpdated: (callback: (settings: Record<string, unknown>) => void) => () => void
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
