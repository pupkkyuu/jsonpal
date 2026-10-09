export type CompareViewMode = 'edit' | 'compare'

export interface JsonTab {
  id: string
  title: string
  kind: 'json' | 'diff'
}

export interface TabFeedback {
  message: string
  isValid: boolean
  parseErrorLine: number | null
}

export const INITIAL_TAB: JsonTab = { id: 'json-tab-1', title: '格式化 1', kind: 'json' }

export const WAITING_FEEDBACK: TabFeedback = { message: '等待输入 JSON', isValid: true, parseErrorLine: null }

export function getTabModelPath(tabId: string): string {
  return `inmemory://jsonpal/${tabId}.json`
}

export function getDiffModelPaths(tabId: string): { original: string; modified: string } {
  return {
    original: `inmemory://jsonpal/${tabId}.original.json`,
    modified: `inmemory://jsonpal/${tabId}.modified.json`
  }
}

export function createTabId(): string {
  return `json-tab-${crypto.randomUUID()}`
}
