import Editor, { type OnMount } from '@monaco-editor/react'
import {
  AlignJustify,
  Braces,
  Check,
  Clipboard,
  ClipboardPaste,
  Eye,
  ListOrdered,
  Minimize2,
  PanelRight,
  Quote,
  Rows3,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  WrapText
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const EXAMPLE_JSON = `{
  "project": "JSON Tool",
  "version": 1,
  "features": ["format", "compress"],
  "ready": true
}`

type EditorInstance = Parameters<OnMount>[0]
type MonacoInstance = Parameters<OnMount>[1]

type WhitespaceMode = 'none' | 'boundary' | 'all'
type LineNumberMode = 'on' | 'relative'

interface EditorSettings {
  minimap: boolean
  minimapCharacters: boolean
  stickyScroll: boolean
  folding: boolean
  renderWhitespace: WhitespaceMode
  bracketPairColorization: boolean
  bracketGuides: boolean
  wordWrap: boolean
  lineNumbers: LineNumberMode
  formatOnPaste: boolean
  unicodeHighlight: boolean
  fontSize: number
  scrollbarSize: number
}

const IS_SETTINGS_WINDOW = new URLSearchParams(window.location.search).has('settings')
const IS_MACOS = window.api.platform === 'darwin'

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  minimap: true,
  minimapCharacters: false,
  stickyScroll: true,
  folding: true,
  renderWhitespace: 'boundary',
  bracketPairColorization: false,
  bracketGuides: true,
  wordWrap: false,
  lineNumbers: 'on',
  formatOnPaste: false,
  unicodeHighlight: true,
  fontSize: 14,
  scrollbarSize: 12
}

function mergeEditorSettings(settings: Record<string, unknown>): EditorSettings {
  return { ...DEFAULT_EDITOR_SETTINGS, ...settings } as EditorSettings
}

interface JsonErrorLocation {
  line: number
  column: number
}

function getJsonErrorLocation(value: string, error: unknown): JsonErrorLocation | null {
  const message = error instanceof Error ? error.message : ''
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColumnMatch) {
    return { line: Number(lineColumnMatch[1]), column: Number(lineColumnMatch[2]) }
  }

  const positionMatch = message.match(/position\s+(\d+)/i)
  if (!positionMatch) return null

  const position = Number(positionMatch[1])
  const beforeError = value.slice(0, position)
  const line = beforeError.split('\n').length
  const lastNewline = beforeError.lastIndexOf('\n')
  return { line, column: position - lastNewline }
}

function getErrorMessage(value: string, error: unknown): string {
  if (error instanceof Error && error.message === '内容不是 JSON 字符串') return error.message

  const location = getJsonErrorLocation(value, error)
  return location ? `JSON 格式错误：第 ${location.line} 行，第 ${location.column} 列` : 'JSON 格式错误'
}

interface SettingRowProps {
  icon: typeof Eye
  label: string
  children: ReactNode
}

function SettingRow({ icon: Icon, label, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 border-b border-zinc-200 py-3 last:border-b-0">
      <div className="flex items-center gap-3 text-sm font-medium text-zinc-800">
        <Icon size={16} className="text-zinc-500" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

interface SettingsFormProps {
  settings: EditorSettings
  updateSettings: (patch: Partial<EditorSettings>) => void
}

function SettingsForm({ settings, updateSettings }: SettingsFormProps): JSX.Element {
  return (
    <div className="border-b border-zinc-200">
      <SettingRow icon={PanelRight} label="缩略预览">
        <Switch checked={settings.minimap} onCheckedChange={(minimap) => updateSettings({ minimap })} aria-label="缩略预览" />
      </SettingRow>
      <SettingRow icon={AlignJustify} label="缩略预览字符">
        <Switch
          checked={settings.minimapCharacters}
          onCheckedChange={(minimapCharacters) => updateSettings({ minimapCharacters })}
          aria-label="缩略预览字符"
          disabled={!settings.minimap}
        />
      </SettingRow>
      <SettingRow icon={Rows3} label="粘滞滚动">
        <Switch checked={settings.stickyScroll} onCheckedChange={(stickyScroll) => updateSettings({ stickyScroll })} aria-label="粘滞滚动" />
      </SettingRow>
      <SettingRow icon={Rows3} label="代码折叠">
        <Switch checked={settings.folding} onCheckedChange={(folding) => updateSettings({ folding })} aria-label="代码折叠" />
      </SettingRow>
      <SettingRow icon={Eye} label="空白字符">
        <select
          value={settings.renderWhitespace}
          onChange={(event) => updateSettings({ renderWhitespace: event.target.value as WhitespaceMode })}
          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="空白字符显示方式"
        >
          <option value="none">不显示</option>
          <option value="boundary">边界显示</option>
          <option value="all">全部显示</option>
        </select>
      </SettingRow>
      <SettingRow icon={Braces} label="括号配对着色">
        <Switch
          checked={settings.bracketPairColorization}
          onCheckedChange={(bracketPairColorization) => updateSettings({ bracketPairColorization })}
          aria-label="括号配对着色"
        />
      </SettingRow>
      <SettingRow icon={Braces} label="括号缩进引导线">
        <Switch checked={settings.bracketGuides} onCheckedChange={(bracketGuides) => updateSettings({ bracketGuides })} aria-label="括号缩进引导线" />
      </SettingRow>
      <SettingRow icon={WrapText} label="自动换行">
        <Switch checked={settings.wordWrap} onCheckedChange={(wordWrap) => updateSettings({ wordWrap })} aria-label="自动换行" />
      </SettingRow>
      <SettingRow icon={ListOrdered} label="行号">
        <select
          value={settings.lineNumbers}
          onChange={(event) => updateSettings({ lineNumbers: event.target.value as LineNumberMode })}
          className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="行号显示方式"
        >
          <option value="on">绝对行号</option>
          <option value="relative">相对行号</option>
        </select>
      </SettingRow>
      <SettingRow icon={ClipboardPaste} label="粘贴时格式化">
        <Switch checked={settings.formatOnPaste} onCheckedChange={(formatOnPaste) => updateSettings({ formatOnPaste })} aria-label="粘贴时格式化" />
      </SettingRow>
      <SettingRow icon={ShieldCheck} label="可疑 Unicode 高亮">
        <Switch checked={settings.unicodeHighlight} onCheckedChange={(unicodeHighlight) => updateSettings({ unicodeHighlight })} aria-label="可疑 Unicode 高亮" />
      </SettingRow>
      <SettingRow icon={Type} label="字体大小">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="12"
            max="24"
            step="1"
            value={settings.fontSize}
            onChange={(event) => updateSettings({ fontSize: Number(event.target.value) })}
            className="w-28 accent-sky-600"
            aria-label="字体大小"
          />
          <output className="w-9 text-right text-sm tabular-nums text-zinc-600">{settings.fontSize}px</output>
        </div>
      </SettingRow>
      <SettingRow icon={Rows3} label="滚动条宽度">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="8"
            max="20"
            step="1"
            value={settings.scrollbarSize}
            onChange={(event) => updateSettings({ scrollbarSize: Number(event.target.value) })}
            className="w-28 accent-sky-600"
            aria-label="滚动条宽度"
          />
          <output className="w-5 text-right text-sm tabular-nums text-zinc-600">{settings.scrollbarSize}</output>
        </div>
      </SettingRow>
    </div>
  )
}

interface SettingsWindowProps extends SettingsFormProps {
  isApplying: boolean
  onApply: () => void
}

function SettingsWindow({ settings, updateSettings, isApplying, onApply }: SettingsWindowProps): JSX.Element {
  return (
    <main className="flex h-screen min-h-[560px] flex-col overflow-hidden bg-white text-zinc-900">
      <header className={`flex h-10 shrink-0 items-center border-b border-zinc-200 pr-5 app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-5'}`}>
        <h1 className="text-sm font-medium">编辑器设置</h1>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto px-5" aria-label="编辑器设置">
        <SettingsForm settings={settings} updateSettings={updateSettings} />
      </section>
      <footer className="flex h-16 shrink-0 items-center justify-end border-t border-zinc-200 px-5 app-no-drag">
        <Button onClick={onApply} disabled={isApplying}>
          <Save size={16} />
          {isApplying ? '正在应用' : '应用设置'}
        </Button>
      </footer>
    </main>
  )
}

function App(): JSX.Element {
  const [value, setValue] = useState(EXAMPLE_JSON)
  const [message, setMessage] = useState('JSON 有效')
  const [isValid, setIsValid] = useState(true)
  const [parseErrorLine, setParseErrorLine] = useState<number | null>(null)
  const [markerErrorLines, setMarkerErrorLines] = useState<number[]>([])
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [isApplying, setIsApplying] = useState(false)
  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const errorDecorationIdsRef = useRef<string[]>([])

  const updateSettings = useCallback((patch: Partial<EditorSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const applySettings = useCallback(async () => {
    setIsApplying(true)
    try {
      const savedSettings = await window.api.settings.apply(settings)
      setSettings(mergeEditorSettings(savedSettings))
    } finally {
      setIsApplying(false)
    }
  }, [settings])

  const stats = useMemo(() => {
    const lines = value ? value.split('\n').length : 1
    return { lines, chars: value.length }
  }, [value])

  const showJsonError = useCallback((invalidValue: string, error: unknown) => {
    const location = getJsonErrorLocation(invalidValue, error)
    setIsValid(false)
    setParseErrorLine(location?.line ?? 1)
    setMessage(getErrorMessage(invalidValue, error))
  }, [])

  const validate = useCallback((nextValue: string) => {
    if (!nextValue.trim()) {
      setIsValid(true)
      setParseErrorLine(null)
      setMessage('等待输入 JSON')
      return
    }

    try {
      JSON.parse(nextValue)
      setIsValid(true)
      setParseErrorLine(null)
      setMessage('JSON 有效')
    } catch (error) {
      showJsonError(nextValue, error)
    }
  }, [showJsonError])

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
        showJsonError(value, error)
        editorRef.current?.focus()
      }
    },
    [showJsonError, updateValue, value]
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

  const escapeJson = useCallback(() => {
    updateValue(JSON.stringify(value))
    setMessage('已转义 JSON 文本')
    setIsValid(true)
    editorRef.current?.focus()
  }, [updateValue, value])

  const unescapeJson = useCallback(() => {
    try {
      let unescaped: unknown
      try {
        unescaped = JSON.parse(value)
      } catch {
        // Accept common escaped JSON text that omits the outer string quotes.
        unescaped = JSON.parse(`"${value}"`)
      }
      if (typeof unescaped !== 'string') throw new Error('内容不是 JSON 字符串')

      updateValue(unescaped)
      try {
        JSON.parse(unescaped)
        setIsValid(true)
        setMessage('已去除 JSON 转义')
      } catch {
        setIsValid(false)
        setMessage('已去除 JSON 转义，结果不是有效 JSON')
      }
      editorRef.current?.focus()
    } catch (error) {
      showJsonError(value, error)
      editorRef.current?.focus()
    }
  }, [showJsonError, updateValue, value])

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    editor.getModel()?.updateOptions({
      bracketColorizationOptions: {
        enabled: settings.bracketPairColorization,
        independentColorPoolPerBracketType: false
      }
    })
    const model = editor.getModel()
    const refreshMarkerErrorLines = (): void => {
      if (!model) return

      const lines = monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.severity === monaco.MarkerSeverity.Error)
        .map((marker) => marker.startLineNumber)
      setMarkerErrorLines([...new Set(lines)])
    }
    const markerListener = monaco.editor.onDidChangeMarkers((changedModels) => {
      if (model && changedModels.some((uri) => uri.toString() === model.uri.toString())) refreshMarkerErrorLines()
    })
    refreshMarkerErrorLines()
    editor.onDidDispose(() => markerListener.dispose())
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
      if (IS_SETTINGS_WINDOW) return
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        transformJson(2)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [transformJson])

  useEffect(() => {
    let isMounted = true
    void window.api.settings.load().then((savedSettings) => {
      if (isMounted) setSettings(mergeEditorSettings(savedSettings))
    })

    if (IS_SETTINGS_WINDOW) {
      return () => {
        isMounted = false
      }
    }

    const unsubscribe = window.api.settings.onUpdated((savedSettings) => {
      setSettings(mergeEditorSettings(savedSettings))
    })
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    editorRef.current?.getModel()?.updateOptions({
      bracketColorizationOptions: {
        enabled: settings.bracketPairColorization,
        independentColorPoolPerBracketType: false
      }
    })
  }, [settings.bracketPairColorization])

  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const errorLines = [...new Set([...markerErrorLines, ...(parseErrorLine === null ? [] : [parseErrorLine])])]
    errorDecorationIdsRef.current = editor.deltaDecorations(
      errorDecorationIdsRef.current,
      errorLines.map((line) => ({
              range: new monaco.Range(line, 1, line, 1),
              options: {
                isWholeLine: true,
                className: 'json-error-line',
                linesDecorationsClassName: 'json-error-line-number',
                overviewRuler: {
                  color: '#dc2626',
                  position: monaco.editor.OverviewRulerLane.Full
                }
              }
            }))
    )
  }, [markerErrorLines, parseErrorLine])

  if (IS_SETTINGS_WINDOW) {
    return (
      <TooltipProvider delayDuration={250}>
        <SettingsWindow settings={settings} updateSettings={updateSettings} isApplying={isApplying} onApply={applySettings} />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={250}>
      <main className="flex h-screen min-h-[520px] flex-col overflow-hidden bg-white text-zinc-900">
        <header className={`flex h-10 shrink-0 items-center justify-end border-b border-zinc-200 bg-white pr-4 app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-4'}`}>
          {IS_MACOS && <span className="mr-auto text-sm font-medium text-zinc-900">json tool</span>}
          <nav className="flex items-center gap-1 app-no-drag" aria-label="JSON actions">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => transformJson(2)} aria-label="格式化 JSON">
                  <Sparkles size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>格式化 JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => transformJson(0)} aria-label="压缩 JSON">
                  <Minimize2 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>压缩 JSON</TooltipContent>
            </Tooltip>
            <span className="mx-2 h-5 w-px bg-zinc-200" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={escapeJson} aria-label="转义 JSON">
                  <Quote size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>转义 JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={unescapeJson} aria-label="去除 JSON 转义">
                  <RotateCcw size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>去除 JSON 转义</TooltipContent>
            </Tooltip>
            <span className="mx-2 h-5 w-px bg-zinc-200" />
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
                <Button variant="ghost" size="icon" onClick={clearEditor} aria-label="清空编辑器">
                  <Trash2 size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>清空</TooltipContent>
            </Tooltip>
              <span className="mx-2 h-5 w-px bg-zinc-200" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => void window.api.settings.open()} aria-label="编辑器设置">
                    <Settings size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>编辑器设置</TooltipContent>
              </Tooltip>
          </nav>
        </header>

        <section className="min-h-0 flex-1" aria-label="JSON editor">
          <div className="h-full bg-white">
            <Editor
              height="100%"
              language="json"
              theme="vs"
              value={value}
              onChange={(nextValue) => updateValue(nextValue ?? '')}
              onMount={handleEditorMount}
              options={{
                automaticLayout: true,
                minimap: { enabled: settings.minimap, side: 'right', renderCharacters: settings.minimapCharacters },
                fontSize: settings.fontSize,
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
                lineHeight: 23,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                renderLineHighlight: 'gutter',
                tabSize: 2,
                wordWrap: settings.wordWrap ? 'on' : 'off',
                lineNumbers: settings.lineNumbers,
                folding: settings.folding,
                renderWhitespace: settings.renderWhitespace,
                matchBrackets: 'always',
                stickyScroll: { enabled: settings.stickyScroll },
                formatOnPaste: settings.formatOnPaste,
                unicodeHighlight: {
                  ambiguousCharacters: settings.unicodeHighlight,
                  invisibleCharacters: settings.unicodeHighlight,
                  nonBasicASCII: settings.unicodeHighlight
                },
                scrollbar: { verticalScrollbarSize: settings.scrollbarSize },
                bracketPairColorization: {
                  enabled: settings.bracketPairColorization,
                  independentColorPoolPerBracketType: true
                },
                guides: { bracketPairs: settings.bracketGuides },
                cursorBlinking: 'smooth'
              }}
            />
          </div>
        </section>

        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className={`flex h-1.5 w-1.5 rounded-full ${isValid ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className={isValid ? 'text-zinc-600' : 'text-rose-600'}>{message}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>UTF-8</span>
            <span>空格: 2</span>
            <span>{stats.lines} 行</span>
            <span>{stats.chars} 字符</span>
            <span className="flex items-center gap-1 text-zinc-600"><Check size={13} /> JSON</span>
          </div>
        </footer>
      </main>
    </TooltipProvider>
  )
}

export default App
