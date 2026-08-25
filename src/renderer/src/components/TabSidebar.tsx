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
import { FileJson2, GripVertical, Pencil, Plus, Search, Settings, X } from 'lucide-react'
import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { JsonTab } from '@/jsonUtils'
import { cn } from '@/lib/utils'

export type { JsonTab } from '@/jsonUtils'

interface SortableTabProps {
  tab: JsonTab
  isActive: boolean
  onActivate: () => void
  onRename: (title: string) => void
  onClose: () => void
}

const SortableTab = memo(function SortableTab({ tab, isActive, onActivate, onRename, onClose }: SortableTabProps): JSX.Element {
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
    if (nextTitle) onRename(nextTitle)
    else setDraftTitle(tab.title)
    setIsEditing(false)
  }

  const handleItemKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (isEditing || event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onActivate()
    }
  }

  const handleClose = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    onClose()
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
      tabIndex={isActive ? 0 : -1}
      aria-selected={isActive}
      onClick={onActivate}
      onKeyDown={handleItemKeyDown}
      className={cn(
        'group flex h-9 w-full items-center gap-1 rounded-sm border border-transparent px-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#0078d4]',
        isActive ? 'border-[#d4d4d4] bg-[#e7e7e7] text-[#333333]' : 'text-[#616161] hover:bg-[#e8e8e8] hover:text-[#333333]',
        isDragging && 'z-10 opacity-60 shadow-md'
      )}
    >
      <button
        type="button"
        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-[#858585] outline-none hover:text-[#333333] focus-visible:ring-2 focus-visible:ring-[#0078d4] active:cursor-grabbing"
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
          className="h-7 min-w-0 flex-1 rounded-sm border border-[#0078d4] bg-white px-1.5 text-sm text-[#333333] outline-none ring-1 ring-[#0078d4]/30"
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

      <button
        type="button"
        aria-label={`重命名 ${tab.title}`}
        onClick={handleEdit}
        onPointerDown={(event) => event.stopPropagation()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[#858585] opacity-0 outline-none transition-opacity hover:bg-[#dcdcdc] hover:text-[#333333] focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[#0078d4] group-hover:opacity-100"
      >
        <Pencil size={13} />
      </button>

      <button
        type="button"
        aria-label={`关闭 ${tab.title}`}
        onClick={handleClose}
        onPointerDown={(event) => event.stopPropagation()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[#858585] opacity-0 outline-none transition-opacity hover:bg-[#dcdcdc] hover:text-[#333333] focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[#0078d4] group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  )
})

interface TabSidebarProps {
  tabs: JsonTab[]
  activeTabId: string
  onActivate: (id: string) => void
  onAdd: () => void
  onRename: (id: string, title: string) => void
  onClose: (id: string) => void
  onReorder: (tabs: JsonTab[]) => void
  onOpenSettings: () => void
}

export const TabSidebar = memo(function TabSidebar({
  tabs,
  activeTabId,
  onActivate,
  onAdd,
  onRename,
  onClose,
  onReorder,
  onOpenSettings
}: TabSidebarProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleTabs = normalizedQuery
    ? tabs.filter((tab) => tab.title.toLocaleLowerCase().includes(normalizedQuery))
    : tabs

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

  const handleAdd = (): void => {
    setSearchQuery('')
    onAdd()
  }

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#e5e5e5] bg-[#f3f3f3]" aria-label="JSON Tab 侧边栏">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e5e5] px-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#333333]">
          <FileJson2 size={16} className="shrink-0 text-[#616161]" />
          <span className="truncate">Tabs</span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAdd} aria-label="新建 Tab">
              <Plus size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>新建 Tab</TooltipContent>
        </Tooltip>
      </div>

      <div className="border-b border-[#e5e5e5] p-2">
        <div className="flex h-8 items-center gap-2 rounded-sm border border-[#c8c8c8] bg-white px-2 focus-within:border-[#0078d4] focus-within:ring-1 focus-within:ring-[#0078d4]/30">
          <Search size={14} className="shrink-0 text-[#858585]" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索 Tab"
            aria-label="搜索 Tab"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#333333] outline-none placeholder:text-[#858585] [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="清空搜索"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[#858585] outline-none hover:bg-[#e8e8e8] hover:text-[#333333] focus-visible:ring-2 focus-visible:ring-[#0078d4]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleTabs.map((tab) => tab.id)} strategy={verticalListSortingStrategy}>
          <div className="sidebar-tab-list min-h-0 flex-1 space-y-1 overflow-y-auto p-2" role="tablist" aria-orientation="vertical">
            {visibleTabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={() => onActivate(tab.id)}
                onRename={(title) => onRename(tab.id, title)}
                onClose={() => onClose(tab.id)}
              />
            ))}
            {visibleTabs.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-[#858585]">没有匹配的 Tab</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="shrink-0 border-t border-[#e5e5e5] p-2">
        <Button
          variant="ghost"
          className="w-full justify-start px-2 text-[#616161]"
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
