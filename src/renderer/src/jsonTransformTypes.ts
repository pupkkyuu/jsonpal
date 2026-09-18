export type JsonTransformAction = 'compress' | 'escape' | 'unescape'

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
  | { id: number; ok: true; text: string; isValidJson?: boolean; changed?: boolean }
  | { id: number; ok: false; error: JsonTransformError }
