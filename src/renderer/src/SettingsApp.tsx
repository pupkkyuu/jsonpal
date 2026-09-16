import {
  AlignJustify,
  Braces,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Eye,
  FolderOpen,
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
import { IS_MACOS } from '@/lib/utils'

type SettingsCategory = 'general' | 'editor' | 'shortcuts'

const CATEGORY_LABELS: Record<SettingsCategory, string> = {
  general: '通用',
  editor: '编辑器',
  shortcuts: '快捷键'
}

interface SettingRowProps {
  icon: typeof Eye
  label: string
  children: ReactNode
}

function SettingRow({ icon: Icon, label, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex min-h-12 items-center justify-between gap-6 border-b border-[#edf0f5] py-2.5 last:border-b-0">
      <div className="flex items-center gap-3 text-sm font-medium text-[#344054]">
        <Icon size={16} className="text-[#667085]" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  )
}

function SettingsGroup({ title, description, children }: { title: string; description: string; children: ReactNode }): JSX.Element {
  return (
    <section className="border-t border-[#e4e7ef] first:border-t-0">
      <div className="py-3">
        <h3 className="text-sm font-semibold text-[#344054]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#667085]">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  )
}

interface SettingsFormProps {
  settings: EditorSettings
  updateSettings: (patch: Partial<EditorSettings>) => void
}

function SettingsForm({ settings, updateSettings }: SettingsFormProps): JSX.Element {
  return (
    <div className="space-y-5">
      <SettingsGroup title="显示" description="控制编辑器中的辅助信息与布局。">
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
          className="h-8 rounded-lg border border-[#dfe3ee] bg-white px-2 text-sm text-[#344054] outline-none focus:border-[#8b8ce9] focus:ring-2 focus:ring-[#5b5bd6]/15"
          aria-label="空白字符显示方式"
        >
          <option value="none">不显示</option>
          <option value="boundary">边界显示</option>
          <option value="all">全部显示</option>
        </select>
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="编辑行为" description="调整代码阅读、缩进和输入时的行为。">
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
          className="h-8 rounded-lg border border-[#dfe3ee] bg-white px-2 text-sm text-[#344054] outline-none focus:border-[#8b8ce9] focus:ring-2 focus:ring-[#5b5bd6]/15"
          aria-label="行号显示方式"
        >
          <option value="on">绝对行号</option>
          <option value="relative">相对行号</option>
        </select>
        </SettingRow>
        <SettingRow icon={ClipboardPaste} label="粘贴时格式化">
        <Switch checked={settings.formatOnPaste} onCheckedChange={(formatOnPaste) => updateSettings({ formatOnPaste })} aria-label="粘贴时格式化" />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="辅助功能" description="帮助你在不同屏幕和文本内容下舒适编辑。">
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
            className="w-28 accent-[#5b5bd6]"
            aria-label="字体大小"
          />
          <output className="w-9 text-right text-sm tabular-nums text-[#667085]">{settings.fontSize}px</output>
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
            className="w-28 accent-[#5b5bd6]"
            aria-label="滚动条宽度"
          />
          <output className="w-5 text-right text-sm tabular-nums text-[#667085]">{settings.scrollbarSize}</output>
        </div>
        </SettingRow>
      </SettingsGroup>
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
      className={`flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5bd6] ${
        active ? 'bg-[#eeefff] font-semibold text-[#4646bc]' : 'text-[#667085] hover:bg-white hover:text-[#344054]'
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  )
}

function getConfigPathDisplay(configPath: string): { filename: string; directory: string } {
  if (!configPath) return { filename: '正在读取...', directory: '' }

  const normalizedPath = configPath.replaceAll('\\', '/')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  const filename = normalizedPath.slice(separatorIndex + 1) || normalizedPath
  const directory = separatorIndex >= 0 ? `${normalizedPath.slice(0, separatorIndex + 1)}` : ''
  const homeDirectoryMatch = directory.match(/^\/(?:Users|home)\/[^/]+(\/.*)$/)

  return {
    filename,
    directory: homeDirectoryMatch ? `~${homeDirectoryMatch[1]}` : directory
  }
}

function GeneralSettings({ configPath, onOpenFolder }: { configPath: string; onOpenFolder: () => void }): JSX.Element {
  const [isPathExpanded, setIsPathExpanded] = useState(false)
  const [isPathCopied, setIsPathCopied] = useState(false)
  const { filename, directory } = getConfigPathDisplay(configPath)

  const copyPath = async (): Promise<void> => {
    if (!configPath) return
    await navigator.clipboard.writeText(configPath)
    setIsPathCopied(true)
    window.setTimeout(() => setIsPathCopied(false), 1500)
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#27304d]">通用</h2>
        <p className="mt-1 text-sm text-[#667085]">管理 JSONPal 的本地配置文件。</p>
      </div>
      <section className="border-b border-[#e4e7ef]">
        <div className="py-3">
          <h3 className="text-sm font-semibold text-[#344054]">配置文件路径</h3>
        </div>
        <div className="flex min-h-24 flex-col gap-4 pb-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[#344054]">{filename}</div>
            <div className="mt-1.5 flex h-8 min-w-0 items-center text-xs text-[#667085]">
              <span title={directory} className="min-w-0 flex-1 truncate">{directory}</span>
              <button
                type="button"
                className="app-no-drag ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#667085] transition-colors hover:bg-[#f7f8fc] hover:text-[#4646bc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5bd6]"
                onClick={() => setIsPathExpanded((expanded) => !expanded)}
                disabled={!configPath}
                aria-expanded={isPathExpanded}
                aria-label={isPathExpanded ? '收起完整路径' : '展开完整路径'}
              >
                <ChevronRight size={15} className={`transition-transform duration-200 ${isPathExpanded ? 'rotate-90' : ''}`} />
              </button>
            </div>
            <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${isPathExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="min-h-0 overflow-hidden">
                <p className="pt-2 break-all font-mono text-xs leading-5 text-[#667085]">{configPath}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copyPath()} disabled={!configPath}>
              <Copy size={16} />
              {isPathCopied ? '已复制' : '复制路径'}
            </Button>
            <Button variant="outline" onClick={onOpenFolder} disabled={!configPath}>
              <FolderOpen size={16} />
              打开文件夹
            </Button>
          </div>
        </div>
      </section>
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
      <div className="mb-6">
        <h2 className="text-base font-semibold text-[#333333]">快捷键</h2>
        <p className="mt-1 text-sm text-[#616161]">JSONPal 支持的全部键盘快捷键。macOS 使用 ⌘，Windows 和 Linux 使用 Ctrl。</p>
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
    <main className="app-shell flex h-screen min-h-[560px] flex-col overflow-hidden">
      <header className={`app-panel flex h-9 shrink-0 items-center border-b pr-5 app-drag-region ${IS_MACOS ? 'pl-20' : 'pl-5'}`}>
        <h1 className="text-sm font-semibold tracking-tight text-[#27304d]">设置</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="app-panel settings-navigation w-40 shrink-0 border-r p-2.5" aria-label="设置分类">
          <div className="space-y-1">
            <CategoryButton active={category === 'general'} icon={Settings2} label="通用" onClick={() => setCategory('general')} />
            <CategoryButton active={category === 'editor'} icon={SlidersHorizontal} label="编辑器" onClick={() => setCategory('editor')} />
            <CategoryButton active={category === 'shortcuts'} icon={Keyboard} label="快捷键" onClick={() => setCategory('shortcuts')} />
          </div>
        </nav>

        <section className="min-w-0 flex-1 overflow-y-auto px-6 py-7" aria-label={`${CATEGORY_LABELS[category]}设置`}>
          {category === 'general' ? (
            <GeneralSettings configPath={configPath} onOpenFolder={() => void window.api.settings.openFolder()} />
          ) : category === 'shortcuts' ? (
            <ShortcutsSection />
          ) : (
            <div className="max-w-3xl">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#27304d]">编辑器</h2>
                <p className="mt-1 text-sm text-[#667085]">配置当前 Monaco JSON 编辑器的显示和行为。</p>
              </div>
              <SettingsForm settings={settings} updateSettings={updateSettings} />
            </div>
          )}
        </section>
      </div>

      <footer className="app-panel flex min-h-12 shrink-0 items-center justify-end gap-3 border-t px-4 py-2 app-no-drag">
        <Button className="h-7 shrink-0 gap-1.5 px-2.5 text-xs" onClick={applySettings} disabled={isApplying}>
          <Save size={15} />
          {isApplying ? '正在应用' : '应用设置'}
        </Button>
      </footer>
    </main>
  )
}

export default SettingsApp
