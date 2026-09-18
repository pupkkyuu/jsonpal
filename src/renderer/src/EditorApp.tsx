import Editor, { loader, type OnMount, type OnValidate } from '@monaco-editor/react'
import { Check, LoaderCircle, PanelLeftClose, PanelLeftOpen, RefreshCw, WifiOff } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorToolbar } from '@/components/EditorToolbar'
import { TabSidebar } from '@/components/TabSidebar'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { mergeEditorSettings } from '@/editorSettings'
import { useJsonTransformWorker } from '@/hooks/useJsonTransformWorker'
import { getTabModelPath, INITIAL_TAB, WAITING_FEEDBACK, type JsonTab, type TabFeedback } from '@/jsonUtils'
import { getMonacoOptions } from '@/monacoOptions'
import type { JsonTransformAction, JsonTransformError } from '@/jsonTransformTypes'
import { IS_MACOS } from '@/lib/utils'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const CONTENT_DEBOUNCE_MS = 200
const JSON_STARTER = `{
  "message": "在这里粘贴或输入 JSON",
  "example": true,
  "items": []
}`

function hasContent(model: editor.ITextModel): boolean {
  return model.getValueLength() > 0
}

function getTransformErrorFeedback(error: JsonTransformError): TabFeedback {
  return {
    message: error.line === null || error.column === null ? 'JSON 格式错误' : `JSON 格式错误：第 ${error.line} 行，第 ${error.column} 列`,
    isValid: false,
    parseErrorLine: error.line ?? 1
  }
}

// Development serves Monaco directly from node_modules; production ships the same version locally.
const monacoVsPath = import.meta.env.DEV
  ? new URL('/vs', window.location.origin).toString()
  : new URL('./vs', window.location.href).toString()
loader.config({ paths: { vs: monacoVsPath } })

let monacoLocalePromise: Promise<void> | null = null

function loadMonacoLocale(): Promise<void> {
  if ((globalThis as { _VSCODE_NLS_LANGUAGE?: string })._VSCODE_NLS_LANGUAGE === 'zh-cn') {
    return Promise.resolve()
  }

  monacoLocalePromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${monacoVsPath}/nls/lang/zh-cn.js`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Monaco 中文语言包加载失败'))
    document.head.appendChild(script)
  })

  return monacoLocalePromise
}

type MonacoLoadState = 'loading' | 'ready' | 'error'

interface MonacoLoadingStateProps {
  state: MonacoLoadState
  onRetry: () => void
}

function MonacoLoadingState({ state, onRetry }: MonacoLoadingStateProps): React.JSX.Element {
  if (state === 'error') {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 bg-white px-6 text-center"
        role="alert"
        aria-live="assertive"
      >
        <WifiOff size={24} className="text-[#c72e0f]" aria-hidden="true" />
        <p className="text-sm font-medium text-[#333333]">编辑器加载失败</p>
        <p className="max-w-sm text-xs text-[#616161]">无法加载 Monaco 编辑器资源，请重试或检查应用资源是否完整。</p>
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

function EditorStatusBar({ editor, feedback }: EditorStatusBarProps): React.JSX.Element {
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

function EditorApp(): React.JSX.Element {
  const [monacoLoadState, setMonacoLoadState] = useState<MonacoLoadState>('loading')
  const editorRef = useRef<EditorInstance | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const [editorInstance, setEditorInstance] = useState<EditorInstance | null>(null)
  const errorDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)
  const formatJsonRef = useRef<() => Promise<void>>(async () => undefined)
  const compressJsonRef = useRef<() => Promise<void>>(async () => undefined)
  const toggleSequenceRef = useRef(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const navigationRef = useRef({ tabs: [] as JsonTab[], activeTabId: '' })
  const previousTabIdsRef = useRef(new Set<string>())

  const tabs = useWorkspaceStore((state) => state.tabs)
  const activeTabId = useWorkspaceStore((state) => state.activeTabId)
  const statesByTab = useWorkspaceStore((state) => state.statesByTab)
  const settings = useWorkspaceStore((state) => state.settings)
  const isSidebarCollapsed = useWorkspaceStore((state) => state.isSidebarCollapsed)
  const sidebarWidth = useWorkspaceStore((state) => state.sidebarWidth)
  const toast = useWorkspaceStore((state) => state.toast)
  const setTabs = useWorkspaceStore((state) => state.setTabs)
  const setActiveTabId = useWorkspaceStore((state) => state.setActiveTabId)
  const setTabFeedback = useWorkspaceStore((state) => state.setTabFeedback)
  const setTabValidation = useWorkspaceStore((state) => state.setTabValidation)
  const addTab = useWorkspaceStore((state) => state.addTab)
  const renameTab = useWorkspaceStore((state) => state.renameTab)
  const closeTab = useWorkspaceStore((state) => state.closeTab)
  const closeOtherTabs = useWorkspaceStore((state) => state.closeOtherTabs)
  const closeAllTabs = useWorkspaceStore((state) => state.closeAllTabs)
  const setSettings = useWorkspaceStore((state) => state.setSettings)
  const setSidebarCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed)
  const setSidebarWidth = useWorkspaceStore((state) => state.setSidebarWidth)
  const setToast = useWorkspaceStore((state) => state.setToast)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!
  const activeState = statesByTab[activeTab.id]
  const activeFeedback = activeState?.feedback ?? WAITING_FEEDBACK
  const markerErrorLines = activeState?.errorLines ?? []

  const handleTabClosed = useCallback((tabId: string) => {
    const monaco = monacoRef.current
    const model = monaco ? monaco.editor.getModel(monaco.Uri.parse(getTabModelPath(tabId))) : null
    model?.dispose()
  }, [])
  const runJsonWorker = useJsonTransformWorker()

  useEffect(() => {
    const currentTabIds = new Set(tabs.map((tab) => tab.id))
    previousTabIdsRef.current.forEach((tabId) => {
      if (!currentTabIds.has(tabId)) handleTabClosed(tabId)
    })
    previousTabIdsRef.current = currentTabIds
  }, [handleTabClosed, tabs])

  useEffect(() => {
    let isMounted = true
    void loadMonacoLocale()
      .then(() => loader.init())
      .then(() => {
        if (isMounted) setMonacoLoadState('ready')
      })
      .catch((error: unknown) => {
        if (isMounted && (error as { type?: string })?.type !== 'cancelation') setMonacoLoadState('error')
      })

    return () => {
      isMounted = false
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
    setSidebarCollapsed(!isSidebarCollapsed)
  }, [isSidebarCollapsed, setSidebarCollapsed])

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success'): void => {
    clearTimeout(toastTimerRef.current)
    setToast({ message, tone })
    toastTimerRef.current = setTimeout(() => setToast(null), 1800)
  }, [])

  useEffect(() => () => clearTimeout(toastTimerRef.current), [])

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

  const runJsonTransform = useCallback(async (action: JsonTransformAction): Promise<void> => {
    const currentEditor = editorRef.current
    const model = currentEditor?.getModel()
    if (!currentEditor || !model) return

    if (!hasContent(model)) {
      setTabFeedback(activeTab.id, WAITING_FEEDBACK)
      currentEditor.focus()
      return
    }

    const versionId = model.getAlternativeVersionId()
    const value = model.getValue()
    try {
      const response = await runJsonWorker(action, value)
      if (currentEditor.getModel() !== model || model.getAlternativeVersionId() !== versionId) return

      if (!response.ok) {
        setTabFeedback(activeTab.id, getTransformErrorFeedback(response.error))
        return
      }

      if (action === 'unescape' && response.changed === false) {
        const message = '当前内容无需去除 JSON 转义'
        setTabFeedback(activeTab.id, { message, isValid: true, parseErrorLine: null })
        showToast(message)
        return
      }

      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: response.text }], () => null)
      const isValid = response.isValidJson ?? true
      const message = action === 'compress'
        ? '已压缩 JSON'
        : action === 'escape'
          ? '已转义 JSON 文本'
          : isValid ? '已去除 JSON 转义' : '已去除 JSON 转义，结果不是有效 JSON'
      setTabFeedback(activeTab.id, { message, isValid, parseErrorLine: null })
      showToast(action === 'compress' ? 'JSON 已压缩' : action === 'escape' ? 'JSON 文本已转义' : '已去除 JSON 转义')
    } catch {
      setTabFeedback(activeTab.id, { message: 'JSON 处理器不可用', isValid: false, parseErrorLine: null })
      showToast('JSON 处理器不可用', 'error')
    } finally {
      currentEditor.focus()
    }
  }, [activeTab.id, runJsonWorker, setTabFeedback, showToast])

  const compressJson = useCallback(() => runJsonTransform('compress'), [runJsonTransform])
  const escapeJson = useCallback(() => runJsonTransform('escape'), [runJsonTransform])
  const unescapeJson = useCallback(() => runJsonTransform('unescape'), [runJsonTransform])

  const foldAll = useCallback(() => {
    void editorInstance?.getAction('editor.foldAll')?.run()
  }, [editorInstance])

  const unfoldAll = useCallback(() => {
    void editorInstance?.getAction('editor.unfoldAll')?.run()
  }, [editorInstance])

  const applyMarkerState = useCallback(
    (tabId: string, model: editor.ITextModel, markers: Parameters<OnValidate>[0]) => {
      const monaco = monacoRef.current
      if (!monaco) return

      let firstError: Parameters<OnValidate>[0][number] | null = null
      const errorLineSet = new Set<number>()
      for (const marker of markers) {
        if (marker.severity !== monaco.MarkerSeverity.Error) continue
        errorLineSet.add(marker.startLineNumber)
        if (
          !firstError ||
          marker.startLineNumber < firstError.startLineNumber ||
          (marker.startLineNumber === firstError.startLineNumber && marker.startColumn < firstError.startColumn)
        ) {
          firstError = marker
        }
      }

      const errorLines = [...errorLineSet].sort((a, b) => a - b)
      const feedback: TabFeedback = firstError
        ? {
            message: `JSON 格式错误：第 ${firstError.startLineNumber} 行，第 ${firstError.startColumn} 列`,
            isValid: false,
            parseErrorLine: firstError.startLineNumber
          }
        : hasContent(model)
          ? { message: 'JSON 有效', isValid: true, parseErrorLine: null }
          : WAITING_FEEDBACK
      setTabValidation(tabId, feedback, errorLines)
    },
    [setTabValidation]
  )

  const readMarkerState = useCallback(
    (tabId: string) => {
      const model = editorRef.current?.getModel()
      const monaco = monacoRef.current
      if (!model || !monaco) return
      applyMarkerState(tabId, model, monaco.editor.getModelMarkers({ resource: model.uri }))
    },
    [applyMarkerState]
  )

  const formatJson = useCallback(async (): Promise<void> => {
    const currentEditor = editorRef.current
    const model = currentEditor?.getModel()
    if (!currentEditor || !model) return

    if (!hasContent(model)) {
      setTabFeedback(activeTab.id, WAITING_FEEDBACK)
      currentEditor.focus()
      return
    }

    const formatAction = currentEditor.getAction('editor.action.formatDocument')
    if (!formatAction) {
      setTabFeedback(activeTab.id, { message: 'JSON 格式化器不可用', isValid: false, parseErrorLine: null })
      showToast('JSON 格式化器不可用', 'error')
      return
    }

    try {
      await formatAction.run()
      readMarkerState(activeTab.id)
      showToast('JSON 已格式化')
    } catch {
      readMarkerState(activeTab.id)
      showToast('JSON 格式化失败', 'error')
    } finally {
      currentEditor.focus()
    }
  }, [activeTab.id, readMarkerState, setTabFeedback, showToast])

  useEffect(() => {
    formatJsonRef.current = formatJson
  }, [formatJson])

  useEffect(() => {
    compressJsonRef.current = compressJson
  }, [compressJson])

  const handleValidate: OnValidate = useCallback((markers) => {
    const model = editorRef.current?.getModel()
    if (model) applyMarkerState(activeTab.id, model, markers)
  }, [activeTab.id, applyMarkerState])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setEditorInstance(editor)
    editor.addAction({
      id: 'jsonpal-format',
      label: '格式化 JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => formatJsonRef.current()
    })
    editor.addAction({
      id: 'jsonpal-compress',
      label: '压缩 JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyM],
      run: () => compressJsonRef.current()
    })
    requestAnimationFrame(() => editor.layout())
  }

  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      editorRef.current?.layout({ width: Math.round(width), height: Math.round(height) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [editorInstance])

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
              onFoldAll={foldAll}
              onUnfoldAll={unfoldAll}
              onToggleWordWrap={toggleWordWrap}
              onClear={clearEditor}
            />

            <div ref={editorContainerRef} className="relative min-h-0 flex-1" aria-label="JSON editor">
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
            {toast && (
              <div className="pointer-events-none absolute bottom-14 left-1/2 z-50 -translate-x-1/2">
                <div className={`toast-notice flex items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm ${toast.tone === 'success' ? 'border-[#b7ead7] bg-white text-[#176b4e]' : 'border-[#f5c8cf] bg-white text-[#b42318]'}`} role="status" aria-live="polite">
                  <Check size={16} className={toast.tone === 'success' ? 'text-[#138a62]' : 'text-[#d44857]'} />{toast.message}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </TooltipProvider>
  )
}

export default EditorApp
