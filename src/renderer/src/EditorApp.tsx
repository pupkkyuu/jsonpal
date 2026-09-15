import Editor, { loader, type OnMount } from '@monaco-editor/react'
import { Check, LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorToolbar } from '@/components/EditorToolbar'
import { TabSidebar } from '@/components/TabSidebar'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DEFAULT_EDITOR_SETTINGS, mergeEditorSettings, type EditorSettings } from '@/editorSettings'
import { useJsonTabs } from '@/hooks/useJsonTabs'
import { getParseErrorFeedback, getTabModelPath, isValidJson, unescapeJsonText, WAITING_FEEDBACK, type JsonTab, type TabFeedback } from '@/jsonUtils'
import { getMonacoOptions } from '@/monacoOptions'
import { IS_MACOS } from '@/lib/utils'

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const CONTENT_DEBOUNCE_MS = 200

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

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#e5e5e5] bg-[#f3f3f3] px-4 text-xs text-[#616161]">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-1.5 w-1.5 shrink-0 rounded-full ${feedback.isValid ? 'bg-[#16825d]' : 'bg-[#f14c4c]'}`} />
        <span className={`truncate ${feedback.isValid ? 'text-[#616161]' : 'text-[#c72e0f]'}`}>{feedback.message}</span>
      </div>
      <div className="ml-4 flex shrink-0 items-center gap-4">
        <span>{indent.insertSpaces ? `空格: ${indent.tabSize}` : `Tab 大小: ${indent.tabSize}`}</span>
        <span>{stats.lines} 行</span>
        <span>{stats.chars} 字符</span>
        <span className="flex items-center gap-1 text-[#616161]">
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
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const [editorInstance, setEditorInstance] = useState<EditorInstance | null>(null)
  const errorDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)
  const transformJsonRef = useRef<(spacing: number) => void>(() => undefined)
  const toggleSequenceRef = useRef(0)
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
        } catch (error) {
          setTabFeedback(activeTab.id, getParseErrorFeedback(value, error))
        }
      })
    },
    [activeTab.id, setTabFeedback, withEditorValue]
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
    } catch {
      setTabFeedback(activeTab.id, { ...activeFeedbackRef.current, message: '无法访问剪贴板', isValid: false })
    }
  }, [activeTab.id, setTabFeedback])

  const clearEditor = useCallback(() => {
    applyModelValue('')
    editorRef.current?.focus()
  }, [applyModelValue])

  const escapeJson = useCallback(() => {
    withEditorValue((value, apply) => {
      apply(JSON.stringify(value))
      setTabFeedback(activeTab.id, { message: '已转义 JSON 文本', isValid: true, parseErrorLine: null })
    })
  }, [activeTab.id, setTabFeedback, withEditorValue])

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
      } catch (error) {
        setTabFeedback(activeTab.id, getParseErrorFeedback(value, error))
      }
    })
  }, [activeTab.id, setTabFeedback, withEditorValue])

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
  }

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
        setIsSidebarCollapsed((current) => !current)
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
  }, [addTab, setActiveTabId])

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
  }, [activeTab.id, readMarkerState])

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
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onSetCollapsed={setIsSidebarCollapsed}
            onActivate={setActiveTabId}
            onAdd={addTab}
            onRename={renameTab}
            onClose={closeTab}
            onCloseOthers={closeOtherTabs}
            onCloseAll={closeAllTabs}
            onReorder={setTabs}
            onOpenSettings={openSettings}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <EditorToolbar
              wordWrap={settings.wordWrap}
              onFormat={formatJson}
              onCompress={compressJson}
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

            <EditorStatusBar editor={editorInstance} feedback={activeFeedback} />
          </div>
        </section>
      </main>
    </TooltipProvider>
  )
}

export default EditorApp
