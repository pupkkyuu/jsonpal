export interface JsonTab {
  id: string
  title: string
  value: string
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

export const INITIAL_TAB: JsonTab = { id: 'json-tab-1', title: '未命名 1', value: '' }

export function getJsonErrorLocation(value: string, error: unknown): JsonErrorLocation | null {
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

export function getErrorMessage(value: string, error: unknown): string {
  if (error instanceof Error && error.message === '内容不是 JSON 字符串') return error.message
  const location = getJsonErrorLocation(value, error)
  return location ? `JSON 格式错误：第 ${location.line} 行，第 ${location.column} 列` : 'JSON 格式错误'
}

export function getValidationFeedback(value: string): TabFeedback {
  if (!value.trim()) return { message: '等待输入 JSON', isValid: true, parseErrorLine: null }

  try {
    JSON.parse(value)
    return { message: 'JSON 有效', isValid: true, parseErrorLine: null }
  } catch (error) {
    return {
      message: getErrorMessage(value, error),
      isValid: false,
      parseErrorLine: getJsonErrorLocation(value, error)?.line ?? 1
    }
  }
}

export function getTabModelPath(tabId: string): string {
  return `inmemory://jsonpal/${tabId}.json`
}

export function createTabId(): string {
  return `json-tab-${crypto.randomUUID()}`
}
