import { Clipboard, Minimize2, Quote, RotateCcw, Sparkles, Trash2, WrapText } from 'lucide-react'
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
  return (
    <nav className="flex h-11 shrink-0 items-center justify-end gap-1 border-b border-[#e5e5e5] bg-white px-3" aria-label="JSON actions">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onFormat} aria-label="格式化 JSON"><Sparkles size={16} /></Button>
        </TooltipTrigger>
        <TooltipContent>格式化 JSON</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onCompress} aria-label="压缩 JSON"><Minimize2 size={16} /></Button>
        </TooltipTrigger>
        <TooltipContent>压缩 JSON</TooltipContent>
      </Tooltip>
      <span className="mx-2 h-5 w-px bg-[#e5e5e5]" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onEscape} aria-label="转义 JSON"><Quote size={16} /></Button>
        </TooltipTrigger>
        <TooltipContent>转义 JSON</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onUnescape} aria-label="去除 JSON 转义"><RotateCcw size={16} /></Button>
        </TooltipTrigger>
        <TooltipContent>去除 JSON 转义</TooltipContent>
      </Tooltip>
      <span className="mx-2 h-5 w-px bg-[#e5e5e5]" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onCopy} aria-label="复制 JSON"><Clipboard size={16} /></Button>
        </TooltipTrigger>
        <TooltipContent>复制 JSON</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={wordWrap ? 'bg-[#e7e7e7] text-[#333333]' : undefined}
            onClick={onToggleWordWrap}
            aria-label="切换自动换行"
          >
            <WrapText size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>自动换行</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="清空编辑器"><Trash2 size={16} /></Button>
        </TooltipTrigger>
        <TooltipContent>清空</TooltipContent>
      </Tooltip>
    </nav>
  )
}
