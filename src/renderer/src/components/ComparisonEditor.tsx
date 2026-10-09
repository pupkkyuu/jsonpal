import Editor, { DiffEditor, type DiffOnMount, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { forwardRef, useCallback, useImperativeHandle, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getDiffModelPaths, WAITING_FEEDBACK, type CompareViewMode, type TabFeedback } from '@/jsonUtils'
import type { JsonTransformAction, JsonTransformResponse } from '@/jsonTransformTypes'
import { replaceModelText, transformModels } from '@/modelTransforms'
import { useEditorTransition } from '@/hooks/useEditorTransition'
import { useWorkspaceStore } from '@/stores/useWorkspaceStore'

type Monaco = Parameters<OnMount>[1]
type Side = 'original' | 'modified'
const SIDES: Side[] = ['original', 'modified']
const LABELS = { original: '左侧', modified: '右侧' }

export interface ComparisonViewState {
  edit?: Partial<Record<Side, editor.ICodeEditorViewState | null>>
  compare?: editor.IDiffEditorViewState | null
  compareScroll?: Partial<Record<Side, number>>
  focus?: Partial<Record<CompareViewMode, Side>>
  handoff?: {
    focus: Side
    panes: Partial<Record<Side, { view: editor.ICodeEditorViewState | null; line: number; offset: number }>>
  }
  validationErrors?: Partial<Record<Side, { version: number; message: string }>>
}
export interface ComparisonEditorHandle {
  toggle(): Promise<void>
  sort(): Promise<void>
  clear(): void
}
interface Props {
  tabId: string
  mode: CompareViewMode
  options: editor.IStandaloneEditorConstructionOptions
  viewState: ComparisonViewState
  runWorker: (action: JsonTransformAction, text: string) => Promise<JsonTransformResponse>
  onActiveEditor: (instance: editor.IStandaloneCodeEditor | null, monaco?: Monaco) => void
  onReady?: () => void
  onBusy: (busy: boolean) => void
  onToast: (message: string, tone?: 'success' | 'error') => void
}

export const ComparisonEditor = forwardRef<ComparisonEditorHandle, Props>(function ComparisonEditor(props, ref) {
  const { content, overlay, prepare, reveal } = useEditorTransition()
  const handleReady = useCallback((): void => {
    reveal()
    props.onReady?.()
  }, [reveal, props.onReady])
  return (
    <div className="relative h-full min-h-0">
      <div ref={content} className="h-full">
        <ComparisonEditorPane key={props.mode} {...props} ref={ref} onTransition={prepare} onReady={handleReady} />
      </div>
      <div ref={overlay} data-editor-transition="comparison" className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" inert />
    </div>
  )
})

const ComparisonEditorPane = forwardRef<ComparisonEditorHandle, Props & {
  onTransition: () => void
  onReady: () => void
}>(function ComparisonEditorPane(props, ref) {
  const { tabId, mode, options, viewState, runWorker, onActiveEditor, onBusy, onToast, onTransition, onReady } = props
  const views = useRef<Partial<Record<Side, editor.IStandaloneCodeEditor>>>({})
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

  const finishMount = (): void => {
    if (ready.current || getModels().length !== 2 || !SIDES.every(side => views.current[side])) return
    if (mode === 'compare' && diffRef.current?.getLineChanges() === null) return
    cancelAnimationFrame(readyFrame.current)
    readyFrame.current = requestAnimationFrame(() => {
      if (!alive.current) return
      const transfer = handoff.current
      if (transfer) {
        // Diff view zones change pixel offsets. Anchor to the same source line;
        // restore the focused pane last because diff scrolling is synchronized.
        const ordered = SIDES.filter(side => side !== transfer.focus).concat(transfer.focus)
        for (const side of ordered) {
          const pane = transfer.panes[side]
          const instance = views.current[side]
          if (pane && instance) instance.setScrollTop(instance.getTopForLineNumber(pane.line) + pane.offset, monacoRef.current!.editor.ScrollType.Immediate)
        }
        delete viewState.handoff
      }
      ready.current = true
      onReady()
      onBusy(busyRef.current)
    })
  }

  const transitionTo = (next: CompareViewMode): void => {
    const focus = viewState.focus?.[mode] ?? 'modified'
    viewState.handoff = { focus, panes: {} }
    for (const side of SIDES) {
      const instance = views.current[side]
      if (!instance) continue
      const line = instance.getVisibleRanges()[0]?.startLineNumber ?? 1
      viewState.handoff.panes[side] = {
        view: instance.saveViewState(), line,
        offset: instance.getScrollTop() - instance.getTopForLineNumber(line)
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
      onActiveEditor(instance, monacoRef.current ?? undefined)
      break
    }
  }

  const attach = (side: Side, instance: editor.IStandaloneCodeEditor, monaco: Monaco): void => {
    views.current[side] = instance
    monacoRef.current = monaco
    const model = instance.getModel()!
    model.updateOptions({ bracketColorizationOptions: { enabled: options.bracketPairColorization?.enabled ?? false, independentColorPoolPerBracketType: options.bracketPairColorization?.independentColorPoolPerBracketType ?? false } })
    const node = instance.getDomNode()
    const activate = (): void => {
      // DiffEditor can report widget focus on both inner editors. The DOM
      // focus target identifies which pane owns the status bar and view cache.
      if (!node?.contains(document.activeElement)) return
      viewState.focus ??= {}
      viewState.focus[mode] = side
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
        onActiveEditor(instance, monaco)
      }),
      model.onDidChangeContent(() => {
        delete validationErrors.current[side]
        completed.current = false
        if (model.getValueLength() === 0) monaco.editor.setModelMarkers(model, 'json', [])
        syncFeedback()
      })
    )
    instance.updateOptions({ readOnly: busyRef.current, glyphMargin: false, minimap: mode === 'compare' && side === 'original' ? { ...options.minimap, enabled: false } : options.minimap, folding: options.folding })
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
      for (const entry of entries) {
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
      views.current[side]?.updateOptions({ glyphMargin: false, minimap: mode === 'compare' && side === 'original' ? { ...options.minimap, enabled: false } : options.minimap, folding: options.folding })
      views.current[side]?.getModel()?.updateOptions({
        bracketColorizationOptions: {
          enabled: options.bracketPairColorization?.enabled ?? false,
          independentColorPoolPerBracketType: options.bracketPairColorization?.independentColorPoolPerBracketType ?? false
        }
      })
    }
  }, [options])

  useImperativeHandle(ref, () => ({
    async toggle() {
      if (busyRef.current) return
      if (mode === 'compare') {
        transitionTo('edit')
        return
      }
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
        const errors = Object.values(validationErrors.current)
        if (errors.length) onToast(`${errors[0]!.message}，保留原文进行对比`, 'error')
        transitionTo('compare')
      } catch {
        if (!isCurrent(token)) return
        onToast('JSON 校验或格式化失败，请重试', 'error')
        useWorkspaceStore.getState().setTabFeedback(tabId, { message: 'JSON 校验或格式化失败', isValid: false, parseErrorLine: null })
      } finally {
        if (alive.current && token === epoch.current) setProcessing(false)
      }
    },
    async sort() {
      if (mode !== 'edit' || busyRef.current) return
      const models = getModels()
      if (models.length !== 2 || models.every(model => model.getValueLength() === 0)) return
      const token = ++epoch.current
      setProcessing(true)
      try {
        const result = await transformModels(models, 'sort', runWorker, () => isCurrent(token))
        if (!result) return
        if (!result.ok) { onToast('请先修正两侧 JSON 格式', 'error'); return }
        onToast('两侧 JSON 已按字段排序')
        syncFeedback()
      } catch {
        if (isCurrent(token)) onToast('JSON 处理器不可用', 'error')
      } finally {
        if (alive.current && token === epoch.current) setProcessing(false)
      }
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
      viewState.focus ??= {}
      viewState.focus.edit = 'original'
      useWorkspaceStore.getState().setTabValidation(tabId, WAITING_FEEDBACK, [])
      viewState.focus[mode] = 'original'
      if (mode === 'compare') transitionTo('edit')
      if (mode === 'edit') views.current.original?.focus()
      onToast('对比编辑器已清空')
    }
  }))

  const inputOptions = useMemo(() => ({ ...options, glyphMargin: false, readOnly: busy }), [options, busy])
  const diffOptions = useMemo<editor.IStandaloneDiffEditorConstructionOptions>(() => ({
    ...options,
    glyphMargin: false,
    renderSideBySide: true,
    enableSplitViewResizing: false,
    splitViewDefaultRatio: 0.5,
    useInlineViewWhenSpaceIsLimited: false,
    renderOverviewRuler: false,
    originalEditable: true,
    readOnly: false,
    renderMarginRevertIcon: false,
    renderGutterMenu: false,
    automaticLayout: false
  }), [options])
  return mode === 'edit' ? (
    <div className="flex h-full min-h-0" aria-label="对比文本输入" inert={busy} aria-busy={busy}>
      {SIDES.map(side => (
        <div key={side} className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1" ref={node => { containers.current[side] = node }}>
            <Editor path={paths[side]} language="json" keepCurrentModel saveViewState={false} height="100%" theme="vs" options={inputOptions} onMount={mountInput(side)} />
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="h-full" ref={node => { containers.current.diff = node }} aria-label="JSON 对比结果">
      <DiffEditor originalModelPath={paths.original} modifiedModelPath={paths.modified} language="json" keepCurrentOriginalModel keepCurrentModifiedModel height="100%" theme="vs" onMount={mountDiff}
        options={diffOptions} />
    </div>
  )
})
