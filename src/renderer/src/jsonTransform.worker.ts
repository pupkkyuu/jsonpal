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

// Reuse arrays and replace children as we go so their old object trees can be
// collected. Only objects whose key order changes need a replacement.
function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) value[index] = sortJsonKeys(value[index])
    return value
  }
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  const keys = Object.keys(object)
  for (const key of keys) object[key] = sortJsonKeys(object[key])
  if (keys.every((key, index) => index === 0 || keys[index - 1]! <= key)) return object
  keys.sort()
  const sorted: Record<string, unknown> = {}
  for (const key of keys) {
    if (key === '__proto__') {
      Object.defineProperty(sorted, key, { value: object[key], enumerable: true, writable: true, configurable: true })
    } else {
      sorted[key] = object[key]
    }
  }
  return sorted
}

function success(id: number, input: string, text: string, isValidJson?: boolean): JsonTransformResponse {
  return text === input
    ? { id, ok: true, changed: false, isValidJson }
    : { id, ok: true, changed: true, text, isValidJson }
}

self.onmessage = ({ data }: MessageEvent<JsonTransformRequest>): void => {
  let response: JsonTransformResponse
  try {
    switch (data.action) {
      case 'validate':
        JSON.parse(data.text)
        response = { id: data.id, ok: true, changed: false, isValidJson: true }
        break
      case 'compress':
        response = success(data.id, data.text, JSON.stringify(JSON.parse(data.text)))
        break
      case 'sort':
        response = success(data.id, data.text, JSON.stringify(sortJsonKeys(JSON.parse(data.text)), null, 2))
        break
      case 'escape':
        response = success(data.id, data.text, JSON.stringify(data.text))
        break
      case 'unescape': {
        let parsed: unknown
        try {
          parsed = JSON.parse(data.text)
        } catch {
          parsed = JSON.parse(`"${data.text}"`)
        }
        if (typeof parsed !== 'string') {
          response = { id: data.id, ok: true, changed: false, isValidJson: true }
          break
        }
        let isValidJson = true
        try {
          JSON.parse(parsed)
        } catch {
          isValidJson = false
        }
        response = success(data.id, data.text, parsed, isValidJson)
        break
      }
    }
  } catch (error) {
    response = { id: data.id, ok: false, error: getFailure(data.text, error) }
  }
  self.postMessage(response)
}
