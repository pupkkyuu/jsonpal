import Editor, { DiffEditor, type DiffOnMount, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { forwardRef, useCallback, useImperativeHandle, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getDiffModelPaths, WAITING_FEEDBACK, type CompareViewMode, type TabFeedback } from '@/jsonUtils'
import type { JsonTransformAction, JsonTransformResponse } from '@/jsonTransformTypes'
import { replaceModelText, transformModels } from '@/modelTransforms'
import { EditorSearch, type EditorSearchHandle, type EditorSearchState } from '@/components/EditorSearch'
import { useEditorTransition } from '@/hooks/useEditorTransition'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

type Monaco = Parameters<OnMount>[1]
type Side = 'original' | 'modified'
const SIDES: Side[] = ['original', 'modified']
const LABELS = { original: '左侧', modified: '右侧' }
// Monaco 0.56 reserves two 15px lanes for its diff overview ruler.
// Reserve the same space in input mode so the pane boundaries stay aligned.
const DIFF_OVERVIEW_WIDTH = 30

export interface ComparisonViewState {
  search?: Partial<Record<Side, EditorSearchState>>
  edit?: Partial<Record<Side, editor.ICodeEditorViewState | null>>
  compare?: editor.IDiffEditorViewState | null
  compareScroll?: Partial<Record<Side, number>>
  focus?: Partial<Record<CompareViewMode, Side>>
  handoff?: {
    focus: Side
    panes: Partial<Record<Side, { view: editor.ICodeEditorViewState | null; line: number; column: number; offset: number }>>
  }
  validationErrors?: Partial<Record<Side, { version: number; message: string }>>
}
export interface ComparisonEditorHandle {
  toggle(): void
  format(): Promise<void>
  goToDiff(target: 'previous' | 'next'): void
  transform(action: JsonTransformAction): Promise<void>
  copy(): Promise<void>
  fold(action: 'editor.foldAll' | 'editor.unfoldAll'): Promise<void>
  clear(): void
  toggleSearch(): void
}
interface Props {
  tabId: string
  mode: CompareViewMode
  options: editor.IStandaloneEditorConstructionOptions
  viewState: ComparisonViewState
  runWorker: (action: JsonTransformAction, text: string) => Promise<JsonTransformResponse>
  onActiveEditor: (instance: editor.IStandaloneCodeEditor | null, monaco?: Monaco) => void
  onRegisterEditor: (instance: editor.IStandaloneCodeEditor) => void
  onReady?: () => void
  onBusy: (busy: boolean) => void
}

interface SearchBinding {
  editors: Partial<Record<Side, editor.IStandaloneCodeEditor>>
  activeSide: Side
  monaco: Monaco | null
  busy: boolean
}

export const ComparisonEditor = forwardRef<ComparisonEditorHandle, Props>(function ComparisonEditor(props, ref) {
  const { content, overlay, prepare, reveal } = useEditorTransition()
  const searchRef = useRef<EditorSearchHandle | null>(null)
  const [searchBinding, setSearchBinding] = useState<SearchBinding | null>(null)
  const searchInstances = useMemo(() => SIDES.flatMap(side => searchBinding?.editors[side] ? [searchBinding.editors[side]!] : []), [searchBinding?.editors])
  const toggleSearch = useCallback(() => searchRef.current?.toggle(), [])
  props.viewState.search ??= {}
  for (const side of SIDES) props.viewState.search[side] ??= {}
  const handleReady = useCallback((): void => {
    reveal()
    props.onReady?.()
  }, [reveal, props.onReady])
  return (
    <div className="relative h-full min-h-0">
      <div ref={content} className="h-full">
        <ComparisonEditorPane key={props.mode} {...props} ref={ref} onTransition={prepare} onReady={handleReady} onSearchBinding={setSearchBinding} onToggleSearch={toggleSearch} />
      </div>
      <div ref={overlay} data-editor-transition="comparison" className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" inert />
      <EditorSearch ref={searchRef} instance={searchBinding?.editors.modified ?? null} searchInstances={searchInstances}
        selectionInstance={searchBinding?.editors[searchBinding.activeSide] ?? null} monaco={searchBinding?.monaco ?? null}
        tabId={props.tabId} state={props.viewState.search.modified!} isActive={Boolean(searchBinding && !searchBinding.busy)} animatePlacement
        onStateChange={next => {
          for (const side of SIDES) Object.assign(props.viewState.search![side]!, next)
        }} />
    </div>
  )
})

const ComparisonEditorPane = forwardRef<ComparisonEditorHandle, Props & {
  onTransition: () => void
  onReady: () => void
  onSearchBinding: (binding: SearchBinding | null) => void
  onToggleSearch: () => void
}>(function ComparisonEditorPane(props, ref) {
  const { tabId, mode, options, viewState, runWorker, onActiveEditor, onBusy, onTransition, onReady } = props
  const handleRef = useRef<ComparisonEditorHandle | null>(null)
  const views = useRef<Partial<Record<Side, editor.IStandaloneCodeEditor>>>({})
  const [searchEditors, setSearchEditors] = useState<Partial<Record<Side, editor.IStandaloneCodeEditor>>>({})
  const [activeSide, setActiveSide] = useState<Side>(viewState.focus?.[mode] ?? 'modified')
  viewState.search ??= {}
  for (const side of SIDES) viewState.search[side] ??= {}
  const diffRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const containers = useRef<Partial<Record<Side | 'diff', HTMLDivElement | null>>>({})
  const disposables = useRef<{ dispose(): void }[]>([])
  const epoch = useRef(0)
  const alive = useRef(true)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const completed = useRef(false)
  const validationErrors = useRef(viewState.validationErrors ?? {})
  viewState.validationErrors = validationErrors.current
  const handoff = useRef(viewState.handoff)
  const ready = useRef(false)
  const readyFrame = useRef(0)
  const paths = getDiffModelPaths(tabId)

  useLayoutEffect(() => {
    props.onSearchBinding(ready.current ? { editors: searchEditors, activeSide, monaco: monacoRef.current, busy } : null)
  }, [searchEditors, activeSide, busy, props.onSearchBinding])

  useLayoutEffect(() => () => props.onSearchBinding(null), [props.onSearchBinding])

  const finishMount = (): void => {
    if (ready.current || getModels().length !== 2 || !SIDES.every(side => views.current[side])) return
    if (mode === 'compare' && diffRef.current?.getLineChanges() === null) return
    cancelAnimationFrame(readyFrame.current)
    readyFrame.current = requestAnimationFrame(() => {
      if (!alive.current) return
      // The overview ruler changes pane widths and therefore wrapped lines.
      // Lay out the destination before restoring its viewport or fading in.
      if (mode === 'compare') {
        const rect = containers.current.diff?.getBoundingClientRect()
        if (rect) diffRef.current?.layout({ width: Math.round(rect.width), height: Math.round(rect.height) })
      } else {
        for (const side of SIDES) {
          const rect = containers.current[side]?.getBoundingClientRect()
          if (rect) views.current[side]?.layout({ width: Math.round(rect.width), height: Math.round(rect.height) })
        }
      }
      readyFrame.current = requestAnimationFrame(() => {
        if (!alive.current) return
        const transfer = handoff.current
        if (transfer) {
          // Anchor to the same model position, including wrapped-line columns.
          // Restore focus last because diff scrolling is synchronized.
          const ordered = SIDES.filter(side => side !== transfer.focus).concat(transfer.focus)
          for (const side of ordered) {
            const pane = transfer.panes[side]
            const instance = views.current[side]
            if (pane && instance) instance.setScrollTop(instance.getTopForPosition(pane.line, pane.column) + pane.offset, monacoRef.current!.editor.ScrollType.Immediate)
          }
          delete viewState.handoff
        }
        for (const side of SIDES) views.current[side]?.render(true)
        ready.current = true
        props.onSearchBinding({ editors: { ...views.current }, activeSide: viewState.focus?.[mode] ?? activeSide, monaco: monacoRef.current, busy: busyRef.current })
        onReady()
        onBusy(busyRef.current)
      })
    })
  }

  const transitionTo = (next: CompareViewMode): void => {
    const focus = viewState.focus?.[mode] ?? 'modified'
    viewState.handoff = { focus, panes: {} }
    for (const side of SIDES) {
      const instance = views.current[side]
      if (!instance) continue
      const visible = instance.getVisibleRanges()[0]
      const line = visible?.startLineNumber ?? 1
      const column = visible?.startColumn ?? 1
      viewState.handoff.panes[side] = {
        view: instance.saveViewState(), line, column,
        offset: instance.getScrollTop() - instance.getTopForPosition(line, column)
      }
    }
    viewState.focus ??= {}
    viewState.focus[next] = focus
    onTransition()
    useWorkspaceStore.getState().setCompareMode(tabId, next)
  }

  const getModels = (): editor.ITextModel[] => SIDES.flatMap(side => {
    const model = views.current[side]?.getModel() ?? monacoRef.current?.editor.getModel(monacoRef.current.Uri.parse(paths[side]))
    return model ? [model] : []
  })
  const isCurrent = (token: number): boolean => alive.current && token === epoch.current &&
    useWorkspaceStore.getState().activeTabId === tabId &&
    (useWorkspaceStore.getState().statesByTab[tabId]?.compareMode ?? 'edit') === mode

  const setProcessing = (value: boolean): void => {
    busyRef.current = value
    setBusy(value)
    onBusy(value)
    SIDES.forEach(side => views.current[side]?.updateOptions({ readOnly: value }))
  }

  const syncFeedback = useCallback((): void => {
    const monaco = monacoRef.current
    if (!monaco || !alive.current) return
    const models = SIDES.map(side => views.current[side]?.getModel())
    if (models.some(model => !model || model.isDisposed())) return
    let message: string | undefined
    for (const [index, side] of SIDES.entries()) {
      const model = models[index]!
      const knownError = validationErrors.current[side]
      if (knownError?.version === model.getVersionId()) {
        message = knownError.message
        break
      }
      const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        .filter(marker => marker.severity === monaco.MarkerSeverity.Error)
        .sort((a, b) => a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn)
      if (markers[0]) {
        message = `${LABELS[side]} JSON 格式错误：第 ${markers[0].startLineNumber} 行，第 ${markers[0].startColumn} 列`
        break
      }
    }
    const feedback: TabFeedback = message
      ? { message, isValid: false, parseErrorLine: null }
      : models.every(model => model!.getValueLength() === 0)
        ? WAITING_FEEDBACK
        : { message: mode === 'compare' ? (completed.current ? '对比结果已更新' : '正在计算差异…') : '两侧 JSON 无格式错误', isValid: true, parseErrorLine: null }
    useWorkspaceStore.getState().setTabValidation(tabId, feedback, [])
  }, [tabId, mode])

  const reportDOMFocus = (): void => {
    for (const side of SIDES) {
      const instance = views.current[side]
      if (!instance?.getDomNode()?.contains(document.activeElement)) continue
      viewState.focus ??= {}
      viewState.focus[mode] = side
      setActiveSide(side)
      onActiveEditor(instance, monacoRef.current ?? undefined)
      break
    }
  }

  const attach = (side: Side, instance: editor.IStandaloneCodeEditor, monaco: Monaco): void => {
    props.onRegisterEditor(instance)
    for (const [id, key, run] of [
      ['jsonpal.compare.format', monaco.KeyCode.KeyF, () => handleRef.current?.format()],
      ['jsonpal.compare.compress', monaco.KeyCode.KeyM, () => handleRef.current?.transform('compress')]
    ] as const) {
      disposables.current.push(instance.addAction({ id, label: id, keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | key], run: () => { void run() } }))
    }
    views.current[side] = instance
    monacoRef.current = monaco
    setSearchEditors(current => ({ ...current, [side]: instance }))
    const model = instance.getModel()!
    model.updateOptions({ bracketColorizationOptions: { enabled: options.bracketPairColorization?.enabled ?? false, independentColorPoolPerBracketType: options.bracketPairColorization?.independentColorPoolPerBracketType ?? false } })
    const node = instance.getDomNode()
    const activate = (): void => {
      // DiffEditor can report widget focus on both inner editors. The DOM
      // focus target identifies which pane owns the status bar and view cache.
      if (!node?.contains(document.activeElement)) return
      viewState.focus ??= {}
      viewState.focus[mode] = side
      setActiveSide(side)
      onActiveEditor(instance, monaco)
    }
    node?.addEventListener('focusin', activate, true)
    const focusFrame = requestAnimationFrame(reportDOMFocus)
    disposables.current.push(
      { dispose: () => { node?.removeEventListener('focusin', activate, true); cancelAnimationFrame(focusFrame) } },
      instance.onDidFocusEditorWidget(activate),
      instance.onMouseDown(() => {
        viewState.focus ??= {}
        viewState.focus[mode] = side
        setActiveSide(side)
        onActiveEditor(instance, monaco)
      }),
      model.onDidChangeContent(() => {
        delete validationErrors.current[side]
        completed.current = false
        if (model.getValueLength() === 0) monaco.editor.setModelMarkers(model, 'json', [])
        syncFeedback()
      })
    )
    instance.updateOptions({ readOnly: busyRef.current, glyphMargin: false, minimap: mode === 'compare' ? { ...options.minimap, enabled: false } : options.minimap, folding: options.folding })
    const focusSide = handoff.current?.focus ?? viewState.focus?.[mode] ?? 'modified'
    if (side === focusSide) {
      onActiveEditor(instance, monaco)
      instance.focus()
    }
    if (mode === 'edit') finishMount()
    syncFeedback()
  }

  const mountInput = (side: Side): OnMount => (instance, monaco) => {
    instance.restoreViewState(handoff.current?.panes[side]?.view ?? viewState.edit?.[side] ?? null)
    attach(side, instance, monaco)
  }
  const mountDiff: DiffOnMount = (instance, monaco) => {
    diffRef.current = instance
    if (!handoff.current) instance.restoreViewState(viewState.compare ?? null)
    else for (const side of SIDES) {
      const input = side === 'original' ? instance.getOriginalEditor() : instance.getModifiedEditor()
      input.restoreViewState(handoff.current.panes[side]?.view ?? null)
    }
    completed.current = instance.getLineChanges() !== null
    attach('original', instance.getOriginalEditor(), monaco)
    attach('modified', instance.getModifiedEditor(), monaco)
    let restoreFrame = 0
    let restoredScroll = false
    // A cached computation may already be available at mount; restore both
    // from the mount path and from the first later diff update.
    const restoreScroll = (): void => {
      if (handoff.current || restoredScroll || !viewState.compareScroll) return
      cancelAnimationFrame(restoreFrame)
      restoreFrame = requestAnimationFrame(() => {
        if (!alive.current || instance.getLineChanges() === null) return
        restoredScroll = true
        const side = viewState.focus?.compare ?? 'modified'
        const scroll = viewState.compareScroll?.[side]
        if (scroll !== undefined) views.current[side]?.setScrollTop(scroll, monaco.editor.ScrollType.Immediate)
        reportDOMFocus()
      })
    }
    disposables.current.push({ dispose: () => cancelAnimationFrame(restoreFrame) })
    disposables.current.push(instance.onDidUpdateDiff(() => {
      restoreScroll()
      completed.current = instance.getLineChanges() !== null
      syncFeedback()
      finishMount()
    }))
    restoreScroll()
    finishMount()

  }

  useLayoutEffect(() => {
    alive.current = true
    onBusy(true)
    document.addEventListener('focusin', reportDOMFocus, true)
    const observer = new ResizeObserver(entries => {
      // Each pane owns its dimensions, including throughout sidebar slides.
      // Never lay out an individual diff pane using the full workspace width.
      for (const entry of entries) {
        if (entry.contentRect.width <= 0 || entry.contentRect.height <= 0) continue
        const size = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }
        for (const side of SIDES) {
          if (entry.target === containers.current[side]) views.current[side]?.layout(size)
        }
        if (entry.target === containers.current.diff) diffRef.current?.layout(size)
      }
    })
    Object.values(containers.current).forEach(container => { if (container) observer.observe(container) })
    // The JSON language service reports both sides, independent of focus.
    let markerListener: { dispose(): void } | undefined
    let frame = 0
    const registerMarkers = (): void => {
      if (!alive.current) return
      if (!monacoRef.current) { frame = requestAnimationFrame(registerMarkers); return }
      markerListener = monacoRef.current.editor.onDidChangeMarkers(resources => {
        if (resources.some(uri => getModels().some(model => model.uri.toString() === uri.toString()))) syncFeedback()
      })
      Object.values(containers.current).forEach(container => {
        if (container) {
          const rect = container.getBoundingClientRect()
          observer.unobserve(container)
          observer.observe(container)
          if (mode === 'compare') diffRef.current?.layout({ width: rect.width, height: rect.height })
        }
      })
    }
    frame = requestAnimationFrame(registerMarkers)
    return () => {
      alive.current = false
      epoch.current++
      cancelAnimationFrame(frame)
      cancelAnimationFrame(readyFrame.current)
      observer.disconnect()
      document.removeEventListener('focusin', reportDOMFocus, true)
      markerListener?.dispose()
      // StrictMode also cleans up before asynchronous Monaco mounts finish.
      // Never overwrite a saved view with an unmounted editor's empty state.
      if (mode === 'edit') {
        for (const side of SIDES) {
          if (views.current[side]) {
            viewState.edit ??= {}
            viewState.edit[side] = views.current[side]!.saveViewState()
          }
        }
      } else if (diffRef.current) {
        viewState.compare = diffRef.current.saveViewState()
        viewState.compareScroll = {
          original: views.current.original?.getScrollTop(),
          modified: views.current.modified?.getScrollTop()
        }
      }
      disposables.current.forEach(disposable => disposable.dispose())
      disposables.current = []
      onBusy(false)
      onActiveEditor(null)
    }
  }, [])

  useEffect(() => {
    for (const side of SIDES) {
      views.current[side]?.updateOptions({ glyphMargin: false, minimap: mode === 'compare' ? { ...options.minimap, enabled: false } : options.minimap, folding: options.folding })
      views.current[side]?.getModel()?.updateOptions({
        bracketColorizationOptions: {
          enabled: options.bracketPairColorization?.enabled ?? false,
          independentColorPoolPerBracketType: options.bracketPairColorization?.independentColorPoolPerBracketType ?? false
        }
      })
    }
  }, [options])

  useImperativeHandle(ref, () => {
    const handle: ComparisonEditorHandle = {
      toggleSearch() {
        if (busyRef.current || !ready.current) return
        props.onToggleSearch()
      },
      goToDiff(target) {
        if (mode !== 'compare' || busyRef.current || !ready.current) return
        const instance = diffRef.current
        const changes = instance?.getLineChanges()
        if (!changes) return
        if (changes.length === 0) return
        instance?.goToDiff(target)
      },
      toggle() {
        if (busyRef.current || !ready.current) return
        transitionTo(mode === 'compare' ? 'edit' : 'compare')
      },
      async format() {
        if (mode !== 'edit' || busyRef.current || !ready.current) return
        const models = getModels()
        if (models.length !== 2) return
        const token = ++epoch.current
        const versions = models.map(model => model.getVersionId())
        const current = (): boolean => isCurrent(token) && models.every((model, index) =>
          !model.isDisposed() && model.getVersionId() === versions[index])
        setProcessing(true)
        try {
          for (const [index, side] of SIDES.entries()) {
            if (!current()) return
            const model = models[index]!
            if (model.getValueLength() === 0) continue
            const validation = await runWorker('validate', model.getValue())
            if (!current()) return
            if (!validation.ok) {
              const location = validation.error.line === null ? '' : `：第 ${validation.error.line} 行，第 ${validation.error.column} 列`
              validationErrors.current[side] = { version: model.getVersionId(), message: `${LABELS[side]} JSON 格式错误${location}` }
              continue
            }
            // JSON providers load lazily. Ensure registration has completed
            // before testing the formatting action on a freshly created tab.
            await monacoRef.current!.json.getWorker()
            if (!current()) return
            const input = views.current[side]!
            // The input pane is inert while busy. Monaco's formatting action
            // requires a writable editor even for programmatic invocation.
            input.updateOptions({ readOnly: false })
            const action = input.getAction('editor.action.formatDocument')
            if (!action || !action.isSupported()) throw new Error('JSON 格式化器不可用')
            try {
              await action.run()
            } finally {
              if (isCurrent(token)) input.updateOptions({ readOnly: true })
            }
            if (!isCurrent(token)) return
            versions[index] = model.getVersionId()
          }
          if (!current()) return
          syncFeedback()
        } catch {
          if (!isCurrent(token)) return
          useWorkspaceStore.getState().setTabFeedback(tabId, { message: 'JSON 格式化失败', isValid: false, parseErrorLine: null })
        } finally {
          if (alive.current && token === epoch.current) setProcessing(false)
        }
      },
      async transform(action) {
        if (mode !== 'edit' || busyRef.current || !ready.current) return
        const models = getModels()
        if (models.length !== 2 || models.every(model => model.getValueLength() === 0)) return
        const token = ++epoch.current
        setProcessing(true)
        try {
          let index = 0
          const result = await transformModels(models, action, async (action, text) => {
            const side = SIDES[index++]!
            if (!text) return { id: 0, ok: true, changed: false }
            const response = await runWorker(action, text)
            if (isCurrent(token) && !response.ok) {
              const location = response.error.line === null ? '' : `：第 ${response.error.line} 行，第 ${response.error.column} 列`
              validationErrors.current[side] = { version: models[index - 1]!.getVersionId(), message: `${LABELS[side]} JSON 格式错误${location}` }
            }
            return response
          }, () => isCurrent(token))
          if (!result) return
          if (!result.ok) {
            syncFeedback()
            return
          }
          syncFeedback()
        } catch {
          if (isCurrent(token)) useWorkspaceStore.getState().setTabFeedback(tabId, { message: 'JSON 处理器不可用', isValid: false, parseErrorLine: null })
        } finally {
          if (alive.current && token === epoch.current) setProcessing(false)
        }
      },
      async copy() {
        if (busyRef.current || !ready.current) return
        const models = getModels()
        if (models.length !== 2) return
        const token = epoch.current
        try {
          await navigator.clipboard.writeText(models.map(model => model.getValue()).join('\n'))
          if (isCurrent(token)) useWorkspaceStore.getState().setTabFeedback(tabId, { message: '已复制两侧内容到剪贴板', isValid: true, parseErrorLine: null })
        } catch {
          if (isCurrent(token)) useWorkspaceStore.getState().setTabFeedback(tabId, { message: '无法访问剪贴板', isValid: false, parseErrorLine: null })
        }
      },
      async fold(action) {
        if (busyRef.current || !ready.current) return
        await Promise.all(SIDES.map(side => views.current[side]?.getAction(action)?.run()))
      },
      clear() {
        epoch.current++
        setProcessing(false)
        for (const model of getModels()) {
          if (model.getValueLength() > 0) replaceModelText(model, '')
          monacoRef.current?.editor.setModelMarkers(model, 'json', [])
        }
        validationErrors.current = {}
        viewState.validationErrors = validationErrors.current
        // Clearing starts a fresh input session. Do not carry the diff viewport
        // or its transition snapshot into the empty input editors.
        delete viewState.handoff
        delete viewState.edit
        delete viewState.compare
        delete viewState.compareScroll
        for (const side of SIDES) {
          views.current[side]?.setPosition({ lineNumber: 1, column: 1 })
          views.current[side]?.setScrollPosition({ scrollTop: 0, scrollLeft: 0 })
        }
        viewState.focus ??= {}
        viewState.focus.edit = 'original'
        useWorkspaceStore.getState().setTabValidation(tabId, WAITING_FEEDBACK, [])
        viewState.focus[mode] = 'original'
        useWorkspaceStore.getState().setCompareMode(tabId, 'edit')
        if (mode === 'edit') views.current.original?.focus()
      }
    }
    handleRef.current = handle
    return handle
  })

  const inputOptions = useMemo(() => ({ ...options, glyphMargin: false, readOnly: busy }), [options, busy])
  const diffOptions = useMemo<editor.IStandaloneDiffEditorConstructionOptions>(() => ({
    ...options,
    minimap: { ...options.minimap, enabled: false },
    glyphMargin: false,
    renderSideBySide: true,
    diffWordWrap: 'inherit',
    enableSplitViewResizing: false,
    splitViewDefaultRatio: 0.5,
    useInlineViewWhenSpaceIsLimited: false,
    renderOverviewRuler: true,
    originalEditable: true,
    readOnly: false,
    renderMarginRevertIcon: false,
    renderGutterMenu: false,
    automaticLayout: false
  }), [options])
  return (
    <div className="relative h-full min-h-0">
      {mode === 'edit' ? (
        <div className="flex h-full min-h-0" style={{ paddingRight: DIFF_OVERVIEW_WIDTH }} aria-label="对比文本输入" inert={busy} aria-busy={busy}>
          {SIDES.map(side => (
            <div key={side} className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1" ref={node => { containers.current[side] = node }}>
                <Editor path={paths[side]} language="json" keepCurrentModel saveViewState={false} height="100%" theme="vs" options={inputOptions} onMount={mountInput(side)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="comparison-diff-viewport h-full" ref={node => { containers.current.diff = node }} aria-label="JSON 对比结果">
          <DiffEditor originalModelPath={paths.original} modifiedModelPath={paths.modified} language="json" keepCurrentOriginalModel keepCurrentModifiedModel height="100%" theme="vs" onMount={mountDiff}
            options={diffOptions} />
        </div>
      )}

    </div>
  )
})
