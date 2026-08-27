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
  unicodeHighlight: false,
  fontSize: 14,
  scrollbarSize: 12
}

const WHITESPACE_MODES: readonly WhitespaceMode[] = ['none', 'boundary', 'all']
const LINE_NUMBER_MODES: readonly LineNumberMode[] = ['on', 'relative']
const FONT_SIZE_RANGE = { min: 12, max: 24 }
const SCROLLBAR_SIZE_RANGE = { min: 8, max: 20 }

function booleanOr(fallback: boolean, value: unknown): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function enumOr<T extends string>(modes: readonly T[], value: unknown, fallback: T): T {
  return modes.includes(value as T) ? (value as T) : fallback
}

function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function mergeEditorSettings(settings: Record<string, unknown>): EditorSettings {
  const source = { ...DEFAULT_EDITOR_SETTINGS, ...settings } as Record<keyof EditorSettings, unknown>
  return {
    minimap: booleanOr(DEFAULT_EDITOR_SETTINGS.minimap, source.minimap),
    minimapCharacters: booleanOr(DEFAULT_EDITOR_SETTINGS.minimapCharacters, source.minimapCharacters),
    stickyScroll: booleanOr(DEFAULT_EDITOR_SETTINGS.stickyScroll, source.stickyScroll),
    folding: booleanOr(DEFAULT_EDITOR_SETTINGS.folding, source.folding),
    renderWhitespace: enumOr(WHITESPACE_MODES, source.renderWhitespace, DEFAULT_EDITOR_SETTINGS.renderWhitespace),
    bracketPairColorization: booleanOr(DEFAULT_EDITOR_SETTINGS.bracketPairColorization, source.bracketPairColorization),
    bracketGuides: booleanOr(DEFAULT_EDITOR_SETTINGS.bracketGuides, source.bracketGuides),
    wordWrap: booleanOr(DEFAULT_EDITOR_SETTINGS.wordWrap, source.wordWrap),
    lineNumbers: enumOr(LINE_NUMBER_MODES, source.lineNumbers, DEFAULT_EDITOR_SETTINGS.lineNumbers),
    formatOnPaste: booleanOr(DEFAULT_EDITOR_SETTINGS.formatOnPaste, source.formatOnPaste),
    unicodeHighlight: booleanOr(DEFAULT_EDITOR_SETTINGS.unicodeHighlight, source.unicodeHighlight),
    fontSize: numberInRange(source.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max, DEFAULT_EDITOR_SETTINGS.fontSize),
    scrollbarSize: numberInRange(
      source.scrollbarSize,
      SCROLLBAR_SIZE_RANGE.min,
      SCROLLBAR_SIZE_RANGE.max,
      DEFAULT_EDITOR_SETTINGS.scrollbarSize
    )
  }
}
