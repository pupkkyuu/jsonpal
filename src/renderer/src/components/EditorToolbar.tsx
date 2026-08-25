import { Braces, Code, Copy, FileCode, Minimize2, Trash2, WrapText, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface EditorToolbarProps {
  wordWrap: boolean
  onFormat: () => void
  onCompress: () => void
  onEscape: () => void
  onUnescape: () => void
  onCopy: () => void
  onToggleWordWrap: () => void
  onClear: () => void
}

type ToolbarItem =
  | { kind: 'divider' }
  | { kind: 'action'; icon: LucideIcon; label: string; onClick: () => void; active?: boolean }

export function EditorToolbar({
  wordWrap,
  onFormat,
  onCompress,
  onEscape,
  onUnescape,
  onCopy,
  onToggleWordWrap,
  onClear
}: EditorToolbarProps): JSX.Element {
  const items: ToolbarItem[] = [
    { kind: 'action', icon: Braces, label: '格式化 JSON', onClick: onFormat },
    { kind: 'action', icon: Minimize2, label: '压缩 JSON', onClick: onCompress },
    { kind: 'divider' },
    { kind: 'action', icon: Code, label: '转义 JSON', onClick: onEscape },
    { kind: 'action', icon: FileCode, label: '去除 JSON 转义', onClick: onUnescape },
    { kind: 'divider' },
    { kind: 'action', icon: Copy, label: '复制 JSON', onClick: onCopy },
    { kind: 'action', icon: WrapText, label: '自动换行', onClick: onToggleWordWrap, active: wordWrap },
    { kind: 'action', icon: Trash2, label: '清空', onClick: onClear }
  ]

  return (
    <nav className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-[#e5e5e5] bg-white px-3" aria-label="JSON actions">
      {items.map((item, index) =>
        item.kind === 'divider' ? (
          <span key={index} className="mx-2 h-5 w-px bg-[#e5e5e5]" />
        ) : (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={item.active ? 'bg-[#e7e7e7] text-[#333333]' : undefined}
                onClick={item.onClick}
                aria-label={item.label}
              >
                <item.icon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{item.label}</TooltipContent>
          </Tooltip>
        )
      )}
    </nav>
  )
}
