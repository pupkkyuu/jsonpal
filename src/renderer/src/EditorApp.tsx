import Editor, { loader, type OnMount, type OnValidate } from '@monaco-editor/react'
import { LoaderCircle, RefreshCw, WifiOff } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ComparisonEditor, type ComparisonEditorHandle, type ComparisonViewState } from '@/components/ComparisonEditor'
import { EditorToolbar } from '@/components/EditorToolbar'
import { EditorSearch, type EditorSearchHandle, type EditorSearchState } from '@/components/EditorSearch'
import { TabSidebar } from '@/components/TabSidebar'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import SettingsApp from '@/SettingsApp'
import { mergeEditorSettings } from '@/editorSettings'
import { useAutoSaveSettings } from '@/hooks/useAutoSaveSettings'
import { useEditorTransition } from '@/hooks/useEditorTransition'
import { useJsonTransformWorker } from '@/hooks/useJsonTransformWorker'
import { useEditorContextMenu } from '@/hooks/useEditorContextMenu'
import { getDiffModelPaths, getTabModelPath, INITIAL_TAB, WAITING_FEEDBACK, type JsonTab, type TabFeedback } from '@/jsonUtils'
import { getMonacoOptions } from '@/monacoOptions'
import { replaceModelText, transformModels } from '@/modelTransforms'
import type { JsonTransformAction, JsonTransformError } from '@/jsonTransformTypes'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

const JSON_STARTER = `{
  "Box": "It's bigger on the inside."
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
        <WifiOff size={24} className="text-[var(--danger)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--text-primary)]">编辑器加载失败</p>
        <p className="max-w-sm text-xs text-[var(--text-secondary)]">无法加载 Monaco 编辑器资源，请重试或检查应用资源是否完整。</p>
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw size={15} />
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-white text-center" role="status" aria-live="polite">
      <LoaderCircle size={24} className="animate-spin text-[var(--text-secondary)]" aria-hidden="true" />
      <p className="text-sm text-[var(--text-secondary)]">正在加载编辑器...</p>
    </div>
  )
}

function EditorApp(): React.JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { updateSettings, saveError } = useAutoSaveSettings()
  const [monacoLoadState, setMonacoLoadState] = useState<MonacoLoadState>('loading')
  const editorRef = useRef<EditorInstance | null>(null)
  const comparisonRef = useRef<ComparisonEditorHandle | null>(null)
  const searchRef = useRef<EditorSearchHandle | null>(null)
  const searchStatesRef = useRef(new Map<string, EditorSearchState>())
  const comparisonViewsRef = useRef(new Map<string, ComparisonViewState>())
  const [comparisonBusy, setComparisonBusy] = useState(false)
  const tabTransition = useEditorTransition()
  const readyTabRef = useRef<string | null>(null)
  const tabTransitionFrameRef = useRef(0)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const [editorInstance, setEditorInstance] = useState<EditorInstance | null>(null)
  const errorDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)
  const formatJsonRef = useRef<() => Promise<void>>(async () => undefined)
  const compressJsonRef = useRef<() => Promise<void>>(async () => undefined)
  const transformBusyRef = useRef(false)
  const navigationRef = useRef({ tabs: [] as JsonTab[], activeTabId: '' })
  const previousTabIdsRef = useRef(new Set<string>())

  const tabs = useWorkspaceStore((state) => state.tabs)
  const activeTabId = useWorkspaceStore((state) => state.activeTabId)
  const settings = useWorkspaceStore((state) => state.settings)
  const isSidebarCollapsed = useWorkspaceStore((state) => state.isSidebarCollapsed)
  const sidebarWidth = useWorkspaceStore((state) => state.sidebarWidth)
  const setTabs = useWorkspaceStore((state) => state.setTabs)
  const setActiveTabId = useWorkspaceStore((state) => state.setActiveTabId)
  const setTabFeedback = useWorkspaceStore((state) => state.setTabFeedback)
  const setTabValidation = useWorkspaceStore((state) => state.setTabValidation)
  const addTab = useWorkspaceStore((state) => state.addTab)
  const addDiffTab = useWorkspaceStore((state) => state.addDiffTab)
  const renameTab = useWorkspaceStore((state) => state.renameTab)
  const closeTab = useWorkspaceStore((state) => state.closeTab)
  const closeOtherTabs = useWorkspaceStore((state) => state.closeOtherTabs)
  const closeAllTabs = useWorkspaceStore((state) => state.closeAllTabs)
  const setSettings = useWorkspaceStore((state) => state.setSettings)
  const setSidebarCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed)
  const setSidebarWidth = useWorkspaceStore((state) => state.setSidebarWidth)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]!
  // Subscribe to only the active tab's validation state. Validation for another
  // tab must not rerender the whole editor workspace.
  const activeState = useWorkspaceStore((state) => state.statesByTab[activeTab.id])
  const compareMode = activeState?.compareMode ?? 'edit'
  const activeFeedback = activeState?.feedback ?? WAITING_FEEDBACK
  const markerErrorLines = activeState?.errorLines ?? []

  useLayoutEffect(() => { readyTabRef.current = null }, [activeTab.id])

  // Observe the store before React replaces the outgoing editor. This covers
  // sidebar, keyboard, add/close actions, and programmatic tab navigation.
  useLayoutEffect(() => {
    const unsubscribe = useWorkspaceStore.subscribe((state, previous) => {
      if (state.activeTabId === previous.activeTabId) return
      tabTransition.prepare()
      cancelAnimationFrame(tabTransitionFrameRef.current)
      tabTransitionFrameRef.current = requestAnimationFrame(() => {
        // React can batch A -> B -> A without remounting A. Its last completed
        // frame is still ready, so no new mount callback will arrive.
        if (readyTabRef.current === state.activeTabId &&
          useWorkspaceStore.getState().activeTabId === state.activeTabId) tabTransition.reveal()
      })
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(tabTransitionFrameRef.current)
    }
  }, [tabTransition.prepare, tabTransition.reveal])

  const handleTabEditorReady = useCallback((tabId: string): void => {
    if (useWorkspaceStore.getState().activeTabId !== tabId) return
    readyTabRef.current = tabId
    tabTransition.reveal()
  }, [tabTransition.reveal])

  const handleTabClosed = useCallback((tabId: string) => {
    searchStatesRef.current.delete(tabId)
    comparisonViewsRef.current.delete(tabId)
    const monaco = monacoRef.current
    if (!monaco) return
    monaco.editor.getModel(monaco.Uri.parse(getTabModelPath(tabId)))?.dispose()
    const diffPaths = getDiffModelPaths(tabId)
    monaco.editor.getModel(monaco.Uri.parse(diffPaths.original))?.dispose()
    monaco.editor.getModel(monaco.Uri.parse(diffPaths.modified))?.dispose()
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
    updateSettings({ wordWrap: !settings.wordWrap })
  }, [settings.wordWrap, updateSettings])

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const editorOptions = useMemo(() => getMonacoOptions(settings), [settings])
  const { registerEditor, contextMenu: editorContextMenu } = useEditorContextMenu(activeTab.id)

  const toggleSidebar = useCallback((): void => {
    const focusWasInSidebar = !isSidebarCollapsed &&
      document.getElementById('tab-sidebar')?.contains(document.activeElement)
    setSidebarCollapsed(!isSidebarCollapsed)
    if (focusWasInSidebar) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('.workspace .sidebar-toggle')?.focus()
      })
    }
  }, [isSidebarCollapsed, setSidebarCollapsed])

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
    if (model.getValueLength() === 0 && text.length === 0) return
    replaceModelText(model, text)
  }, [])

  const activeFeedbackRef = useRef(activeFeedback)

  useEffect(() => {
    activeFeedbackRef.current = activeFeedback
  }, [activeFeedback])

  const copyJson = useCallback(async () => {
    if (activeTab.kind === 'diff') {
      await comparisonRef.current?.copy()
      return
    }
    const value = editorRef.current?.getModel()?.getValue() ?? ''
    try {
      await navigator.clipboard.writeText(value)
      setTabFeedback(activeTab.id, { ...activeFeedbackRef.current, message: '已复制到剪贴板', isValid: true })
    } catch {
      setTabFeedback(activeTab.id, { ...activeFeedbackRef.current, message: '无法访问剪贴板', isValid: false })
    }
  }, [activeTab.id, activeTab.kind, setTabFeedback])

  const clearEditor = useCallback(() => {
    applyModelValue('')
    editorRef.current?.focus()
  }, [applyModelValue])

  const clearDiffEditor = useCallback(() => comparisonRef.current?.clear(), [])
  const compareJson = useCallback(() => { void comparisonRef.current?.toggle() }, [])
  const previousDiff = useCallback(() => comparisonRef.current?.goToDiff('previous'), [])
  const nextDiff = useCallback(() => comparisonRef.current?.goToDiff('next'), [])
  const handleComparisonActiveEditor = useCallback((instance: EditorInstance | null, monaco?: MonacoInstance) => {
    editorRef.current = null
    errorDecorationsRef.current?.clear()
    errorDecorationsRef.current = null
    if (monaco) monacoRef.current = monaco
    setEditorInstance(instance)
  }, [])

  const runJsonTransform = useCallback(async (action: JsonTransformAction): Promise<void> => {
    if (activeTab.kind === 'diff') {
      await comparisonRef.current?.transform(action)
      return
    }
    if (transformBusyRef.current) return
    const currentEditor = editorRef.current
    const model = currentEditor?.getModel()
    if (!currentEditor || !model) return

    if (!hasContent(model)) {
      setTabFeedback(activeTab.id, WAITING_FEEDBACK)
      currentEditor.focus()
      return
    }

    const isCurrent = (): boolean => editorRef.current === currentEditor &&
      useWorkspaceStore.getState().activeTabId === activeTab.id && currentEditor.getModel() === model
    transformBusyRef.current = true
    try {
      const response = await transformModels([model], action, runJsonWorker, isCurrent)
      if (!response) return

      if (!response.ok) {
        setTabFeedback(activeTab.id, getTransformErrorFeedback(response.error))
        return
      }

      if (action === 'unescape' && response.changed === false) {
        const message = '当前内容无需去除 JSON 转义'
        setTabFeedback(activeTab.id, { message, isValid: true, parseErrorLine: null })
        return
      }

      const isValid = response.isValidJson ?? true
      const message = action === 'compress'
        ? '已压缩 JSON'
        : action === 'escape'
          ? '已转义 JSON 文本'
          : action === 'sort'
            ? '已按字段排序 JSON'
            : isValid ? '已去除 JSON 转义' : '已去除 JSON 转义，结果不是有效 JSON'
      setTabFeedback(activeTab.id, { message, isValid, parseErrorLine: null })
    } catch {
      if (!isCurrent()) return
      setTabFeedback(activeTab.id, { message: 'JSON 处理器不可用', isValid: false, parseErrorLine: null })
    } finally {
      transformBusyRef.current = false
      if (isCurrent()) currentEditor.focus()
    }
  }, [activeTab.id, activeTab.kind, runJsonWorker, setTabFeedback])

  const compressJson = useCallback(() => runJsonTransform('compress'), [runJsonTransform])
  const escapeJson = useCallback(() => runJsonTransform('escape'), [runJsonTransform])
  const unescapeJson = useCallback(() => runJsonTransform('unescape'), [runJsonTransform])
  const sortJson = useCallback(() => runJsonTransform('sort'), [runJsonTransform])

  const foldAll = useCallback(() => {
    if (activeTab.kind === 'diff') void comparisonRef.current?.fold('editor.foldAll')
    else void editorInstance?.getAction('editor.foldAll')?.run()
  }, [activeTab.kind, editorInstance])

  const unfoldAll = useCallback(() => {
    if (activeTab.kind === 'diff') void comparisonRef.current?.fold('editor.unfoldAll')
    else void editorInstance?.getAction('editor.unfoldAll')?.run()
  }, [activeTab.kind, editorInstance])

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
      if (!model || !monaco || model.uri.toString() !== getTabModelPath(tabId)) return
      applyMarkerState(tabId, model, monaco.editor.getModelMarkers({ resource: model.uri }))
    },
    [applyMarkerState]
  )

  const formatJson = useCallback(async (): Promise<void> => {
    if (activeTab.kind === 'diff') {
      await comparisonRef.current?.format()
      return
    }
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
      return
    }

    const isCurrent = (): boolean => editorRef.current === currentEditor &&
      useWorkspaceStore.getState().activeTabId === activeTab.id &&
      !model.isDisposed() && currentEditor.getModel() === model
    try {
      await formatAction.run()
      if (!isCurrent()) return
      readMarkerState(activeTab.id)
    } catch {
      if (!isCurrent()) return
      readMarkerState(activeTab.id)
    } finally {
      if (isCurrent()) currentEditor.focus()
    }
  }, [activeTab.id, activeTab.kind, readMarkerState, setTabFeedback])

  useEffect(() => {
    formatJsonRef.current = formatJson
  }, [formatJson])

  useEffect(() => {
    compressJsonRef.current = compressJson
  }, [compressJson])

  const handleValidate: OnValidate = useCallback((markers) => {
    const model = editorRef.current?.getModel()
    if (model?.uri.toString() === getTabModelPath(activeTab.id)) applyMarkerState(activeTab.id, model, markers)
  }, [activeTab.id, applyMarkerState])

  const handleEditorMount: OnMount = (editor, monaco) => {
    registerEditor(editor)
    errorDecorationsRef.current = null
    editorRef.current = editor
    monacoRef.current = monaco
    setEditorInstance(editor)
    editor.onDidDispose(() => {
      if (editorRef.current !== editor) return
      editorRef.current = null
      errorDecorationsRef.current = null
      setEditorInstance(current => current === editor ? null : current)
    })
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

  useLayoutEffect(() => {
    if (monacoLoadState === 'error') {
      tabTransition.reveal()
      return
    }
    if (activeTab.kind !== 'json' || monacoLoadState !== 'ready') return
    const frame = requestAnimationFrame(() => {
      const instance = editorRef.current
      if (instance?.getModel()?.uri.toString() !== getTabModelPath(activeTab.id)) return
      instance.layout()
      handleTabEditorReady(activeTab.id)
    })
    return () => cancelAnimationFrame(frame)
  }, [activeTab.id, activeTab.kind, editorInstance, monacoLoadState, handleTabEditorReady, tabTransition.reveal])

  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      // CSS sidebar transitions resize the container on every frame. Lay out
      // Monaco in this observer before paint, without remounting the editor.
      if (width > 0 && height > 0) {
        editorRef.current?.layout({ width: Math.round(width), height: Math.round(height) })
      }
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
        setIsSettingsOpen(false)
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
        setIsSettingsOpen(false)
        setActiveTabId(currentTabs[nextIndex]!.id)
        return
      }

      const digitMatch = /^([1-9])$/.exec(event.key)
      if (digitMatch) {
        const target = currentTabs[Number(digitMatch[1]) - 1]
        if (target) {
          event.preventDefault()
          setIsSettingsOpen(false)
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
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    applyBracketColorization(settings.bracketPairColorization)
  }, [activeTab.id, applyBracketColorization, editorInstance, settings.bracketPairColorization])

  useEffect(() => {
    if (activeTab.kind !== 'json') return
    const frame = requestAnimationFrame(() => readMarkerState(activeTab.id))
    return () => cancelAnimationFrame(frame)
  }, [activeTab.id, activeTab.kind, editorInstance, readMarkerState])

  useEffect(() => {
    if (activeTab.kind !== 'json') return
    const currentEditor = editorRef.current
    const monaco = monacoRef.current
    // Tab changes can render before Monaco has mounted the replacement editor
    // or switched its model. Apply decorations only to the ready JSON editor.
    if (!currentEditor || currentEditor !== editorInstance || !monaco ||
      currentEditor.getModel()?.uri.toString() !== getTabModelPath(activeTab.id)) return

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
          overviewRuler: { color: getComputedStyle(document.documentElement).getPropertyValue('--danger').trim(), position: monaco.editor.OverviewRulerLane.Full }
        }
      }))
    )
  }, [activeFeedback.parseErrorLine, activeTab.id, activeTab.kind, editorInstance, markerErrorLines])


  if (!searchStatesRef.current.has(activeTab.id)) searchStatesRef.current.set(activeTab.id, {})

  if (activeTab.kind === 'diff' && !comparisonViewsRef.current.has(activeTab.id)) {
    comparisonViewsRef.current.set(activeTab.id, { focus: { edit: 'original' } })
  }

  return (
    <TooltipProvider delayDuration={250}>
      <main className="app-shell flex h-full min-h-0 min-w-0 overflow-hidden">
        <TabSidebar
          tabs={tabs}
          activeTabId={activeTab.id}
          isCollapsed={isSidebarCollapsed}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onActivate={(tabId) => {
            setIsSettingsOpen(false)
            setActiveTabId(tabId)
          }}
          onRename={renameTab}
          onClose={closeTab}
          onCloseOthers={closeOtherTabs}
          onCloseAll={closeAllTabs}
          onReorder={setTabs}
          onOpenSettings={openSettings}
          onToggle={toggleSidebar}
          onAdd={() => {
            setIsSettingsOpen(false)
            addTab()
          }}
          onAddDiff={() => {
            setIsSettingsOpen(false)
            addDiffTab()
          }}
        />
        <div className="workspace relative flex min-h-0 min-w-0 flex-1 flex-col">
          {isSettingsOpen && <SettingsApp
            updateSettings={updateSettings}
            saveError={saveError}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            onBack={() => {
              setIsSettingsOpen(false)
              requestAnimationFrame(() => editorRef.current?.focus())
            }}
          />}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={isSettingsOpen ? { display: 'none' } : undefined} inert={isSettingsOpen} aria-hidden={isSettingsOpen}>
            <EditorToolbar
              wordWrap={settings.wordWrap}
              title={activeTab.title}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={toggleSidebar}
              onFormat={formatJson}
              onSort={sortJson}
              onCompress={compressJson}
              onEscape={escapeJson}
              onUnescape={unescapeJson}
              onCopy={copyJson}
              onFoldAll={foldAll}
              onUnfoldAll={unfoldAll}
              onToggleWordWrap={toggleWordWrap}
              onClear={activeTab.kind === 'diff' ? clearDiffEditor : clearEditor}
              onSearch={() => activeTab.kind === 'diff' ? comparisonRef.current?.toggleSearch() : searchRef.current?.toggle()}
              mode={activeTab.kind}
              onCompare={compareJson}
              onPreviousDiff={previousDiff}
              onNextDiff={nextDiff}
              compareMode={compareMode}
              comparisonBusy={comparisonBusy}
            />

            <div ref={editorContainerRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden" aria-label="JSON editor">
              <div ref={tabTransition.content} className="h-full">
                {monacoLoadState === 'ready' ? (
                  activeTab.kind === 'diff' ? (
                    <ComparisonEditor
                      key={activeTab.id}
                      ref={comparisonRef}
                      tabId={activeTab.id}
                      mode={compareMode}
                      options={editorOptions}
                      viewState={comparisonViewsRef.current.get(activeTab.id)!}
                      runWorker={runJsonWorker}
                      onActiveEditor={handleComparisonActiveEditor}
                      onReady={() => handleTabEditorReady(activeTab.id)}
                      onBusy={setComparisonBusy}
                      onRegisterEditor={registerEditor}
                    />
                  ) : (
                    <Editor
                      height="100%"
                      language="json"
                      path={getTabModelPath(activeTab.id)}
                      defaultValue={activeTab.id === INITIAL_TAB.id ? JSON_STARTER : ''}
                      saveViewState
                      keepCurrentModel
                      theme="vs"
                      onMount={handleEditorMount}
                      onValidate={handleValidate}
                      loading={<MonacoLoadingState state="loading" onRetry={() => window.location.reload()} />}
                      options={editorOptions}
                    />
                  )
                ) : (
                  <MonacoLoadingState state={monacoLoadState} onRetry={() => window.location.reload()} />
                )}
              </div>
              <div ref={tabTransition.overlay} data-editor-transition="tab" className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" inert />
              {activeTab.kind === 'json' && (
                <EditorSearch key={activeTab.id} ref={searchRef} instance={editorInstance} monaco={monacoRef.current}
                  tabId={activeTab.id} state={searchStatesRef.current.get(activeTab.id)!} />
              )}
            </div>
          </div>
        </div>
      </main>
      {!isSettingsOpen && editorContextMenu}
    </TooltipProvider>
  )
}

export default EditorApp
