export interface JsonTab {
  id: string
  title: string
}

export interface TabFeedback {
  message: string
  isValid: boolean
  parseErrorLine: number | null
}

interface JsonErrorLocation {
  line: number
  column: number
}

export const INITIAL_TAB: JsonTab = { id: 'json-tab-1', title: '未命名 1' }

export const WAITING_FEEDBACK: TabFeedback = { message: '等待输入 JSON', isValid: true, parseErrorLine: null }

function getJsonErrorLocation(value: string, error: unknown): JsonErrorLocation | null {
  const message = error instanceof Error ? error.message : ''
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColumnMatch) return { line: Number(lineColumnMatch[1]), column: Number(lineColumnMatch[2]) }

  const positionMatch = message.match(/position\s+(\d+)/i)
  if (!positionMatch) return null

  const position = Number(positionMatch[1])
  const beforeError = value.slice(0, position)
  const line = beforeError.split('\n').length
  const lastNewline = beforeError.lastIndexOf('\n')
  return { line, column: position - lastNewline }
}

export function getParseErrorFeedback(value: string, error: unknown): TabFeedback {
  if (error instanceof Error && error.message === '内容不是 JSON 字符串') {
    return { message: error.message, isValid: false, parseErrorLine: 1 }
  }

  const location = getJsonErrorLocation(value, error)
  return {
    message: location ? `JSON 格式错误：第 ${location.line} 行，第 ${location.column} 列` : 'JSON 格式错误',
    isValid: false,
    parseErrorLine: location?.line ?? 1
  }
}

export function isValidJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

export function getTabModelPath(tabId: string): string {
  return `inmemory://jsonpal/${tabId}.json`
}

export function createTabId(): string {
  return `json-tab-${crypto.randomUUID()}`
}
