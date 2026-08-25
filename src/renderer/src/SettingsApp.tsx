import {
  AlignJustify,
  Braces,
  ClipboardPaste,
  Eye,
  FileCog,
  FolderOpen,
  Info,
  Keyboard,
  ListOrdered,
  PanelRight,
  Rows3,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Type
} from 'lucide-react'
import { Fragment, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_EDITOR_SETTINGS,
  mergeEditorSettings,
  type EditorSettings,
  type LineNumberMode,
  type WhitespaceMode
} from '@/editorSettings'

type SettingsCategory = 'general' | 'editor' | 'shortcuts'

const CATEGORY_LABELS: Record<SettingsCategory, string> = {
  general: '通用',
  editor: '编辑器',
  shortcuts: '快捷键'
}

const IS_MACOS = window.api.platform === 'darwin'

interface SettingRowProps {
  icon: typeof Eye
  label: string
  children: ReactNode
}

function SettingRow({ icon: Icon, label, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 border-b border-[#e5e5e5] py-3 last:border-b-0">
      <div className="flex items-center gap-3 text-sm font-medium text-[#333333]">
        <Icon size={16} className="text-[#616161]" />
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
    <div className="border-y border-[#e5e5e5]">
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
          className="h-8 rounded-sm border border-[#c8c8c8] bg-white px-2 text-sm text-[#333333] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/30"
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
          className="h-8 rounded-sm border border-[#c8c8c8] bg-white px-2 text-sm text-[#333333] outline-none focus:border-[#0078d4] focus:ring-1 focus:ring-[#0078d4]/30"
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
            className="w-28 accent-[#0078d4]"
            aria-label="字体大小"
          />
          <output className="w-9 text-right text-sm tabular-nums text-[#616161]">{settings.fontSize}px</output>
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
            className="w-28 accent-[#0078d4]"
            aria-label="滚动条宽度"
          />
          <output className="w-5 text-right text-sm tabular-nums text-[#616161]">{settings.scrollbarSize}</output>
        </div>
      </SettingRow>
    </div>
  )
}

interface CategoryButtonProps {
  active: boolean
  icon: typeof Settings2
  label: string
  onClick: () => void
}

function CategoryButton({ active, icon: Icon, label, onClick }: CategoryButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex h-9 w-full items-center gap-2 rounded-sm px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078d4] ${
        active ? 'bg-[#e7e7e7] font-medium text-[#333333]' : 'text-[#616161] hover:bg-[#e8e8e8] hover:text-[#333333]'
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  )
}

function GeneralSettings({ configPath, onOpenFolder }: { configPath: string; onOpenFolder: () => void }): JSX.Element {
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start gap-3">
        <Info size={18} className="mt-0.5 text-[#616161]" />
        <div>
          <h2 className="text-base font-semibold text-[#333333]">通用</h2>
          <p className="mt-1 text-sm text-[#616161]">管理 JSONPal 的本地配置文件。</p>
        </div>
      </div>
      <div className="border-y border-[#e5e5e5]">
        <div className="flex min-h-16 items-center justify-between gap-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <FileCog size={17} className="shrink-0 text-[#616161]" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#333333]">配置文件</div>
              <code className="mt-1 block break-all text-xs text-[#616161]">{configPath || '正在读取...'}</code>
            </div>
          </div>
          <Button variant="outline" className="shrink-0" onClick={onOpenFolder} disabled={!configPath}>
            <FolderOpen size={16} />
            打开文件夹
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-3 border-l-2 border-[#0078d4] bg-[#f3f8fc] px-4 py-3 text-sm text-[#616161]">
        <SlidersHorizontal size={17} className="mt-0.5 shrink-0 text-[#0078d4]" />
        <p>编辑器设置会保存到上述配置文件，并在 JSONPal 启动时作为 Monaco 编辑器的默认配置加载。</p>
      </div>
    </div>
  )
}

interface ShortcutRowProps {
  label: string
  keys: string[]
}

function ShortcutRow({ label, keys }: ShortcutRowProps): JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-6 border-b border-[#e5e5e5] py-3 last:border-b-0">
      <span className="text-sm font-medium text-[#333333]">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <Fragment key={`${index}-${key}`}>
            {index > 0 && <span className="text-xs text-[#858585]">+</span>}
            <kbd className="rounded-sm border border-[#c8c8c8] bg-[#f3f3f3] px-1.5 py-0.5 font-sans text-xs font-medium text-[#333333]">
              {key}
            </kbd>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function ShortcutsSection(): JSX.Element {
  const modifier = IS_MACOS ? '⌘' : 'Ctrl'
  const shift = IS_MACOS ? '⇧' : 'Shift'

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-start gap-3">
        <Keyboard size={18} className="mt-0.5 shrink-0 text-[#616161]" />
        <div>
          <h2 className="text-base font-semibold text-[#333333]">快捷键</h2>
          <p className="mt-1 text-sm text-[#616161]">JSONPal 支持的全部键盘快捷键。macOS 使用 ⌘，Windows 和 Linux 使用 Ctrl。</p>
        </div>
      </div>

      <div className="border-y border-[#e5e5e5]">
        <ShortcutRow label="新建 Tab" keys={[modifier, 'T']} />
        <ShortcutRow label="切换到下一个 Tab" keys={[modifier, 'Tab']} />
        <ShortcutRow label="切换到第 N 个 Tab" keys={[modifier, '1-9']} />
        <ShortcutRow label="收起 / 展开侧边栏" keys={[modifier, 'B']} />
        <ShortcutRow label="格式化 JSON" keys={[modifier, shift, 'F']} />
        <ShortcutRow label="压缩 JSON" keys={[modifier, shift, 'M']} />
      </div>

      {IS_MACOS && (
        <p className="mt-4 text-xs leading-5 text-[#616161]">
          在 macOS 上，⌘Tab 由系统占用；切换 Tab 的组合键可改用 Control 键（如 Control+Tab、Control+数字）。
        </p>
      )}
    </div>
  )
}

function SettingsApp(): JSX.Element {
  const [category, setCategory] = useState<SettingsCategory>('general')
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
    void window.api.settings.path().then((path) => {
      if (isMounted) setConfigPath(path)
    })
    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="flex h-screen min-h-[560px] flex-col overflow-hidden bg-white text-[#333333]">
      <header className={`flex h-10 shrink-0 items-center border-b border-[#e5e5e5] pr-5 app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-5'}`}>
        <h1 className="text-sm font-medium">设置</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-44 shrink-0 border-r border-[#e5e5e5] bg-[#f3f3f3] p-3" aria-label="设置分类">
          <div className="space-y-1">
            <CategoryButton active={category === 'general'} icon={Settings2} label="通用" onClick={() => setCategory('general')} />
            <CategoryButton active={category === 'editor'} icon={SlidersHorizontal} label="编辑器" onClick={() => setCategory('editor')} />
            <CategoryButton active={category === 'shortcuts'} icon={Keyboard} label="快捷键" onClick={() => setCategory('shortcuts')} />
          </div>
        </nav>

        <section className="min-w-0 flex-1 overflow-y-auto px-7 py-6" aria-label={`${CATEGORY_LABELS[category]}设置`}>
          {category === 'general' ? (
            <GeneralSettings configPath={configPath} onOpenFolder={() => void window.api.settings.openFolder()} />
          ) : category === 'shortcuts' ? (
            <ShortcutsSection />
          ) : (
            <div className="max-w-3xl">
              <div className="mb-6 flex items-start gap-3">
                <SlidersHorizontal size={18} className="mt-0.5 text-[#616161]" />
                <div>
                  <h2 className="text-base font-semibold text-[#333333]">编辑器</h2>
                  <p className="mt-1 text-sm text-[#616161]">配置当前 Monaco JSON 编辑器的显示和行为。</p>
                </div>
              </div>
              <SettingsForm settings={settings} updateSettings={updateSettings} />
            </div>
          )}
        </section>
      </div>

      <footer className="flex min-h-16 shrink-0 items-center justify-end gap-4 border-t border-[#e5e5e5] px-5 py-3 app-no-drag">
        <Button className="shrink-0" onClick={applySettings} disabled={isApplying}>
          <Save size={16} />
          {isApplying ? '正在应用' : '应用设置'}
        </Button>
      </footer>
    </main>
  )
}

export default SettingsApp
