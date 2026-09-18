import type { JsonTransformError, JsonTransformRequest, JsonTransformResponse } from './jsonTransformTypes'

function getErrorLocation(value: string, error: unknown): Pick<JsonTransformError, 'line' | 'column'> {
  const message = error instanceof Error ? error.message : ''
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColumnMatch) return { line: Number(lineColumnMatch[1]), column: Number(lineColumnMatch[2]) }

  const positionMatch = message.match(/position\s+(\d+)/i)
  if (!positionMatch) return { line: null, column: null }

  const position = Number(positionMatch[1])
  const beforeError = value.slice(0, position)
  const lastNewline = beforeError.lastIndexOf('\n')
  return { line: beforeError.split('\n').length, column: position - lastNewline }
}

function getFailure(value: string, error: unknown): JsonTransformError {
  const message = error instanceof Error ? error.message : 'JSON 处理失败'
  return { kind: 'parse', message, ...getErrorLocation(value, error) }
}

function unescapeJsonText(value: string): { text: string; changed: boolean } {
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string'
      ? { text: parsed, changed: true }
      : { text: value, changed: false }
  } catch {
    return { text: JSON.parse(`"${value}"`) as string, changed: true }
  }
}

self.onmessage = ({ data }: MessageEvent<JsonTransformRequest>): void => {
  let response: JsonTransformResponse
  try {
    switch (data.action) {
      case 'compress':
        response = { id: data.id, ok: true, text: JSON.stringify(JSON.parse(data.text)) }
        break
      case 'escape':
        response = { id: data.id, ok: true, text: JSON.stringify(data.text) }
        break
      case 'unescape': {
        const { text, changed } = unescapeJsonText(data.text)
        let isValidJson = true
        try {
          JSON.parse(text)
        } catch {
          isValidJson = false
        }
        response = { id: data.id, ok: true, text, isValidJson, changed }
        break
      }
    }
  } catch (error) {
    response = { id: data.id, ok: false, error: getFailure(data.text, error) }
  }
  self.postMessage(response)
}
