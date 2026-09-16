import Editor, { loader, type OnMount } from '@monaco-editor/react'
import { Check, LoaderCircle, PanelLeftClose, PanelLeftOpen, RefreshCw, WifiOff } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorToolbar } from '@/components/EditorToolbar'
import { TabSidebar } from '@/components/TabSidebar'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DEFAULT_EDITOR_SETTINGS, mergeEditorSettings, type EditorSettings } from '@/editorSettings'
import { useJsonTabs } from '@/hooks/useJsonTabs'
import { getParseErrorFeedback, getTabModelPath, INITIAL_TAB, isValidJson, unescapeJsonText, WAITING_FEEDBACK, type JsonTab, type TabFeedback } from '@/jsonUtils'
import { getMonacoOptions } from '@/monacoOptions'
import { IS_MACOS } from '@/lib/utils'

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const CONTENT_DEBOUNCE_MS = 200
const SIDEBAR_TRANSITION_MS = 300
const JSON_STARTER = `{
  "message": "在这里粘贴或输入 JSON",
  "example": true,
  "items": []
}`

function hasVisibleContent(model: editor.ITextModel): boolean {
  return /\S/.test(model.getValue())
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
  editor: EditorInstance | null
  feedback: TabFeedback
}

interface ModelStats {
  lines: number
  chars: number
}

function EditorStatusBar({ editor, feedback }: EditorStatusBarProps): JSX.Element {
  const [stats, setStats] = useState<ModelStats>({ lines: 1, chars: 0 })
  const [indent, setIndent] = useState<{ insertSpaces: boolean; tabSize: number }>({ insertSpaces: true, tabSize: 2 })
  const [languageId, setLanguageId] = useState('json')

  useEffect(() => {
    if (!editor) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let modelDisposables: { dispose(): void }[] = []

    const sync = (): void => {
      const model = editor.getModel()
      if (!model) return
      setStats({ lines: model.getLineCount(), chars: model.getValueLength() })
      const { insertSpaces, tabSize } = model.getOptions()
      setIndent((prev) => (prev.insertSpaces === insertSpaces && prev.tabSize === tabSize ? prev : { insertSpaces, tabSize }))
      setLanguageId((prev) => {
        const current = model.getLanguageId()
        return prev === current ? prev : current
      })
    }

    const attachModel = (model: editor.ITextModel | null): void => {
      modelDisposables.forEach((disposable) => disposable.dispose())
      modelDisposables = []
      if (!model) return
      modelDisposables.push(
        model.onDidChangeContent(() => {
          clearTimeout(timer)
          timer = setTimeout(sync, CONTENT_DEBOUNCE_MS)
        }),
        model.onDidChangeOptions(sync),
        model.onDidChangeLanguage(sync)
      )
    }

    sync()
    attachModel(editor.getModel())
    const onDidChangeModelDisposable = editor.onDidChangeModel(() => {
      clearTimeout(timer)
      sync()
      attachModel(editor.getModel())
    })

    return () => {
      onDidChangeModelDisposable.dispose()
      modelDisposables.forEach((disposable) => disposable.dispose())
      clearTimeout(timer)
    }
  }, [editor])

  const isWaiting = feedback.message === WAITING_FEEDBACK.message
  const statusColor = isWaiting ? 'bg-[#98a2b3]' : feedback.isValid ? 'bg-[#138a62]' : 'bg-[#d44857]'
  const statusText = isWaiting ? 'text-[#667085]' : feedback.isValid ? 'text-[#426a5b]' : 'text-[#b42318]'

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-[#e4e7ef] px-4 text-xs text-[#667085]">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
        <span className={`truncate ${statusText}`}>{feedback.message}</span>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-4">
        <span>{indent.insertSpaces ? `空格: ${indent.tabSize}` : `Tab 大小: ${indent.tabSize}`}</span>
        <span>{stats.lines} 行</span>
        <span>{stats.chars} 字符</span>
        <span className="flex items-center gap-1 text-[#667085]">
          <Check size={13} /> {languageId.toUpperCase()}
        </span>
      </div>
    </footer>
  )
}

function EditorApp(): JSX.Element {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [monacoLoadState, setMonacoLoadState] = useState<MonacoLoadState>('loading')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(200)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const [editorInstance, setEditorInstance] = useState<EditorInstance | null>(null)
  const errorDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)
  const transformJsonRef = useRef<(spacing: number) => void>(() => undefined)
  const toggleSequenceRef = useRef(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const sidebarTransitionFrameRef = useRef<number | undefined>()
  const navigationRef = useRef({ tabs: [] as JsonTab[], activeTabId: '' })

  const handleTabClosed = useCallback((tabId: string) => {
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
    closeTab,
    closeOtherTabs,
    closeAllTabs
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

  useEffect(() => {
    navigationRef.current = { tabs, activeTabId: activeTab.id }
  }, [tabs, activeTab.id])

  const toggleWordWrap = useCallback(() => {
    const nextSettings = { ...settings, wordWrap: !settings.wordWrap }
    const sequence = ++toggleSequenceRef.current
    void window.api.settings.apply(nextSettings).then((savedSettings) => {
      if (toggleSequenceRef.current !== sequence) return
      setSettings(mergeEditorSettings(savedSettings))
    })
  }, [settings])

  const openSettings = useCallback(() => {
    void window.api.settings.open()
  }, [])

  const editorOptions = useMemo(() => getMonacoOptions(settings), [settings])

  const toggleSidebar = useCallback((): void => {
    cancelAnimationFrame(sidebarTransitionFrameRef.current ?? 0)
    setIsSidebarCollapsed((collapsed) => !collapsed)
    const startedAt = performance.now()
    const syncLayout = (now: number): void => {
      editorRef.current?.layout()
      if (now - startedAt < SIDEBAR_TRANSITION_MS) {
        sidebarTransitionFrameRef.current = requestAnimationFrame(syncLayout)
      }
    }
    sidebarTransitionFrameRef.current = requestAnimationFrame(syncLayout)
  }, [])

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success'): void => {
    clearTimeout(toastTimerRef.current)
    setToast({ message, tone })
    toastTimerRef.current = setTimeout(() => setToast(null), 2400)
  }, [])

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])
  useEffect(() => () => cancelAnimationFrame(sidebarTransitionFrameRef.current ?? 0), [])

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

  const withEditorValue = useCallback(
    (handler: (value: string, apply: (text: string) => void) => void): void => {
      const value = editorRef.current?.getModel()?.getValue() ?? ''
      if (!value.trim()) {
        setTabFeedback(activeTab.id, WAITING_FEEDBACK)
      } else {
        handler(value, applyModelValue)
      }
      editorRef.current?.focus()
    },
    [activeTab.id, applyModelValue, setTabFeedback]
  )

  const transformJson = useCallback(
    (spacing: number) => {
      withEditorValue((value, apply) => {
        try {
          apply(JSON.stringify(JSON.parse(value), null, spacing))
          setTabFeedback(activeTab.id, {
            message: spacing === 0 ? '已压缩 JSON' : '已格式化 JSON',
            isValid: true,
            parseErrorLine: null
          })
          showToast(spacing === 0 ? 'JSON 已压缩' : 'JSON 已格式化')
        } catch (error) {
          setTabFeedback(activeTab.id, getParseErrorFeedback(value, error))
        }
      })
    },
    [activeTab.id, setTabFeedback, showToast, withEditorValue]
  )

  useEffect(() => {
    transformJsonRef.current = transformJson
  }, [transformJson])

  const formatJson = useCallback(() => transformJson(2), [transformJson])
  const compressJson = useCallback(() => transformJson(0), [transformJson])

  const activeFeedbackRef = useRef(activeFeedback)

  useEffect(() => {
    activeFeedbackRef.current = activeFeedback
  }, [activeFeedback])

  const copyJson = useCallback(async () => {
    const value = editorRef.current?.getModel()?.getValue() ?? ''
    try {
      await navigator.clipboard.writeText(value)
      setTabFeedback(activeTab.id, { ...activeFeedbackRef.current, message: '已复制到剪贴板', isValid: true })
      showToast('JSON 已复制到剪贴板')
    } catch {
      setTabFeedback(activeTab.id, { ...activeFeedbackRef.current, message: '无法访问剪贴板', isValid: false })
      showToast('无法访问剪贴板', 'error')
    }
  }, [activeTab.id, setTabFeedback, showToast])

  const clearEditor = useCallback(() => {
    applyModelValue('')
    editorRef.current?.focus()
    showToast('编辑器已清空')
  }, [applyModelValue, showToast])

  const escapeJson = useCallback(() => {
    withEditorValue((value, apply) => {
      apply(JSON.stringify(value))
      setTabFeedback(activeTab.id, { message: '已转义 JSON 文本', isValid: true, parseErrorLine: null })
      showToast('JSON 文本已转义')
    })
  }, [activeTab.id, setTabFeedback, showToast, withEditorValue])

  const unescapeJson = useCallback(() => {
    withEditorValue((value, apply) => {
      try {
        const unescaped = unescapeJsonText(value)
        const resultIsValid = isValidJson(unescaped)
        apply(unescaped)
        setTabFeedback(activeTab.id, {
          message: resultIsValid ? '已去除 JSON 转义' : '已去除 JSON 转义，结果不是有效 JSON',
          isValid: resultIsValid,
          parseErrorLine: null
        })
        showToast(resultIsValid ? '已去除 JSON 转义' : '已去除 JSON 转义')
      } catch (error) {
        setTabFeedback(activeTab.id, getParseErrorFeedback(value, error))
      }
    })
  }, [activeTab.id, setTabFeedback, showToast, withEditorValue])

  const readMarkerState = useCallback(
    (tabId: string) => {
      const currentEditor = editorRef.current
      const monaco = monacoRef.current
      const model = currentEditor?.getModel()
      if (!currentEditor || !monaco || !model) return

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

  const handleValidate = useCallback((): void => {
    readMarkerState(activeTab.id)
  }, [activeTab.id, readMarkerState])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setEditorInstance(editor)
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
    requestAnimationFrame(() => editor.layout())
  }

  useEffect(() => {
    if (!editorInstance) return
    const layout = (): void => editorInstance.layout()
    window.addEventListener('resize', layout)
    return () => window.removeEventListener('resize', layout)
  }, [editorInstance])

  useEffect(() => {
    editorInstance?.layout()
  }, [editorInstance, sidebarWidth])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return

      const { tabs: currentTabs, activeTabId: currentActiveId } = navigationRef.current

      if (!event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        addTab()
        return
      }

      if (!event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        toggleSidebar()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const currentIndex = currentTabs.findIndex((tab) => tab.id === currentActiveId)
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % currentTabs.length
        setActiveTabId(currentTabs[nextIndex]!.id)
        return
      }

      const digitMatch = /^([1-9])$/.exec(event.key)
      if (digitMatch) {
        const target = currentTabs[Number(digitMatch[1]) - 1]
        if (target) {
          event.preventDefault()
          setActiveTabId(target.id)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addTab, setActiveTabId, toggleSidebar])

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
  }, [activeTab.id, applyBracketColorization, editorInstance, settings.bracketPairColorization])

  useEffect(() => {
    const frame = requestAnimationFrame(() => readMarkerState(activeTab.id))
    return () => cancelAnimationFrame(frame)
  }, [activeTab.id, editorInstance, readMarkerState])

  useEffect(() => {
    const currentEditor = editorRef.current
    const monaco = monacoRef.current
    if (!currentEditor || !monaco) return

    const errorLines = [
      ...new Set([
        ...markerErrorLines,
        ...(activeFeedback.parseErrorLine === null ? [] : [activeFeedback.parseErrorLine])
      ])
    ]
    errorDecorationsRef.current ??= currentEditor.createDecorationsCollection()
    errorDecorationsRef.current.set(
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
      <main className="app-shell flex h-screen min-h-[520px] min-w-[760px] flex-col overflow-hidden">
        <header className={`app-panel relative flex h-9 shrink-0 items-center border-b app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-3'}`}>
          <div className="app-no-drag relative z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[#667085]"
              onClick={toggleSidebar}
              aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          </div>
          <span className="pointer-events-none absolute inset-x-20 truncate px-3 text-center text-xs font-medium text-[#475467]" title={activeTab.title}>
            {activeTab.title}
          </span>
        </header>

        <section className="flex min-h-0 flex-1" aria-label="JSON workspace">
          <TabSidebar
            tabs={tabs}
            activeTabId={activeTab.id}
            isCollapsed={isSidebarCollapsed}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onActivate={setActiveTabId}
            onRename={renameTab}
            onClose={closeTab}
            onCloseOthers={closeOtherTabs}
            onCloseAll={closeAllTabs}
            onReorder={setTabs}
            onOpenSettings={openSettings}
          />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <EditorToolbar
              wordWrap={settings.wordWrap}
              onAdd={addTab}
              onFormat={formatJson}
              onCompress={compressJson}
              onEscape={escapeJson}
              onUnescape={unescapeJson}
              onCopy={copyJson}
              onToggleWordWrap={toggleWordWrap}
              onClear={clearEditor}
            />

            <div className="relative min-h-0 flex-1" aria-label="JSON editor">
              {monacoLoadState === 'ready' ? (
                <Editor
                  height="100%"
                  language="json"
                  path={getTabModelPath(activeTab.id)}
                  defaultValue={activeTab.id === INITIAL_TAB.id ? JSON_STARTER : ''}
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

            <EditorStatusBar editor={editorInstance} feedback={activeFeedback} />
          </div>
        </section>
        {toast && (
          <div className={`toast-notice fixed bottom-14 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-2 text-sm ${toast.tone === 'success' ? 'border-[#b7ead7] bg-white text-[#176b4e]' : 'border-[#f5c8cf] bg-white text-[#b42318]'}`} role="status" aria-live="polite">
            <Check size={16} className={toast.tone === 'success' ? 'text-[#138a62]' : 'text-[#d44857]'} />{toast.message}
          </div>
        )}
      </main>
    </TooltipProvider>
  )
}

export default EditorApp
