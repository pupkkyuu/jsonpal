import { ArrowDownAZ, Braces, ChevronsDownUp, ChevronsUpDown, ChevronDown, Code, Copy, FileCode, MoreHorizontal, Plus, Pencil, Trash2, WrapText } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface EditorToolbarProps {
  wordWrap: boolean
  onAdd: () => void
  onAddDiff: () => void
  onFormat: () => void
  onSort: () => void
  onCompress: () => void
  onEscape: () => void
  onUnescape: () => void
  onCopy: () => void
  onFoldAll: () => void
  onUnfoldAll: () => void
  onToggleWordWrap: () => void
  onClear: () => void
  mode?: 'json' | 'diff'
  compareMode?: 'edit' | 'compare'
  comparisonBusy?: boolean
  onCompare?: () => void
}

export const EditorToolbar = memo(function EditorToolbar({
  wordWrap,
  onAdd,
  onAddDiff,
  onFormat,
  onSort,
  onCompress,
  onEscape,
  onUnescape,
  onCopy,
  onFoldAll,
  onUnfoldAll,
  onToggleWordWrap,
  onClear,
  mode = 'json',
  onCompare,
  compareMode = 'edit',
  comparisonBusy = false
}: EditorToolbarProps): React.JSX.Element {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMoreOpen && !isAddOpen) return
    const close = (event: MouseEvent): void => {
      if (!addMenuRef.current?.contains(event.target as Node) && !moreMenuRef.current?.contains(event.target as Node)) {
        setIsMoreOpen(false)
        setIsAddOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false)
        setIsAddOpen(false)
      }
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAddOpen, isMoreOpen])

  const runMoreAction = (action: () => void): void => {
    setIsMoreOpen(false)
    action()
  }

  const runAddAction = (action: () => void): void => {
    setIsAddOpen(false)
    action()
  }

  return (
    <nav className="app-panel flex h-10 shrink-0 items-center justify-between border-b px-3" aria-label="JSON 操作">
      <div className="relative flex h-7" ref={addMenuRef}>
        <Button liftOnHover={false} className="h-7 gap-1.5 rounded-r-none border-r border-white/25 px-2.5 text-xs" onClick={onAdd} aria-label="新建 Tab">
          <Plus size={14} />
          新建
        </Button>
        <Button liftOnHover={false} className="h-7 w-7 rounded-l-none px-0" onClick={() => setIsAddOpen((open) => !open)} aria-label="新建其他类型 Tab" aria-expanded={isAddOpen} aria-haspopup="menu">
          <ChevronDown size={14} />
        </Button>
        {isAddOpen && (
          <div role="menu" aria-label="新建 Tab 类型" className="absolute left-0 top-9 z-50 w-full rounded-xl border border-[#e1e4f0] bg-white p-1.5 shadow-xl shadow-[#28304d]/15">
            <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runAddAction(onAddDiff)}>对比</button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {mode === 'diff' ? (
          <>
            <Button liftOnHover={false} onClick={onCompare} disabled={comparisonBusy} className="h-7 gap-1.5 px-2.5 text-xs" aria-label={compareMode === 'edit' ? '对比 JSON' : '编辑 JSON'}>{compareMode === 'edit' ? <Braces size={15} /> : <Pencil size={15} />}<span>{compareMode === 'edit' ? '对比' : '编辑'}</span></Button>
            <Button liftOnHover={false} onClick={onSort} disabled={compareMode === 'compare' || comparisonBusy} className="h-7 gap-1.5 px-2.5 text-xs" aria-label="按字段排序 JSON"><ArrowDownAZ size={15} /><span>排序</span></Button>
          </>
        ) : (
          <Button liftOnHover={false} onClick={onFormat} className="h-7 gap-1.5 px-2.5 text-xs" aria-label="格式化 JSON"><Braces size={15} /><span>格式化</span></Button>
        )}
        {mode === 'diff' ? null : <Button variant="outline" onClick={onCompress} className="h-7 gap-1.5 px-2.5 text-xs" aria-label="压缩 JSON"><Code size={15} /><span className="hidden md:inline">压缩</span></Button>}
        <Button variant="outline" onClick={onClear} className="h-7 gap-1.5 border-[#f2c7cc] px-2.5 text-xs text-[#b42318] hover:border-[#efabb4] hover:bg-[#fff1f1] hover:text-[#b42318]" aria-label="清空编辑器">
          <Trash2 size={15} />
          <span className="hidden md:inline">清空</span>
        </Button>
        {mode === 'json' && <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onFoldAll} aria-label="全部折叠">
              <ChevronsDownUp size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>全部折叠</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUnfoldAll} aria-label="全部展开">
              <ChevronsUpDown size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>全部展开</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className={wordWrap ? 'h-7 w-7 bg-[#eeefff] text-[#4646bc]' : 'h-7 w-7'} onClick={onToggleWordWrap} aria-label="自动换行" aria-pressed={wordWrap}>
              <WrapText size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{wordWrap ? '关闭自动换行' : '开启自动换行'}</TooltipContent>
        </Tooltip>
        <div className="relative" ref={moreMenuRef}>
          <Button variant="ghost" size="icon" className={isMoreOpen ? 'h-7 w-7 bg-[#eeefff] text-[#4646bc]' : 'h-7 w-7'} onClick={() => setIsMoreOpen((open) => !open)} aria-label="更多 JSON 操作" aria-expanded={isMoreOpen} aria-haspopup="menu">
            <MoreHorizontal size={17} />
          </Button>
          {isMoreOpen && (
            <div role="menu" aria-label="更多 JSON 操作" className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-[#e1e4f0] bg-white p-1.5 shadow-xl shadow-[#28304d]/15">
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onEscape)}><FileCode size={15} />转义 JSON</button>
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onUnescape)}><Code size={15} />去除 JSON 转义</button>
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onCopy)}><Copy size={15} />复制 JSON</button>
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onSort)}><ArrowDownAZ size={15} />按字段排序</button>
            </div>
          )}
        </div>
        </>}
      </div>
    </nav>
  )
})
