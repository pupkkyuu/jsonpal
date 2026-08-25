import Editor, { loader, type OnMount, type OnValidate } from '@monaco-editor/react'
import {
  Check,
  Clipboard,
  Minimize2,
  Quote,
  RotateCcw,
  Sparkles,
  Trash2,
  WrapText
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TabSidebar, type JsonTab } from '@/components/TabSidebar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DEFAULT_EDITOR_SETTINGS, mergeEditorSettings, type EditorSettings } from '@/editorSettings'

const EXAMPLE_JSON = `{
  "project": "JSONPal",
  "version": 1,
  "features": ["format", "compress"],
  "ready": true
}`

const INITIAL_TAB: JsonTab = { id: 'json-tab-example', title: '示例', value: EXAMPLE_JSON }

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]
interface TabFeedback {
  message: string
  isValid: boolean
  parseErrorLine: number | null
}

const IS_MACOS = window.api.platform === 'darwin'

loader.config({ paths: { vs: new URL('vs', window.location.href).toString() } })

interface JsonErrorLocation {
  line: number
  column: number
}

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

function getErrorMessage(value: string, error: unknown): string {
  if (error instanceof Error && error.message === '内容不是 JSON 字符串') return error.message
  const location = getJsonErrorLocation(value, error)
  return location ? `JSON 格式错误：第 ${location.line} 行，第 ${location.column} 列` : 'JSON 格式错误'
}

function getValidationFeedback(value: string): TabFeedback {
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

function getTabModelPath(tabId: string): string {
  return `inmemory://jsonpal/${tabId}.json`
}

function createTabId(): string {
  return `json-tab-${crypto.randomUUID()}`
}

function EditorApp(): JSX.Element {
  const [tabs, setTabs] = useState<JsonTab[]>([INITIAL_TAB])
  const [activeTabId, setActiveTabId] = useState(INITIAL_TAB.id)
  const [feedbackByTab, setFeedbackByTab] = useState<Record<string, TabFeedback>>({
    [INITIAL_TAB.id]: getValidationFeedback(INITIAL_TAB.value)
  })
  const [markerErrorLinesByTab, setMarkerErrorLinesByTab] = useState<Record<string, number[]>>({})
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const untitledCounterRef = useRef(1)
  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const errorDecorationIdsRef = useRef<Record<string, string[]>>({})
  const transformJsonRef = useRef<(spacing: number) => void>(() => undefined)

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!
  const activeFeedback = feedbackByTab[activeTab.id] ?? getValidationFeedback(activeTab.value)
  const markerErrorLines = markerErrorLinesByTab[activeTab.id] ?? []

  const setTabFeedback = useCallback((tabId: string, feedback: TabFeedback) => {
    setFeedbackByTab((current) => ({ ...current, [tabId]: feedback }))
  }, [])

  const toggleWordWrap = useCallback(() => {
    const nextSettings = { ...settings, wordWrap: !settings.wordWrap }
    setSettings(nextSettings)
    void window.api.settings.apply(nextSettings).then((savedSettings) => {
      setSettings(mergeEditorSettings(savedSettings))
    })
  }, [settings])

  const stats = useMemo(() => {
    const lines = activeTab.value ? activeTab.value.split('\n').length : 1
    return { lines, chars: activeTab.value.length }
  }, [activeTab.value])

  const showJsonError = useCallback(
    (tabId: string, invalidValue: string, error: unknown) => {
      setTabFeedback(tabId, {
        isValid: false,
        parseErrorLine: getJsonErrorLocation(invalidValue, error)?.line ?? 1,
        message: getErrorMessage(invalidValue, error)
      })
    },
    [setTabFeedback]
  )

  const updateValue = useCallback(
    (nextValue: string) => {
      const tabId = activeTab.id
      setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, value: nextValue } : tab)))
      setTabFeedback(tabId, getValidationFeedback(nextValue))
    },
    [activeTab.id, setTabFeedback]
  )

  const transformJson = useCallback(
    (spacing: number) => {
      try {
        const transformed = JSON.stringify(JSON.parse(activeTab.value), null, spacing)
        updateValue(transformed)
      } catch (error) {
        showJsonError(activeTab.id, activeTab.value, error)
      }
      editorRef.current?.focus()
    },
    [activeTab.id, activeTab.value, showJsonError, updateValue]
  )

  transformJsonRef.current = transformJson

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeTab.value)
      setTabFeedback(activeTab.id, { ...activeFeedback, message: '已复制到剪贴板', isValid: true })
    } catch {
      setTabFeedback(activeTab.id, { ...activeFeedback, message: '无法访问剪贴板', isValid: false })
    }
  }, [activeFeedback, activeTab.id, activeTab.value, setTabFeedback])

  const clearEditor = useCallback(() => {
    updateValue('')
    editorRef.current?.focus()
  }, [updateValue])

  const escapeJson = useCallback(() => {
    updateValue(JSON.stringify(activeTab.value))
    setTabFeedback(activeTab.id, { message: '已转义 JSON 文本', isValid: true, parseErrorLine: null })
    editorRef.current?.focus()
  }, [activeTab.id, activeTab.value, setTabFeedback, updateValue])

  const unescapeJson = useCallback(() => {
    try {
      let unescaped: unknown
      try {
        unescaped = JSON.parse(activeTab.value)
      } catch {
        // Accept common escaped JSON text that omits the outer string quotes.
        unescaped = JSON.parse(`"${activeTab.value}"`)
      }
      if (typeof unescaped !== 'string') throw new Error('内容不是 JSON 字符串')

      updateValue(unescaped)
      const validation = getValidationFeedback(unescaped)
      setTabFeedback(activeTab.id, {
        ...validation,
        message: validation.isValid ? '已去除 JSON 转义' : '已去除 JSON 转义，结果不是有效 JSON'
      })
    } catch (error) {
      showJsonError(activeTab.id, activeTab.value, error)
    }
    editorRef.current?.focus()
  }, [activeTab.id, activeTab.value, setTabFeedback, showJsonError, updateValue])

  const addTab = useCallback(() => {
    const tab: JsonTab = { id: createTabId(), title: `未命名 ${untitledCounterRef.current++}`, value: '' }
    setTabs((current) => [...current, tab])
    setTabFeedback(tab.id, getValidationFeedback(tab.value))
    setActiveTabId(tab.id)
  }, [setTabFeedback])

  const renameTab = useCallback((tabId: string, title: string) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)))
  }, [])

  const closeTab = useCallback(
    (tabId: string) => {
      const closingIndex = tabs.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) return

      let nextTabs = tabs.filter((tab) => tab.id !== tabId)
      if (nextTabs.length === 0) {
        nextTabs = [{ id: createTabId(), title: `未命名 ${untitledCounterRef.current++}`, value: '' }]
      }

      setTabs(nextTabs)
      setFeedbackByTab((current) => {
        const nextFeedback = { ...current }
        delete nextFeedback[tabId]
        if (!nextFeedback[nextTabs[0].id]) nextFeedback[nextTabs[0].id] = getValidationFeedback(nextTabs[0].value)
        return nextFeedback
      })
      setMarkerErrorLinesByTab((current) => {
        const nextLines = { ...current }
        delete nextLines[tabId]
        return nextLines
      })
      delete errorDecorationIdsRef.current[tabId]

      if (tabId === activeTabId) setActiveTabId(nextTabs[Math.min(closingIndex, nextTabs.length - 1)].id)
    },
    [activeTabId, tabs]
  )

  const handleValidate: OnValidate = useCallback(
    (markers) => {
      const lines = [...new Set(markers.filter((marker) => marker.severity === 8).map((marker) => marker.startLineNumber))]
      setMarkerErrorLinesByTab((current) => ({ ...current, [activeTab.id]: lines }))
    },
    [activeTab.id]
  )

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.getModel()?.updateOptions({
      bracketColorizationOptions: {
        enabled: settings.bracketPairColorization,
        independentColorPoolPerBracketType: false
      }
    })
    editor.addAction({
      id: 'jsonpal-format',
      label: '格式化 JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => transformJsonRef.current(2)
    })
    editor.addAction({
      id: 'jsonpal-compress',
      label: '压缩 JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyM],
      run: () => transformJsonRef.current(0)
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        transformJson(2)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [transformJson])

  useEffect(() => {
    let isMounted = true
    void window.api.settings.load().then((savedSettings) => {
      if (isMounted) setSettings(mergeEditorSettings(savedSettings))
    })
    const unsubscribe = window.api.settings.onUpdated((savedSettings) => setSettings(mergeEditorSettings(savedSettings)))
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    editorRef.current?.getModel()?.updateOptions({
      bracketColorizationOptions: {
        enabled: settings.bracketPairColorization,
        independentColorPoolPerBracketType: false
      }
    })
  }, [activeTab.id, settings.bracketPairColorization])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const frame = requestAnimationFrame(() => {
      const model = editor.getModel()
      if (!model) return
      const lines = monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.severity === monaco.MarkerSeverity.Error)
        .map((marker) => marker.startLineNumber)
      setMarkerErrorLinesByTab((current) => ({ ...current, [activeTab.id]: [...new Set(lines)] }))
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab.id])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const errorLines = [
      ...new Set([
        ...markerErrorLines,
        ...(activeFeedback.parseErrorLine === null ? [] : [activeFeedback.parseErrorLine])
      ])
    ]
    errorDecorationIdsRef.current[activeTab.id] = editor.deltaDecorations(
      errorDecorationIdsRef.current[activeTab.id] ?? [],
      errorLines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'json-error-line',
          linesDecorationsClassName: 'json-error-line-number',
          overviewRuler: { color: '#f14c4c', position: monaco.editor.OverviewRulerLane.Full }
        }
      }))
    )
  }, [activeFeedback.parseErrorLine, activeTab.id, markerErrorLines])

  return (
    <TooltipProvider delayDuration={250}>
      <main className="flex h-screen min-h-[520px] min-w-[760px] flex-col overflow-hidden bg-white text-[#333333]">
        <header
          className={`flex h-10 shrink-0 items-center border-b border-[#e5e5e5] bg-white app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-4'}`}
        >
          {IS_MACOS && <span className="text-sm font-medium text-[#333333]">JSONPal</span>}
        </header>

        <section className="flex min-h-0 flex-1" aria-label="JSON workspace">
          <TabSidebar
            tabs={tabs}
            activeTabId={activeTab.id}
            onActivate={setActiveTabId}
            onAdd={addTab}
            onRename={renameTab}
            onClose={closeTab}
            onReorder={setTabs}
            onOpenSettings={() => void window.api.settings.open()}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <nav
              className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-[#e5e5e5] bg-white px-3"
              aria-label="JSON actions"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => transformJson(2)} aria-label="格式化 JSON">
                    <Sparkles size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>格式化 JSON</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => transformJson(0)} aria-label="压缩 JSON">
                    <Minimize2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>压缩 JSON</TooltipContent>
              </Tooltip>
              <span className="mx-2 h-5 w-px bg-[#e5e5e5]" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={escapeJson} aria-label="转义 JSON">
                    <Quote size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>转义 JSON</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={unescapeJson} aria-label="去除 JSON 转义">
                    <RotateCcw size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>去除 JSON 转义</TooltipContent>
              </Tooltip>
              <span className="mx-2 h-5 w-px bg-[#e5e5e5]" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={copyJson} aria-label="复制 JSON">
                    <Clipboard size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>复制 JSON</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={settings.wordWrap ? 'bg-[#e7e7e7] text-[#333333]' : undefined}
                    onClick={toggleWordWrap}
                    aria-label="切换自动换行"
                  >
                    <WrapText size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>自动换行</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={clearEditor} aria-label="清空编辑器">
                    <Trash2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>清空</TooltipContent>
              </Tooltip>
            </nav>

            <div className="min-h-0 flex-1" aria-label="JSON editor">
              <Editor
                height="100%"
                language="json"
                path={getTabModelPath(activeTab.id)}
                saveViewState
                theme="vs"
                value={activeTab.value}
                onChange={(nextValue) => updateValue(nextValue ?? '')}
                onMount={handleEditorMount}
                onValidate={handleValidate}
                options={{
                  automaticLayout: true,
                  minimap: { enabled: settings.minimap, side: 'right', renderCharacters: settings.minimapCharacters },
                  fontSize: settings.fontSize,
                  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
                  lineHeight: 23,
                  padding: { top: 16, bottom: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
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
                    independentColorPoolPerBracketType: true
                  },
                  guides: { bracketPairs: settings.bracketGuides },
                  cursorBlinking: 'smooth'
                }}
              />
            </div>

            <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#e5e5e5] bg-[#f3f3f3] px-4 text-xs text-[#616161]">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-1.5 w-1.5 shrink-0 rounded-full ${activeFeedback.isValid ? 'bg-[#16825d]' : 'bg-[#f14c4c]'}`}
                />
                <span className={`truncate ${activeFeedback.isValid ? 'text-[#616161]' : 'text-[#c72e0f]'}`}>
                  {activeFeedback.message}
                </span>
              </div>
              <div className="ml-4 flex shrink-0 items-center gap-4">
                <span>UTF-8</span>
                <span>空格: 2</span>
                <span>{stats.lines} 行</span>
                <span>{stats.chars} 字符</span>
                <span className="flex items-center gap-1 text-[#616161]">
                  <Check size={13} /> JSON
                </span>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </TooltipProvider>
  )
}

export default EditorApp
