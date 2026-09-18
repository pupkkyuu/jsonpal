import type { editor } from 'monaco-editor'
import type { EditorSettings } from '@/editorSettings'

export function getMonacoOptions(settings: EditorSettings): editor.IStandaloneEditorConstructionOptions {
  return {
    automaticLayout: false,
    minimap: { enabled: settings.minimap, side: 'right', renderCharacters: settings.minimapCharacters },
    fontSize: settings.fontSize,
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
    lineHeight: 23,
    // Keep the first line flush with the editor's top edge. The toolbar is
    // already a separate row, so extra top padding reads as an unintended gap.
    padding: { top: 0, bottom: 16 },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    // Keep find/replace as an overlay. Monaco otherwise inserts a view zone
    // above the first line (and expands it again when replace is enabled).
    find: { addExtraSpaceOnTop: false },
    renderLineHighlight: 'gutter',
    tabSize: 2,
    wordWrap: settings.wordWrap ? 'on' : 'off',
    lineNumbers: settings.lineNumbers,
    folding: settings.folding,
    renderWhitespace: settings.renderWhitespace,
    matchBrackets: 'always',
    stickyScroll: { enabled: settings.stickyScroll },
    formatOnPaste: settings.formatOnPaste,
    unicodeHighlight: {
      ambiguousCharacters: settings.unicodeHighlight,
      invisibleCharacters: settings.unicodeHighlight,
      nonBasicASCII: settings.unicodeHighlight
    },
    scrollbar: { verticalScrollbarSize: settings.scrollbarSize },
    bracketPairColorization: {
      enabled: settings.bracketPairColorization,
      independentColorPoolPerBracketType: false
    },
    guides: { bracketPairs: settings.bracketGuides },
    cursorBlinking: 'smooth'
  }
}
