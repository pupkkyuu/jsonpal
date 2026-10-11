import { ArrowDown, ArrowUp, CaseSensitive, Regex, Search, WholeWord, X } from 'lucide-react'
import type { editor } from 'monaco-editor'
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'

const SEARCH_RESULT_LIMIT = 10_000
const SEARCH_DEBOUNCE_MS = 100

export interface EditorSearchState {
  open?: boolean
  query?: string
  matchCase?: boolean
  wholeWord?: boolean
  regex?: boolean
}

export interface EditorSearchHandle {
  toggle(): void
}

interface Props {
  instance: editor.IStandaloneCodeEditor | null
  searchInstances?: editor.IStandaloneCodeEditor[]
  selectionInstance?: editor.IStandaloneCodeEditor | null
  monaco: typeof import('monaco-editor') | null
  tabId: string
  state: EditorSearchState
  isActive?: boolean
  onFocus?: () => void
  animatePlacement?: boolean
  onStateChange?: (next: Partial<EditorSearchState>) => void
}

export const EditorSearch = forwardRef<EditorSearchHandle, Props>(function EditorSearch({ instance, searchInstances, selectionInstance, monaco, tabId, state, isActive = true, onFocus, onStateChange, animatePlacement = false }, ref) {
  const errorId = useId()
  const [open, setOpen] = useState(state.open ?? false)
  const [query, setQuery] = useState(state.query ?? '')
  const [matchCase, setMatchCase] = useState(state.matchCase ?? false)
  const [wholeWord, setWholeWord] = useState(state.wholeWord ?? false)
  const [regex, setRegex] = useState(state.regex ?? false)
  const [count, setCount] = useState(0)
  const [current, setCurrent] = useState(-1)
  const [error, setError] = useState(false)
  const [compact, setCompact] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const searchRef = useRef<HTMLElement>(null)
  const placementAnimation = useRef<Animation | null>(null)
  const hasPlacement = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const matchesRef = useRef<{ instance: editor.IStandaloneCodeEditor; match: editor.FindMatch }[]>([])
  const currentRef = useRef(-1)
  const decorationsRef = useRef(new Map<editor.IStandaloneCodeEditor, editor.IEditorDecorationsCollection>())
  const currentDecorationsRef = useRef(new Map<editor.IStandaloneCodeEditor, editor.IEditorDecorationsCollection>())
  const highlightedInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const flushSearchRef = useRef<(() => void) | null>(null)
  const cancelSearchRef = useRef<(() => void) | null>(null)

  useLayoutEffect(() => {
    Object.assign(state, { open, query, matchCase, wholeWord, regex })
  }, [state, open, query, matchCase, wholeWord, regex])

  const openSearch = useCallback((): void => {
    if (!instance) return
    const source = selectionInstance ?? instance
    const model = source.getModel()
    const selection = source.getSelection()
    if (model && selection && !selection.isEmpty() && selection.startLineNumber === selection.endLineNumber) {
      const query = model.getValueInRange(selection)
      setQuery(query)
      onStateChange?.({ query })
    }
    setOpen(true)
    onStateChange?.({ open: true })
    setFocusRequest(value => value + 1)
  }, [instance, selectionInstance, onStateChange])

  const highlight = useCallback((index: number): void => {
    const result = matchesRef.current[index]
    const previous = highlightedInstanceRef.current
    if (previous && previous !== result?.instance) currentDecorationsRef.current.get(previous)?.clear()
    if (result) {
      currentDecorationsRef.current.get(result.instance)?.set([{
        range: result.match.range,
        options: {
          className: 'currentFindMatch',
          inlineClassName: 'currentFindMatchInline',
          showIfCollapsed: true
        }
      }])
    }
    highlightedInstanceRef.current = result?.instance ?? null
  }, [])

  const selectMatch = useCallback((index: number): void => {
    const result = matchesRef.current[index]
    if (!result) return
    currentRef.current = index
    setCurrent(index)
    highlight(index)
    result.instance.setSelection(result.match.range)
    result.instance.revealRangeInCenterIfOutsideViewport(result.match.range)
  }, [highlight])

  const navigate = useCallback((direction: number): void => {
    flushSearchRef.current?.()
    const total = matchesRef.current.length
    if (!total) return
    selectMatch((currentRef.current + direction + total) % total)
  }, [selectMatch])

  const close = useCallback((): void => {
    cancelSearchRef.current?.()
    setOpen(false)
    onStateChange?.({ open: false })
    const source = selectionInstance ?? instance
    source?.focus()
  }, [instance, selectionInstance, onStateChange])

  useImperativeHandle(ref, () => ({
    toggle() {
      if (open) close()
      else openSearch()
    }
  }), [open, close, openSearch])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isActive || !instance) return
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        event.stopImmediatePropagation()
        openSearch()
      } else if (open && event.key === 'Escape' && !event.isComposing &&
        !(event.target instanceof Element && event.target.closest('[role="menu"]'))) {
        event.preventDefault()
        event.stopImmediatePropagation()
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [instance, open, close, isActive, openSearch])

  useLayoutEffect(() => {
    if (focusRequest > 0) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [focusRequest])

  useLayoutEffect(() => {
    const panel = searchRef.current
    const parent = panel?.parentElement
    const node = instance?.getDomNode()
    if (!instance || !panel || !parent || !node) return
    let firstLayout = true
    const updatePlacement = (): void => {
      const previousRect = firstLayout && hasPlacement.current && open && animatePlacement ? panel.getBoundingClientRect() : null
      const info = instance.getLayoutInfo()
      const parentRect = parent.getBoundingClientRect()
      const editorRect = node.getBoundingClientRect()
      const textRight = Math.min(info.width - info.verticalScrollbarWidth, info.contentLeft + info.contentWidth,
        info.minimap.minimapWidth > 0 && info.minimap.minimapLeft > info.contentLeft ? info.minimap.minimapLeft : Infinity)
      const width = Math.min(280, Math.max(0, textRight - info.contentLeft - 16))
      // Monaco lays out during ResizeObserver delivery, before paint. Apply
      // geometry in that same frame rather than waiting for a React render.
      // Anchor to the text area's right edge so sidebar slides do not move a
      // full-width editor's search panel back and forth.
      panel.style.right = `${parentRect.right - editorRect.left - textRight + 8}px`
      panel.style.left = 'auto'
      panel.style.top = `${editorRect.top - parentRect.top + 8}px`
      panel.style.width = `${width}px`
      setCompact(width < 260)
      if (previousRect && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        placementAnimation.current?.cancel()
        const nextRect = panel.getBoundingClientRect()
        const x = previousRect.left - nextRect.left
        const y = previousRect.top - nextRect.top
        if (x || y) {
          placementAnimation.current = panel.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }], {
            duration: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)'
          })
        }
      }
      hasPlacement.current = true
      firstLayout = false
    }
    updatePlacement()
    const layout = instance.onDidLayoutChange(updatePlacement)
    const observer = new ResizeObserver(updatePlacement)
    observer.observe(parent)
    return () => { layout.dispose(); observer.disconnect() }
  }, [instance, tabId, animatePlacement])

  useEffect(() => () => placementAnimation.current?.cancel(), [])

  useEffect(() => {
    // Keep the last result labels stable while the closed panel slides out.
    // The previous effect still clears Monaco decorations immediately.
    if (!open || !instance || !monaco) return
    matchesRef.current = []
    currentRef.current = -1
    const instances = searchInstances ?? [instance]
    const decorations = new Map(instances.map(input => [input, input.createDecorationsCollection()]))
    const currentDecorations = new Map(instances.map(input => [input, input.createDecorationsCollection()]))
    decorationsRef.current = decorations
    currentDecorationsRef.current = currentDecorations
    highlightedInstanceRef.current = null
    const refresh = (reveal: boolean): void => {
      const matches: { instance: editor.IStandaloneCodeEditor; match: editor.FindMatch }[] = []
      let invalid = false
      if (query) {
        try {
          if (regex) new RegExp(query)
          for (const input of instances) {
            const model = input.getModel()
            if (!model || model.isDisposed()) continue
            const remaining = SEARCH_RESULT_LIMIT - matches.length
            if (remaining === 0) break
            const found = model.findMatches(query, false, regex, matchCase,
              wholeWord ? input.getOption(monaco.editor.EditorOption.wordSeparators) : null,
              false, remaining)
            for (const match of found) matches.push({ instance: input, match })
          }
        } catch {
          invalid = true
        }
      }
      matchesRef.current = matches
      const grouped = new Map(instances.map(input => [input, [] as editor.IModelDeltaDecoration[]]))
      for (const result of matches) {
        grouped.get(result.instance)!.push({ range: result.match.range, options: {
          className: 'findMatch', inlineClassName: 'findMatchInline', showIfCollapsed: true
        } })
      }
      for (const [input, collection] of decorations) collection.set(grouped.get(input)!)
      for (const collection of currentDecorations.values()) collection.clear()
      highlightedInstanceRef.current = null
      setCount(matches.length)
      setError(invalid)
      const source = instances.find(input => input.hasTextFocus()) ?? instance
      const position = source.getSelection()?.getStartPosition() ?? source.getPosition()
      const next = position ? matches.findIndex(result => result.instance === source && (
        result.match.range.startLineNumber > position.lineNumber ||
        (result.match.range.startLineNumber === position.lineNumber && result.match.range.startColumn >= position.column)
      )) : 0
      if (matches.length) {
        const index = next === -1 ? 0 : next
        if (reveal) selectMatch(index)
        else {
          currentRef.current = index
          setCurrent(index)
          highlight(index)
        }
      } else {
        currentRef.current = -1
        setCurrent(-1)
        for (const collection of decorations.values()) collection.clear()
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    let pendingReveal = false
    const cancel = (): void => {
      clearTimeout(timer)
      timer = undefined
      pendingReveal = false
    }
    const schedule = (reveal: boolean): void => {
      clearTimeout(timer)
      pendingReveal ||= reveal
      timer = setTimeout(() => {
        const reveal = pendingReveal
        timer = undefined
        pendingReveal = false
        refresh(reveal)
      }, SEARCH_DEBOUNCE_MS)
    }
    const flush = (): void => {
      if (timer === undefined) return
      cancel()
      refresh(false)
    }
    cancelSearchRef.current = cancel
    flushSearchRef.current = flush
    schedule(instances.some(input => input.hasTextFocus()) || Boolean(searchRef.current?.contains(document.activeElement)))
    const listeners = instances.flatMap(input => [
      input.onDidChangeModelContent(() => schedule(false)),
      input.onDidChangeModel(() => schedule(true))
    ])
    return () => {
      cancel()
      listeners.forEach(listener => listener.dispose())
      for (const collection of decorations.values()) collection.clear()
      for (const collection of currentDecorations.values()) collection.clear()
      if (decorationsRef.current === decorations) decorationsRef.current = new Map()
      if (currentDecorationsRef.current === currentDecorations) {
        currentDecorationsRef.current = new Map()
        highlightedInstanceRef.current = null
      }
      if (cancelSearchRef.current === cancel) cancelSearchRef.current = null
      if (flushSearchRef.current === flush) flushSearchRef.current = null
    }
  }, [instance, searchInstances, monaco, tabId, open, query, matchCase, wholeWord, regex, selectMatch, highlight])

  return (
    <section onFocus={onFocus} ref={searchRef} className="editor-search app-no-drag" aria-label="查找" data-open={open} inert={!open} aria-hidden={!open} data-compact={compact}
      onKeyDown={event => {
      if (event.target === inputRef.current && event.key === 'Enter' && !event.nativeEvent.isComposing) {
        event.preventDefault()
        navigate(event.shiftKey ? -1 : 1)
      }
    }}>
      <div className="editor-search-field" data-invalid={error}>
        <Search className="editor-search-icon" size={15} aria-hidden="true" />
        <input ref={inputRef} className="editor-search-input" type="text" value={query} placeholder="查找"
          aria-label="查找内容" aria-invalid={error} aria-describedby={error ? errorId : undefined}
          onChange={event => { setQuery(event.target.value); onStateChange?.({ query: event.target.value }) }} />
      </div>
      <div className="editor-search-divider" aria-hidden="true" />
      <div className="editor-search-row">
        <div className="editor-search-options">
          <IconButton label="区分大小写" className="editor-search-button" aria-pressed={matchCase} onClick={() => { setMatchCase(!matchCase); onStateChange?.({ matchCase: !matchCase }) }}><CaseSensitive size={18} /></IconButton>
          <IconButton label="全字匹配" className="editor-search-button" aria-pressed={wholeWord} onClick={() => { setWholeWord(!wholeWord); onStateChange?.({ wholeWord: !wholeWord }) }}><WholeWord size={18} /></IconButton>
          <IconButton label="正则表达式" className="editor-search-button" aria-pressed={regex} onClick={() => { setRegex(!regex); onStateChange?.({ regex: !regex }) }}><Regex size={18} /></IconButton>
        </div>
        <span className="editor-search-count" title={count === SEARCH_RESULT_LIMIT ? `最多显示 ${SEARCH_RESULT_LIMIT} 个结果` : undefined} role="status" aria-live="polite" aria-label={`第 ${current + 1} 个，共 ${count} 个结果`}>{current + 1} / {count}</span>
        <IconButton label="上一个结果" className="editor-search-button" disabled={!count} onClick={() => navigate(-1)}><ArrowUp size={17} /></IconButton>
        <IconButton label="下一个结果" className="editor-search-button" disabled={!count} onClick={() => navigate(1)}><ArrowDown size={17} /></IconButton>
        <IconButton label="关闭查找" className="editor-search-button" onClick={close}><X size={17} /></IconButton>
      </div>
      {error && <p id={errorId} className="editor-search-error" role="alert">正则表达式无效</p>}
    </section>
  )
})
