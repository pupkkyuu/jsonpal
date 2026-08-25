export type WhitespaceMode = 'none' | 'boundary' | 'all'
export type LineNumberMode = 'on' | 'relative'

export interface EditorSettings {
  minimap: boolean
  minimapCharacters: boolean
  stickyScroll: boolean
  folding: boolean
  renderWhitespace: WhitespaceMode
  bracketPairColorization: boolean
  bracketGuides: boolean
  wordWrap: boolean
  lineNumbers: LineNumberMode
  formatOnPaste: boolean
  unicodeHighlight: boolean
  fontSize: number
  scrollbarSize: number
}

// Single source of truth for the initial Monaco configuration.
export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  minimap: true,
  minimapCharacters: false,
  stickyScroll: true,
  folding: true,
  renderWhitespace: 'boundary',
  bracketPairColorization: false,
  bracketGuides: true,
  wordWrap: false,
  lineNumbers: 'on',
  formatOnPaste: false,
  unicodeHighlight: true,
  fontSize: 14,
  scrollbarSize: 12
}

export function mergeEditorSettings(settings: Record<string, unknown>): EditorSettings {
  return { ...DEFAULT_EDITOR_SETTINGS, ...settings } as EditorSettings
}
