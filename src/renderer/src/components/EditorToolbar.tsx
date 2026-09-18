import { Braces, ChevronsDownUp, ChevronsUpDown, Code, Copy, FileCode, MoreHorizontal, Plus, Trash2, WrapText } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface EditorToolbarProps {
  wordWrap: boolean
  onAdd: () => void
  onFormat: () => void
  onCompress: () => void
  onEscape: () => void
  onUnescape: () => void
  onCopy: () => void
  onFoldAll: () => void
  onUnfoldAll: () => void
  onToggleWordWrap: () => void
  onClear: () => void
}

export const EditorToolbar = memo(function EditorToolbar({
  wordWrap,
  onAdd,
  onFormat,
  onCompress,
  onEscape,
  onUnescape,
  onCopy,
  onFoldAll,
  onUnfoldAll,
  onToggleWordWrap,
  onClear
}: EditorToolbarProps): React.JSX.Element {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMoreOpen) return
    const close = (event: MouseEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setIsMoreOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsMoreOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMoreOpen])

  const runMoreAction = (action: () => void): void => {
    setIsMoreOpen(false)
    action()
  }

  return (
    <nav className="app-panel flex h-10 shrink-0 items-center justify-between border-b px-3" aria-label="JSON 操作">
      <Button className="h-7 gap-1.5 px-2.5 text-xs" onClick={onAdd} aria-label="新建 Tab">
        <Plus size={14} />
        新建
      </Button>
      <div className="flex items-center gap-1">
        <Button onClick={onFormat} className="h-7 gap-1.5 px-2.5 text-xs" aria-label="格式化 JSON"><Braces size={15} /><span>格式化</span></Button>
        <Button variant="outline" onClick={onCompress} className="h-7 gap-1.5 px-2.5 text-xs" aria-label="压缩 JSON"><Code size={15} /><span className="hidden md:inline">压缩</span></Button>
        <Button variant="outline" onClick={onClear} className="h-7 gap-1.5 border-[#f2c7cc] px-2.5 text-xs text-[#b42318] hover:border-[#efabb4] hover:bg-[#fff1f1] hover:text-[#b42318]" aria-label="清空编辑器">
          <Trash2 size={15} />
          <span className="hidden md:inline">清空</span>
        </Button>
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
        <div className="relative" ref={menuRef}>
          <Button variant="ghost" size="icon" className={isMoreOpen ? 'h-7 w-7 bg-[#eeefff] text-[#4646bc]' : 'h-7 w-7'} onClick={() => setIsMoreOpen((open) => !open)} aria-label="更多 JSON 操作" aria-expanded={isMoreOpen} aria-haspopup="menu">
            <MoreHorizontal size={17} />
          </Button>
          {isMoreOpen && (
            <div role="menu" aria-label="更多 JSON 操作" className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-[#e1e4f0] bg-white p-1.5 shadow-xl shadow-[#28304d]/15">
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onEscape)}><FileCode size={15} />转义 JSON</button>
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onUnescape)}><Code size={15} />去除 JSON 转义</button>
              <button type="button" role="menuitem" className="toolbar-menu-item" onClick={() => runMoreAction(onCopy)}><Copy size={15} />复制 JSON</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
})
