export interface JsonTab {
  id: string
  title: string
}

export interface TabFeedback {
  message: string
  isValid: boolean
  parseErrorLine: number | null
}

export const INITIAL_TAB: JsonTab = { id: 'json-tab-1', title: '未命名 1' }

export const WAITING_FEEDBACK: TabFeedback = { message: '等待输入 JSON', isValid: true, parseErrorLine: null }

export function getTabModelPath(tabId: string): string {
  return `inmemory://jsonpal/${tabId}.json`
}

export function createTabId(): string {
  return `json-tab-${crypto.randomUUID()}`
}
