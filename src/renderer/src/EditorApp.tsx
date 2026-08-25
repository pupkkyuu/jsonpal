import Editor, { loader, type OnMount, type OnValidate } from '@monaco-editor/react'
import { Check, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorToolbar } from '@/components/EditorToolbar'
import { TabSidebar } from '@/components/TabSidebar'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DEFAULT_EDITOR_SETTINGS, mergeEditorSettings, type EditorSettings } from '@/editorSettings'
import { useJsonTabs } from '@/hooks/useJsonTabs'
import { getParseErrorFeedback, getTabModelPath, isValidJson, WAITING_FEEDBACK, type TabFeedback } from '@/jsonUtils'
import { getMonacoOptions } from '@/monacoOptions'

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const IS_MACOS = window.api.platform === 'darwin'

const STATS_DEBOUNCE_MS = 200

function hasVisibleContent(model: editor.ITextModel): boolean {
  const lineCount = model.getLineCount()
  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    if (/\S/.test(model.getLineContent(lineNumber))) return true
  }
  return false
}

// Load Monaco on demand from a pinned CDN version instead of bundling all editor assets.
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } })

type MonacoLoadState = 'loading' | 'ready' | 'error'

interface MonacoLoadingStateProps {
  state: MonacoLoadState
  onRetry: () => void
}

function MonacoLoadingState({ state, onRetry }: MonacoLoadingStateProps): JSX.Element {
  if (state === 'error') {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 bg-white px-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <WifiOff size={24} className="text-[#c72e0f]" aria-hidden="true" />
        <p className="text-sm font-medium text-[#333333]">编辑器加载失败</p>
        <p className="max-w-sm text-xs text-[#616161]">无法从网络加载 Monaco 编辑器资源，请检查网络连接后重试。</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw size={15} />
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-white text-center" role="status" aria-live="polite">
      <LoaderCircle size={24} className="animate-spin text-[#0078d4]" aria-hidden="true" />
      <p className="text-sm text-[#616161]">正在加载编辑器...</p>
    </div>
  )
}

interface EditorStatusBarProps {
  modelKey: string
  isReady: boolean
  getModel: () => editor.ITextModel | null
  feedback: TabFeedback
}

function EditorStatusBar({ modelKey, isReady, getModel, feedback }: EditorStatusBarProps): JSX.Element {
  const [stats, setStats] = useState<{ lines: number; chars: number }>({ lines: 1, chars: 0 })

  useEffect(() => {
    if (!isReady) return
    const model = getModel()
    if (!model) return

    const sync = (): void => setStats({ lines: model.getLineCount(), chars: model.getValueLength() })
    sync()

    let timer: ReturnType<typeof setTimeout> | undefined
    const disposable = model.onDidChangeContent(() => {
      clearTimeout(timer)
      timer = setTimeout(sync, STATS_DEBOUNCE_MS)
    })
    return () => {
      disposable.dispose()
      clearTimeout(timer)
    }
  }, [getModel, isReady, modelKey])

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#e5e5e5] bg-[#f3f3f3] px-4 text-xs text-[#616161]">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-1.5 w-1.5 shrink-0 rounded-full ${feedback.isValid ? 'bg-[#16825d]' : 'bg-[#f14c4c]'}`} />
        <span className={`truncate ${feedback.isValid ? 'text-[#616161]' : 'text-[#c72e0f]'}`}>{feedback.message}</span>
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
  )
}

function EditorApp(): JSX.Element {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [monacoLoadState, setMonacoLoadState] = useState<MonacoLoadState>('loading')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const errorDecorationIdsRef = useRef<Record<string, string[]>>({})
  const transformJsonRef = useRef<(spacing: number) => void>(() => undefined)

  const handleTabClosed = useCallback((tabId: string) => {
    delete errorDecorationIdsRef.current[tabId]
    const monaco = monacoRef.current
    const model = monaco ? monaco.editor.getModel(monaco.Uri.parse(getTabModelPath(tabId))) : null
    model?.dispose()
  }, [])

  const {
    tabs,
    activeTab,
    activeFeedback,
    markerErrorLines,
    setTabs,
    setActiveTabId,
    setTabFeedback,
    setMarkerErrorLines,
    addTab,
    renameTab,
    closeTab
  } = useJsonTabs(handleTabClosed)

  useEffect(() => {
    let isMounted = true
    const initialization = loader.init()
    initialization
      .then(() => {
        if (isMounted) setMonacoLoadState('ready')
      })
      .catch((error: unknown) => {
        if (isMounted && (error as { type?: string })?.type !== 'cancelation') setMonacoLoadState('error')
      })

    return () => {
      isMounted = false
      initialization.cancel()
    }
  }, [])

  const toggleWordWrap = useCallback(() => {
    const nextSettings = { ...settings, wordWrap: !settings.wordWrap }
    setSettings(nextSettings)
    void window.api.settings.apply(nextSettings).then((savedSettings) => {
      setSettings(mergeEditorSettings(savedSettings))
    })
  }, [settings])

  const openSettings = useCallback(() => {
    void window.api.settings.open()
  }, [])

  const editorOptions = useMemo(() => getMonacoOptions(settings), [settings])

  const getModel = useCallback((): editor.ITextModel | null => editorRef.current?.getModel() ?? null, [])

  const applyBracketColorization = useCallback((enabled: boolean): void => {
    editorRef.current?.getModel()?.updateOptions({
      bracketColorizationOptions: {
        enabled,
        independentColorPoolPerBracketType: false
      }
    })
  }, [])

  const applyModelValue = useCallback((text: string) => {
    const model = editorRef.current?.getModel()
    if (!model) return
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null)
  }, [])

  const transformJson = useCallback(
    (spacing: number) => {
      const model = editorRef.current?.getModel()
      if (!model) return
      const value = model.getValue()
      if (!value.trim()) {
        setTabFeedback(activeTab.id, WAITING_FEEDBACK)
        editorRef.current?.focus()
        return
      }
      try {
        const transformed = JSON.stringify(JSON.parse(value), null, spacing)
        applyModelValue(transformed)
        setTabFeedback(activeTab.id, {
          message: spacing === 0 ? '已压缩 JSON' : '已格式化 JSON',
          isValid: true,
          parseErrorLine: null
        })
      } catch (error) {
        setTabFeedback(activeTab.id, getParseErrorFeedback(value, error))
      }
      editorRef.current?.focus()
    },
    [activeTab.id, applyModelValue, setTabFeedback]
  )

  useEffect(() => {
    transformJsonRef.current = transformJson
  }, [transformJson])

  const copyJson = useCallback(async () => {
    const value = editorRef.current?.getModel()?.getValue() ?? ''
    try {
      await navigator.clipboard.writeText(value)
      setTabFeedback(activeTab.id, { ...activeFeedback, message: '已复制到剪贴板', isValid: true })
    } catch {
      setTabFeedback(activeTab.id, { ...activeFeedback, message: '无法访问剪贴板', isValid: false })
    }
  }, [activeFeedback, activeTab.id, setTabFeedback])

  const clearEditor = useCallback(() => {
    applyModelValue('')
    editorRef.current?.focus()
  }, [applyModelValue])

  const escapeJson = useCallback(() => {
    const model = editorRef.current?.getModel()
    if (!model) return
    const value = model.getValue()
    if (!value.trim()) {
      setTabFeedback(activeTab.id, WAITING_FEEDBACK)
      editorRef.current?.focus()
      return
    }
    applyModelValue(JSON.stringify(value))
    setTabFeedback(activeTab.id, { message: '已转义 JSON 文本', isValid: true, parseErrorLine: null })
    editorRef.current?.focus()
  }, [activeTab.id, applyModelValue, setTabFeedback])

  const unescapeJson = useCallback(() => {
    const model = editorRef.current?.getModel()
    if (!model) return
    const raw = model.getValue()
    if (!raw.trim()) {
      setTabFeedback(activeTab.id, WAITING_FEEDBACK)
      editorRef.current?.focus()
      return
    }
    try {
      let unescaped: unknown
      try {
        unescaped = JSON.parse(raw)
      } catch {
        // Accept common escaped JSON text that omits the outer string quotes.
        unescaped = JSON.parse(`"${raw}"`)
      }
      if (typeof unescaped !== 'string') throw new Error('内容不是 JSON 字符串')

      const resultIsValid = isValidJson(unescaped)
      applyModelValue(unescaped)
      setTabFeedback(activeTab.id, {
        message: resultIsValid ? '已去除 JSON 转义' : '已去除 JSON 转义，结果不是有效 JSON',
        isValid: resultIsValid,
        parseErrorLine: null
      })
    } catch (error) {
      setTabFeedback(activeTab.id, getParseErrorFeedback(raw, error))
    }
    editorRef.current?.focus()
  }, [activeTab.id, applyModelValue, setTabFeedback])

  const readMarkerState = useCallback(
    (tabId: string) => {
      const editorInstance = editorRef.current
      const monaco = monacoRef.current
      const model = editorInstance?.getModel()
      if (!editorInstance || !monaco || !model) return

      const errors = monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.severity === monaco.MarkerSeverity.Error)
      const errorLines = [...new Set(errors.map((marker) => marker.startLineNumber))].sort((a, b) => a - b)
      setMarkerErrorLines(tabId, errorLines)

      if (errors.length > 0) {
        const first = errors[0]!
        setTabFeedback(tabId, {
          message: `JSON 格式错误：第 ${first.startLineNumber} 行，第 ${first.startColumn} 列`,
          isValid: false,
          parseErrorLine: first.startLineNumber
        })
      } else if (!hasVisibleContent(model)) {
        setTabFeedback(tabId, WAITING_FEEDBACK)
      } else {
        setTabFeedback(tabId, { message: 'JSON 有效', isValid: true, parseErrorLine: null })
      }
    },
    [setMarkerErrorLines, setTabFeedback]
  )

  const handleValidate: OnValidate = useCallback(() => {
    readMarkerState(activeTab.id)
  }, [activeTab.id, readMarkerState])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    applyBracketColorization(settings.bracketPairColorization)
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
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return

      if (!event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        addTab()
        return
      }

      if (!event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setIsSidebarCollapsed((current) => !current)
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const currentIndex = tabs.findIndex((tab) => tab.id === activeTab.id)
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length
        setActiveTabId(tabs[nextIndex]!.id)
        return
      }

      const digitMatch = /^([1-9])$/.exec(event.key)
      if (digitMatch) {
        const target = tabs[Number(digitMatch[1]) - 1]
        if (target) {
          event.preventDefault()
          setActiveTabId(target.id)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTab.id, addTab, setActiveTabId, tabs])

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
    applyBracketColorization(settings.bracketPairColorization)
  }, [activeTab.id, applyBracketColorization, settings.bracketPairColorization])

  useEffect(() => {
    const frame = requestAnimationFrame(() => readMarkerState(activeTab.id))
    return () => cancelAnimationFrame(frame)
  }, [activeTab.id, readMarkerState])

  useEffect(() => {
    if (monacoLoadState !== 'ready') return
    const model = getModel()
    if (!model) return
    const disposable = model.onDidChangeContent(() => readMarkerState(activeTab.id))
    return () => disposable.dispose()
  }, [activeTab.id, getModel, monacoLoadState, readMarkerState])

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
            isCollapsed={isSidebarCollapsed}
            onSetCollapsed={setIsSidebarCollapsed}
            onActivate={setActiveTabId}
            onAdd={addTab}
            onRename={renameTab}
            onClose={closeTab}
            onReorder={setTabs}
            onOpenSettings={openSettings}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <EditorToolbar
              wordWrap={settings.wordWrap}
              onFormat={() => transformJson(2)}
              onCompress={() => transformJson(0)}
              onEscape={escapeJson}
              onUnescape={unescapeJson}
              onCopy={copyJson}
              onToggleWordWrap={toggleWordWrap}
              onClear={clearEditor}
            />

            <div className="min-h-0 flex-1" aria-label="JSON editor">
              {monacoLoadState === 'ready' ? (
                <Editor
                  height="100%"
                  language="json"
                  path={getTabModelPath(activeTab.id)}
                  saveViewState
                  theme="vs"
                  onMount={handleEditorMount}
                  onValidate={handleValidate}
                  loading={<MonacoLoadingState state="loading" onRetry={() => window.location.reload()} />}
                  options={editorOptions}
                />
              ) : (
                <MonacoLoadingState state={monacoLoadState} onRetry={() => window.location.reload()} />
              )}
            </div>

            <EditorStatusBar
              modelKey={activeTab.id}
              isReady={monacoLoadState === 'ready'}
              getModel={getModel}
              feedback={activeFeedback}
            />
          </div>
        </section>
      </main>
    </TooltipProvider>
  )
}

export default EditorApp
