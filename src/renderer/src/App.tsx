import Editor, { type OnMount } from '@monaco-editor/react'
import { Braces, Check, Clipboard, FileCode2, Minimize2, Sparkles, Trash2, WrapText } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const EXAMPLE_JSON = `{
  "project": "JSON Tool",
  "version": 1,
  "features": ["format", "compress"],
  "ready": true
}`

type EditorInstance = Parameters<OnMount>[0]

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/^Unexpected token /, 'JSON parse error: token ') : '无法解析 JSON'
}

function App(): JSX.Element {
  const [value, setValue] = useState(EXAMPLE_JSON)
  const [message, setMessage] = useState('JSON 有效')
  const [isValid, setIsValid] = useState(true)
  const [isWordWrap, setIsWordWrap] = useState(false)
  const editorRef = useRef<EditorInstance | null>(null)

  const stats = useMemo(() => {
    const lines = value ? value.split('\n').length : 1
    return { lines, chars: value.length }
  }, [value])

  const validate = useCallback((nextValue: string) => {
    if (!nextValue.trim()) {
      setIsValid(true)
      setMessage('等待输入 JSON')
      return
    }

    try {
      JSON.parse(nextValue)
      setIsValid(true)
      setMessage('JSON 有效')
    } catch (error) {
      setIsValid(false)
      setMessage(getErrorMessage(error))
    }
  }, [])

  const updateValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue)
      validate(nextValue)
    },
    [validate]
  )

  const transformJson = useCallback(
    (spacing: number) => {
      try {
        const transformed = JSON.stringify(JSON.parse(value), null, spacing)
        updateValue(transformed)
        editorRef.current?.focus()
      } catch (error) {
        setIsValid(false)
        setMessage(getErrorMessage(error))
        editorRef.current?.focus()
      }
    },
    [updateValue, value]
  )

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
      setMessage('已复制到剪贴板')
      setIsValid(true)
    } catch {
      setMessage('无法访问剪贴板')
      setIsValid(false)
    }
  }, [value])

  const clearEditor = useCallback(() => {
    updateValue('')
    editorRef.current?.focus()
  }, [updateValue])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    editor.addAction({
      id: 'json-tool-format',
      label: '格式化 JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => transformJson(2)
    })
    editor.addAction({
      id: 'json-tool-compress',
      label: '压缩 JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyM],
      run: () => transformJson(0)
    })
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        transformJson(2)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [transformJson])

  return (
    <TooltipProvider delayDuration={250}>
      <main className="flex h-screen min-h-[520px] flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <header className="flex h-14 shrink-0 items-center border-b border-zinc-800 bg-zinc-950 px-4 app-drag-region">
          <div className="mr-8 flex items-center gap-2.5 app-no-drag">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500 text-white">
              <Braces size={17} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold tracking-wide text-zinc-100">JSON Tool</span>
          </div>

          <nav className="flex items-center gap-1 app-no-drag" aria-label="JSON actions">
            <Button onClick={() => transformJson(2)}>
              <Sparkles size={15} />
              格式化
            </Button>
            <Button variant="outline" onClick={() => transformJson(0)}>
              <Minimize2 size={15} />
              压缩
            </Button>
            <span className="mx-2 h-5 w-px bg-zinc-800" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={copyJson} aria-label="复制 JSON">
                  <Clipboard size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制 JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isWordWrap ? 'outline' : 'ghost'}
                  size="icon"
                  onClick={() => setIsWordWrap((current) => !current)}
                  aria-label="切换自动换行"
                >
                  <WrapText size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>自动换行</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={clearEditor} aria-label="清空编辑器">
                  <Trash2 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>清空</TooltipContent>
            </Tooltip>
          </nav>
        </header>

        <section className="flex min-h-0 flex-1 flex-col" aria-label="JSON editor">
          <div className="flex h-10 shrink-0 items-center border-b border-zinc-800 bg-zinc-900/70 px-4">
            <div className="flex h-full items-center gap-2 border-b-2 border-sky-500 px-1 text-sm font-medium text-zinc-100">
              <FileCode2 size={15} className="text-sky-400" />
              <span>未命名 JSON</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-[#18181b]">
            <Editor
              height="100%"
              language="json"
              theme="vs-dark"
              value={value}
              onChange={(nextValue) => updateValue(nextValue ?? '')}
              onMount={handleEditorMount}
              options={{
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
                lineHeight: 23,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                renderLineHighlight: 'gutter',
                tabSize: 2,
                wordWrap: isWordWrap ? 'on' : 'off',
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                cursorBlinking: 'smooth'
              }}
            />
          </div>
        </section>

        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className={`flex h-1.5 w-1.5 rounded-full ${isValid ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className={isValid ? 'text-zinc-300' : 'text-rose-300'}>{message}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>UTF-8</span>
            <span>空格: 2</span>
            <span>{stats.lines} 行</span>
            <span>{stats.chars} 字符</span>
            <span className="flex items-center gap-1 text-zinc-300"><Check size={13} /> JSON</span>
          </div>
        </footer>
      </main>
    </TooltipProvider>
  )
}

export default App
