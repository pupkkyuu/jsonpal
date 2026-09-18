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
import { GripVertical, Pencil, Search, Settings, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id })
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
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate(tab.id)
    }
  }

  const handleClose = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    onClose(tab.id)
  }

  const handleEdit = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    setIsEditing(true)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="tab"
      data-tab-id={tab.id}
      tabIndex={isActive ? 0 : -1}
      aria-selected={isActive}
      onClick={() => onActivate(tab.id)}
      onKeyDown={handleItemKeyDown}
      onContextMenu={(event) => onContextMenu(event, tab.id)}
      className={cn(
        'group relative flex h-10 w-full items-center gap-1 rounded-lg border border-transparent px-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#5b5bd6]',
        isActive ? 'border-[#d9dcfa] bg-[#eeefff] text-[#34349b] shadow-sm shadow-[#5b5bd6]/5' : 'text-[#667085] hover:bg-[#f0f1f6] hover:text-[#344054] focus-within:bg-[#f0f1f6]',
        isDragging && 'z-10 opacity-60 shadow-md'
      )}
    >
      <button
        type="button"
        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-[#98a2b3] outline-none hover:text-[#475467] focus-visible:ring-2 focus-visible:ring-[#5b5bd6] active:cursor-grabbing"
        aria-label={`拖动 ${tab.title}`}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

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
          className="h-7 min-w-0 flex-1 rounded-md border border-[#5b5bd6] bg-white px-1.5 text-sm text-[#172033] outline-none ring-2 ring-[#5b5bd6]/15"
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
          'absolute right-1 flex items-center gap-1 rounded-md pl-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
          isActive ? 'bg-[#eeefff]' : 'bg-[#f0f1f6]',
          isEditing && 'hidden'
        )}
      >
        <button
          type="button"
          aria-label={`重命名 ${tab.title}`}
          onClick={handleEdit}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex h-7 w-6 items-center justify-center rounded-md text-[#98a2b3] outline-none hover:bg-[#e1e3ec] hover:text-[#4646bc] focus-visible:ring-2 focus-visible:ring-[#5b5bd6]"
        >
          <Pencil size={13} />
        </button>

        <button
          type="button"
          aria-label={`关闭 ${tab.title}`}
          onClick={handleClose}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex h-7 w-6 items-center justify-center rounded-md text-[#98a2b3] outline-none hover:bg-[#e1e3ec] hover:text-[#4646bc] focus-visible:ring-2 focus-visible:ring-[#5b5bd6]"
        >
          <X size={14} />
        </button>
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
  onOpenSettings
}: TabSidebarProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const sidebarRef = useRef<HTMLElement | null>(null)
  const isResizingRef = useRef(false)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, width })
  const previewWidthRef = useRef(width)
  const pendingWidthRef = useRef<number | null>(null)
  const resizeFrameRef = useRef<number | undefined>(undefined)
  const MIN_WIDTH = 180
  const MAX_WIDTH = 420
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleTabs = useMemo(
    () => (normalizedQuery ? tabs.filter((tab) => tab.title.toLocaleLowerCase().includes(normalizedQuery)) : tabs),
    [normalizedQuery, tabs]
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
  }, [activeTabId, isCollapsed, visibleTabs])

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    const oldIndex = visibleTabs.findIndex((tab) => tab.id === active.id)
    const newIndex = visibleTabs.findIndex((tab) => tab.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reorderedVisibleTabs = arrayMove(visibleTabs, oldIndex, newIndex)
    const visibleTabIds = new Set(visibleTabs.map((tab) => tab.id))
    let visibleIndex = 0
    onReorder(tabs.map((tab) => (visibleTabIds.has(tab.id) ? reorderedVisibleTabs[visibleIndex++] : tab)))
  }

  return (
    <aside
      ref={sidebarRef}
      className={`app-panel tab-sidebar relative flex shrink-0 flex-col overflow-hidden ${isResizing ? 'transition-none' : 'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'} ${isCollapsed ? 'border-r-0' : 'border-r'}`}
      style={{ width: isCollapsed ? 0 : width }}
      aria-label={isCollapsed ? 'JSON Tab 侧边栏（已收起）' : 'JSON Tab 侧边栏'}
    >
      <div
        className={`absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize touch-none outline-none transition-opacity hover:bg-[#5b5bd6]/30 focus-visible:bg-[#5b5bd6]/40 ${isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        role="separator"
        aria-label="调整侧边栏宽度"
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={handleResizeStart}
        onKeyDown={handleResizeKeyDown}
      />
      <div className={`flex h-10 shrink-0 items-center border-b border-[#e4e7ef] px-3 transition-all duration-200 ${isCollapsed ? 'pointer-events-none -translate-x-2 opacity-0' : 'translate-x-0 opacity-100'}`} aria-hidden={isCollapsed}>
        <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dfe3ee] bg-white px-2.5 shadow-sm focus-within:border-[#8b8ce9] focus-within:ring-2 focus-within:ring-[#5b5bd6]/15">
          <Search size={14} className="shrink-0 text-[#98a2b3]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索 Tab"
            aria-label="搜索 Tab"
            className="min-w-0 flex-1 bg-transparent text-xs text-[#344054] outline-none placeholder:text-[#98a2b3] [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="清空搜索" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#98a2b3] outline-none hover:bg-[#eeefff] hover:text-[#4646bc] focus-visible:ring-2 focus-visible:ring-[#5b5bd6]">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleTabs.map((tab) => tab.id)} strategy={verticalListSortingStrategy}>
          <div ref={listRef} className={`sidebar-tab-list min-h-0 flex-1 space-y-1 overflow-y-auto p-3 transition-all duration-200 ${isCollapsed ? 'pointer-events-none -translate-x-2 opacity-0' : 'translate-x-0 opacity-100'}`} role="tablist" aria-orientation="vertical" aria-hidden={isCollapsed}>
            {visibleTabs.map((tab) => (
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
            {visibleTabs.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-[#98a2b3]">没有匹配的 Tab</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {contextMenu && (
        <div
          role="menu"
          aria-label="标签操作"
          ref={menuRef}
          className="fixed z-50 w-44 rounded-xl border border-[#e1e4f0] bg-white py-1.5 shadow-xl shadow-[#28304d]/15"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex h-8 w-full items-center px-3 text-left text-sm text-[#344054] outline-none hover:bg-[#eeefff] hover:text-[#4646bc] focus:bg-[#eeefff]"
            onClick={() => runContextAction(onClose)}
          >
            关闭标签
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex h-8 w-full items-center px-3 text-left text-sm text-[#344054] outline-none hover:bg-[#eeefff] hover:text-[#4646bc] focus:bg-[#eeefff]"
            onClick={() => runContextAction(onCloseOthers)}
          >
            关闭其他标签
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex h-8 w-full items-center px-3 text-left text-sm text-[#344054] outline-none hover:bg-[#eeefff] hover:text-[#4646bc] focus:bg-[#eeefff]"
            onClick={() => {
              setContextMenu(null)
              onCloseAll()
            }}
          >
            关闭所有标签
          </button>
        </div>
      )}

      <div className="h-9 shrink-0 border-t border-[#e4e7ef]">
        <Button
          variant="ghost"
          className="h-full w-full justify-start rounded-none px-3 text-[#667085]"
          onClick={onOpenSettings}
          aria-label="编辑器设置"
        >
          <Settings size={16} />
          <span>设置</span>
        </Button>
      </div>
    </aside>
  )
})
