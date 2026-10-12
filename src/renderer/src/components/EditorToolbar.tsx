import { ArrowDown, ArrowDownAZ, ArrowUp, Braces, ChevronsDownUp, ChevronsUpDown, Code, Copy, FileCode, FileDiff, Minimize2, PanelLeft, Pencil, Search, Trash2, WrapText } from 'lucide-react'
import { memo, type ComponentProps } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { IS_MACOS } from '@/lib/utils'

// Prefer the space below the toolbar; IconButton keeps collision detection inside the app shell.
function ToolbarIconButton({ tooltipAlign = 'end', ...props }: ComponentProps<typeof IconButton>): React.JSX.Element {
  return <IconButton {...props} tooltipSide="bottom" tooltipAlign={tooltipAlign} />
}

interface EditorToolbarProps {
  wordWrap: boolean
  title: string
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
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
  onSearch: () => void
  mode?: 'json' | 'diff'
  compareMode?: 'edit' | 'compare'
  comparisonBusy?: boolean
  onCompare?: () => void
  onPreviousDiff?: () => void
  onNextDiff?: () => void
}

export const EditorToolbar = memo(function EditorToolbar({
  title, isSidebarCollapsed, onToggleSidebar, wordWrap,
  onFormat, onSort, onCompress, onEscape, onUnescape, onCopy,
  onFoldAll, onUnfoldAll, onToggleWordWrap, onClear, onSearch,
  mode = 'json', onCompare, onPreviousDiff, onNextDiff,
  compareMode = 'edit', comparisonBusy = false
}: EditorToolbarProps): React.JSX.Element {
  const modifier = IS_MACOS ? '⌘' : 'Ctrl'
  const busy = mode === 'diff' && comparisonBusy
  const transformDisabled = busy || (mode === 'diff' && compareMode === 'compare')

  return (
    <nav className={`workspace-toolbar app-drag-region ${IS_MACOS && isSidebarCollapsed ? 'traffic-light-inset' : ''}`} data-sidebar-collapsed={isSidebarCollapsed} aria-label="JSON 操作">
      <div className="workspace-sidebar-toggle" inert={!isSidebarCollapsed} aria-hidden={!isSidebarCollapsed}>
        <ToolbarIconButton tooltipAlign="start" className="sidebar-toggle" label="显示侧边栏" shortcut={`${modifier}+B`} onClick={onToggleSidebar} aria-expanded={false} aria-controls="tab-sidebar" tabIndex={isSidebarCollapsed ? 0 : -1}><PanelLeft size={18} /></ToolbarIconButton>
      </div>
      <span className="workspace-title" title={title}>{title}</span>
      {mode === 'diff' && compareMode === 'compare' && (
        <div className="editor-actions app-no-drag" role="group" aria-label="差异跳转">
          <ToolbarIconButton label="跳转到上一个差异" onClick={onPreviousDiff} disabled={comparisonBusy}><ArrowUp size={17} /></ToolbarIconButton>
          <ToolbarIconButton label="跳转到下一个差异" onClick={onNextDiff} disabled={comparisonBusy}><ArrowDown size={17} /></ToolbarIconButton>
        </div>
      )}
      <div className="editor-actions app-no-drag">
        <ToolbarIconButton label="格式化 JSON" shortcut={`${modifier}+Shift+F`} onClick={onFormat} disabled={transformDisabled}><Braces size={18} /></ToolbarIconButton>
        <ToolbarIconButton label="压缩 JSON" shortcut={`${modifier}+Shift+M`} onClick={onCompress} disabled={transformDisabled}><Minimize2 size={17} /></ToolbarIconButton>
        {mode === 'diff' && <ToolbarIconButton label={compareMode === 'edit' ? '对比 JSON' : '编辑 JSON'} onClick={onCompare} disabled={busy}>{compareMode === 'edit' ? <FileDiff size={18} /> : <Pencil size={17} />}</ToolbarIconButton>}
        <span className="toolbar-separator" aria-hidden="true" />
        <ToolbarIconButton label="全部折叠" onClick={onFoldAll} disabled={busy}><ChevronsDownUp size={18} /></ToolbarIconButton>
        <ToolbarIconButton label="全部展开" onClick={onUnfoldAll} disabled={busy}><ChevronsUpDown size={18} /></ToolbarIconButton>
        <ToolbarIconButton label={wordWrap ? '关闭自动换行' : '开启自动换行'} onClick={onToggleWordWrap} aria-pressed={wordWrap} disabled={busy}><WrapText size={18} /></ToolbarIconButton>
        <span className="toolbar-separator" aria-hidden="true" />
        <ToolbarIconButton label="转义 JSON" onClick={onEscape} disabled={transformDisabled}><FileCode size={18} /></ToolbarIconButton>
        <ToolbarIconButton label="去除 JSON 转义" onClick={onUnescape} disabled={transformDisabled}><Code size={18} /></ToolbarIconButton>
        <span className="toolbar-separator" aria-hidden="true" />
        <ToolbarIconButton label="复制 JSON" onClick={onCopy} disabled={busy}><Copy size={18} /></ToolbarIconButton>
        <ToolbarIconButton label="按字段排序 JSON" onClick={onSort} disabled={transformDisabled}><ArrowDownAZ size={18} /></ToolbarIconButton>
      </div>
      <div className="editor-actions toolbar-clear-action app-no-drag">
        <ToolbarIconButton label="搜索" shortcut={`${modifier}+F`} onClick={onSearch} disabled={mode === 'diff' && comparisonBusy}><Search size={18} /></ToolbarIconButton>
        <ToolbarIconButton label="清空内容" onClick={onClear}><Trash2 size={18} /></ToolbarIconButton>
      </div>
    </nav>
  )
})
