import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileDiff, PanelLeft, Plus, Settings, X } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '@/components/ui/icon-button'
import { IS_MACOS } from '@/lib/utils'
import type { JsonTab } from '@/jsonUtils'
import { cn } from '@/lib/utils'

interface SortableTabProps {
  tab: JsonTab
  isActive: boolean
  onActivate: (tabId: string) => void
  onRename: (tabId: string, title: string) => void
  onClose: (tabId: string) => void
  onContextMenu: (event: MouseEvent<HTMLDivElement>, tabId: string) => void
}

const SortableTab = memo(function SortableTab({ tab, isActive, onActivate, onRename, onClose, onContextMenu }: SortableTabProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(tab.title)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id, disabled: isEditing })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  useEffect(() => {
    if (!isEditing) setDraftTitle(tab.title)
  }, [isEditing, tab.title])

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  const commitRename = (): void => {
    const nextTitle = draftTitle.trim()
    if (nextTitle) onRename(tab.id, nextTitle)
    else setDraftTitle(tab.title)
    setIsEditing(false)
  }

  const handleItemKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isEditing || event.target !== event.currentTarget) return
    if (event.key === 'Enter' && !isDragging) {
      event.preventDefault()
      onActivate(tab.id)
      return
    }
    listeners?.onKeyDown?.(event)
  }

  const handleClose = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    onClose(tab.id)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="tab"
      data-tab-id={tab.id}
      tabIndex={isActive ? 0 : -1}
      aria-selected={isActive}
      aria-disabled={undefined}
      onClick={() => onActivate(tab.id)}
      onKeyDown={handleItemKeyDown}
      onContextMenu={(event) => onContextMenu(event, tab.id)}
      className={cn(
        'group relative flex h-10 w-full touch-none select-none items-center gap-1 rounded-lg border border-transparent px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        isActive ? 'tab-selected' : 'tab-unselected',
        !isEditing && 'cursor-grab active:cursor-grabbing',
        isDragging && 'z-10 opacity-60'
      )}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          value={draftTitle}
          aria-label="Tab 名称"
          onChange={(event) => setDraftTitle(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setDraftTitle(tab.title)
              setIsEditing(false)
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-md border border-[var(--accent)] bg-white px-1.5 text-sm text-[var(--text-primary)] outline-none ring-2 ring-[var(--accent)]/15"
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate text-sm"
          onDoubleClick={(event) => {
            event.stopPropagation()
            setIsEditing(true)
          }}
        >
          {tab.title}
        </span>
      )}

      <div
        className={cn(
          'tab-actions absolute right-1 flex items-center gap-1 rounded-md pl-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
          isEditing && 'hidden'
        )}
      >
        <IconButton
          label={`关闭 ${tab.title}`}
          onClick={handleClose}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <X size={15} />
        </IconButton>
      </div>
    </div>
  )
})

interface TabSidebarProps {
  tabs: JsonTab[]
  activeTabId: string
  isCollapsed: boolean
  width: number
  onWidthChange: (width: number) => void
  onActivate: (id: string) => void
  onRename: (id: string, title: string) => void
  onClose: (id: string) => void
  onCloseOthers: (id: string) => void
  onCloseAll: () => void
  onReorder: (tabs: JsonTab[]) => void
  onOpenSettings: () => void
  onToggle: () => void
  onAdd: () => void
  onAddDiff: () => void
}

export const TabSidebar = memo(function TabSidebar({
  tabs,
  activeTabId,
  isCollapsed,
  width,
  onWidthChange,
  onActivate,
  onRename,
  onClose,
  onCloseOthers,
  onCloseAll,
  onReorder,
  onOpenSettings,
  onToggle,
  onAdd,
  onAddDiff
}: TabSidebarProps): React.JSX.Element {
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  const isResizingRef = useRef(false)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, width })
  const previewWidthRef = useRef(width)
  const pendingWidthRef = useRef<number | null>(null)
  const resizeFrameRef = useRef<number | undefined>(undefined)
  const MIN_WIDTH = 160
  const MAX_WIDTH = 420
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  useEffect(() => {
    if (!contextMenu) return
    const handlePointerDown = (event: globalThis.PointerEvent): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    const closeMenu = (): void => setContextMenu(null)
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('blur', closeMenu)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('blur', closeMenu)
    }
  }, [contextMenu])

  useEffect(() => {
    if (isCollapsed) setContextMenu(null)
  }, [isCollapsed])

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>, tabId: string): void => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      tabId,
      x: Math.min(event.clientX, window.innerWidth - 176),
      y: Math.min(event.clientY, window.innerHeight - 116)
    })
  }

  const runContextAction = (action: (tabId: string) => void): void => {
    if (!contextMenu) return
    const { tabId } = contextMenu
    setContextMenu(null)
    action(tabId)
  }

  const clampWidth = useCallback((nextWidth: number): number => {
    const maxWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - 400))
    return Math.min(maxWidth, Math.max(MIN_WIDTH, nextWidth))
  }, [])

  const handleResizeStart = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    isResizingRef.current = true
    setIsResizing(true)
    resizeStartRef.current = { x: event.clientX, width }
    previewWidthRef.current = width
    pendingWidthRef.current = width
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    const handlePointerMove = (event: globalThis.PointerEvent): void => {
      if (!isResizingRef.current) return
      pendingWidthRef.current = clampWidth(resizeStartRef.current.width + event.clientX - resizeStartRef.current.x)
      if (resizeFrameRef.current !== undefined) return
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = undefined
        const nextWidth = pendingWidthRef.current
        if (nextWidth === null) return
        previewWidthRef.current = nextWidth
        sidebarRef.current?.style.setProperty('width', `${nextWidth}px`)
        sidebarRef.current?.style.setProperty('--sidebar-width', `${nextWidth}px`)
      })
    }
    const handlePointerUp = (): void => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      setIsResizing(false)
      cancelAnimationFrame(resizeFrameRef.current ?? 0)
      resizeFrameRef.current = undefined
      const nextWidth = pendingWidthRef.current ?? previewWidthRef.current
      pendingWidthRef.current = null
      previewWidthRef.current = nextWidth
      sidebarRef.current?.style.setProperty('width', `${nextWidth}px`)
      sidebarRef.current?.style.setProperty('--sidebar-width', `${nextWidth}px`)
      onWidthChange(nextWidth)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      cancelAnimationFrame(resizeFrameRef.current ?? 0)
    }
  }, [clampWidth, onWidthChange])

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -10 : 10
    onWidthChange(clampWidth(width + delta))
  }

  useEffect(() => {
    if (isCollapsed) return
    const list = listRef.current
    const activeElement = list?.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`)
    if (!list || !activeElement) return
    const listRect = list.getBoundingClientRect()
    const elementRect = activeElement.getBoundingClientRect()
    if (elementRect.top < listRect.top || elementRect.bottom > listRect.bottom) {
      activeElement.scrollIntoView({ block: 'nearest' })
    }
  }, [activeTabId, isCollapsed, tabs])

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    const oldIndex = tabs.findIndex((tab) => tab.id === active.id)
    const newIndex = tabs.findIndex((tab) => tab.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(tabs, oldIndex, newIndex))
  }

  return (
    <div
      ref={sidebarRef}
      className="tab-sidebar-shell relative shrink-0"
      data-collapsed={isCollapsed}
      data-resizing={isResizing}
      style={{ width: isCollapsed ? 0 : width, '--sidebar-width': `${width}px` } as CSSProperties}
    >
      <div
        className={`absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none outline-none transition-opacity hover:bg-black/10 focus-visible:bg-black/20 ${isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        role="separator"
        aria-label="调整侧边栏宽度"
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        tabIndex={isCollapsed ? -1 : 0}
        onPointerDown={handleResizeStart}
        onKeyDown={handleResizeKeyDown}
      />
      <div className="tab-sidebar-clip">
        <aside
          id="tab-sidebar"
          className="tab-sidebar"
          inert={isCollapsed}
          aria-hidden={isCollapsed}
          aria-label="JSON Tab 侧边栏"
        >
          <div className="sidebar-titlebar app-drag-region">
            <IconButton className="sidebar-toggle" label="隐藏侧边栏" shortcut={IS_MACOS ? '⌘+B' : 'Ctrl+B'} onClick={onToggle} aria-expanded={true} aria-controls="tab-sidebar"><PanelLeft size={18} /></IconButton>
          </div>
          <nav className="sidebar-functions app-no-drag" aria-label="新建功能">
            <button type="button" className="sidebar-function tab-unselected" title={`新建格式化（${IS_MACOS ? '⌘+T' : 'Ctrl+T'}）`} onClick={onAdd}>
              <span className="sidebar-function-icon"><Plus size={18} /></span>
              <span className="min-w-0 truncate">新建格式化</span>
            </button>
            <button type="button" className="sidebar-function tab-unselected" onClick={onAddDiff}>
              <span className="sidebar-function-icon"><FileDiff size={18} /></span>
              <span className="min-w-0 truncate">新建对比</span>
            </button>
          </nav>
          <section className="sidebar-tabs-region app-no-drag" aria-labelledby="sidebar-tabs-heading">
            <div className="sidebar-toolbar">
              <h2 id="sidebar-tabs-heading" className="sidebar-section-title">
                标签页 <span className="sidebar-tab-count" aria-label={`共 ${tabs.length} 个标签页`}>({tabs.length})</span>
              </h2>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tabs.map((tab) => tab.id)} strategy={verticalListSortingStrategy}>
                <div ref={listRef} className="sidebar-tab-list min-h-0 flex-1 space-y-1 overflow-y-auto p-2" role="tablist" aria-orientation="vertical" aria-hidden={isCollapsed}>
                  {tabs.map((tab) => (
                    <SortableTab
                      key={tab.id}
                      tab={tab}
                      isActive={tab.id === activeTabId}
                      onActivate={onActivate}
                      onRename={onRename}
                      onClose={onClose}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          {contextMenu && createPortal(
            <div
              role="menu"
              aria-label="标签操作"
              ref={menuRef}
              className="toolbar-menu fixed z-50 w-max whitespace-nowrap p-1.5"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                type="button"
                role="menuitem"
                className="flex h-8 w-full items-center rounded-lg px-3 text-left text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--bg-capsule-active)] hover:text-[var(--text-primary)] focus:bg-[var(--bg-capsule-active)]"
                onClick={() => runContextAction(onClose)}
              >
                关闭标签
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex h-8 w-full items-center rounded-lg px-3 text-left text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--bg-capsule-active)] hover:text-[var(--text-primary)] focus:bg-[var(--bg-capsule-active)]"
                onClick={() => runContextAction(onCloseOthers)}
              >
                关闭其他标签
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex h-8 w-full items-center rounded-lg px-3 text-left text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--bg-capsule-active)] hover:text-[var(--text-primary)] focus:bg-[var(--bg-capsule-active)]"
                onClick={() => {
                  setContextMenu(null)
                  onCloseAll()
                }}
              >
                关闭所有标签
              </button>
            </div>,
            document.body
          )}

          <div className="sidebar-footer app-no-drag">
            <IconButton className="sidebar-settings" label="编辑器设置" onClick={onOpenSettings}><Settings size={18} /></IconButton>
          </div>
        </aside>
      </div>
    </div>
  )
})
