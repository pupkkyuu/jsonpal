export type JsonTransformAction = 'compress' | 'escape' | 'unescape' | 'sort' | 'validate'

export interface JsonTransformRequest {
  id: number
  action: JsonTransformAction
  text: string
}

export interface JsonTransformError {
  kind: 'parse'
  message: string
  line: number | null
  column: number | null
}

export type JsonTransformResponse =
  | { id: number; ok: true; changed: true; text: string; isValidJson?: boolean }
  | { id: number; ok: true; changed: false; isValidJson?: boolean }
  | { id: number; ok: false; error: JsonTransformError }
