import { AlignJustify, Braces, ClipboardPaste, Eye, ListOrdered, PanelRight, Rows3, Save, ShieldCheck, Type } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

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

function SettingsApp(): JSX.Element {
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS)
  const [configPath, setConfigPath] = useState('')
  const [isApplying, setIsApplying] = useState(false)

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

  useEffect(() => {
    let isMounted = true
    void window.api.settings.load().then((savedSettings) => {
      if (isMounted) setSettings(mergeEditorSettings(savedSettings))
    })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    void window.api.settings.path().then(setConfigPath)
  }, [])

  return (
    <main className="flex h-screen min-h-[560px] flex-col overflow-hidden bg-white text-zinc-900">
      <header className={`flex h-10 shrink-0 items-center border-b border-zinc-200 pr-5 app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-5'}`}>
        <h1 className="text-sm font-medium">编辑器设置</h1>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto px-5" aria-label="编辑器设置">
        <SettingsForm settings={settings} updateSettings={updateSettings} />
      </section>
      <footer className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-t border-zinc-200 px-5 py-3 app-no-drag">
        <div className="min-w-0 text-xs text-zinc-500">
          <span className="mr-2 whitespace-nowrap text-zinc-700">配置文件</span>
          <code className="break-all text-zinc-500">{configPath || '正在读取...'}</code>
        </div>
        <Button className="shrink-0" onClick={applySettings} disabled={isApplying}>
          <Save size={16} />
          {isApplying ? '正在应用' : '应用设置'}
        </Button>
      </footer>
    </main>
  )
}

export default SettingsApp
