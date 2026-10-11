import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { editor, IDisposable, Selection } from 'monaco-editor'
import { IS_MACOS } from '@/lib/utils'

interface MenuState {
  instance: editor.IStandaloneCodeEditor
  model: editor.ITextModel
  selections: Selection[]
  x: number
  y: number
}

export function useEditorContextMenu(tabId: string): {
  registerEditor: (instance: editor.IStandaloneCodeEditor) => void
  contextMenu: React.JSX.Element | null
} {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const bindings = useRef(new Map<editor.IStandaloneCodeEditor, IDisposable>())

  const registerEditor = useCallback((instance: editor.IStandaloneCodeEditor): void => {
    if (bindings.current.has(instance)) return
    const context = instance.onContextMenu(event => {
      event.event.preventDefault()
      event.event.stopPropagation()
      const model = instance.getModel()
      if (!model) return
      const position = event.target.position
      if (position && !instance.getSelections()?.some(selection => selection.containsPosition(position))) {
        instance.setPosition(position)
      }
      instance.focus()
      setMenu({ instance, model, selections: instance.getSelections() ?? [], x: event.event.posx, y: event.event.posy })
    })
    const disposed = instance.onDidDispose(() => {
      setMenu(current => current?.instance === instance ? null : current)
      bindings.current.get(instance)?.dispose()
      bindings.current.delete(instance)
    })
    bindings.current.set(instance, { dispose: () => { context.dispose(); disposed.dispose() } })
  }, [])

  useEffect(() => {
    setMenu(null)
  }, [tabId])

  useEffect(() => () => {
    bindings.current.forEach(binding => binding.dispose())
    bindings.current.clear()
  }, [])

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const x = Math.max(4, Math.min(menu.x, window.innerWidth - rect.width - 4))
    const y = Math.max(4, Math.min(menu.y, window.innerHeight - rect.height - 4))
    if (x !== menu.x || y !== menu.y) setMenu({ ...menu, x, y })
    menuRef.current.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const closeOutside = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    const close = (): void => setMenu(null)
    window.addEventListener('pointerdown', closeOutside)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('blur', close)
    const scroll = menu.instance.onDidScrollChange(close)
    const model = menu.instance.onDidChangeModel(close)
    return () => {
      window.removeEventListener('pointerdown', closeOutside)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('blur', close)
      scroll.dispose()
      model.dispose()
    }
  }, [menu])

  const run = async (action: 'cut' | 'copy' | 'paste'): Promise<void> => {
    if (!menu) return
    setMenu(null)
    const { instance, model, selections } = menu
    if (model.isDisposed() || instance.getModel() !== model) return
    instance.focus()
    instance.setSelections(selections)
    if (action !== 'copy' && instance.getRawOptions().readOnly) return
    try {
      if (action === 'paste') {
        const text = await navigator.clipboard.readText()
        if (model.isDisposed() || instance.getModel() !== model || instance.getRawOptions().readOnly) return
        instance.focus()
        instance.trigger('jsonpal-context-menu', 'paste', { text, pasteOnNewLine: false, multicursorText: null })
      } else {
        instance.trigger('jsonpal-context-menu', action === 'cut' ? 'editor.action.clipboardCutAction' : 'editor.action.clipboardCopyAction', null)
      }
    } catch {
      return
    }
  }

  if (!menu) return { registerEditor, contextMenu: null }
  const readOnly = Boolean(menu.instance.getRawOptions().readOnly)
  const empty = menu.model.isDisposed() || menu.model.getValueLength() === 0
  const modifier = IS_MACOS ? '⌘' : 'Ctrl+'
  const items = [
    { action: 'cut', label: '剪切', shortcut: `${modifier}X`, disabled: readOnly || empty },
    { action: 'copy', label: '复制', shortcut: `${modifier}C`, disabled: empty },
    { action: 'paste', label: '粘贴', shortcut: `${modifier}V`, disabled: readOnly }
  ] as const

  return { registerEditor, contextMenu: (
    <div ref={menuRef} role="menu" tabIndex={-1} aria-label="编辑器操作" className="toolbar-menu app-no-drag fixed z-50 w-max min-w-32 whitespace-nowrap p-1.5 outline-none"
      style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setMenu(null)
          menu.instance.focus()
          return
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        if (!buttons.length) return
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : index === -1 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
        buttons[next]?.focus()
      }}>
      {items.map(item => <button key={item.action} type="button" role="menuitem" disabled={item.disabled}
        className="flex h-8 w-full items-center justify-between gap-6 rounded-lg px-3 text-left text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--sidebar-item-hover)] focus:bg-[var(--sidebar-item-hover)] disabled:pointer-events-none disabled:text-[var(--text-disabled)]"
        onClick={() => void run(item.action)}>
        <span>{item.label}</span><span className="text-xs text-[var(--text-secondary)]">{item.shortcut}</span>
      </button>)}
    </div>
  ) }
}
